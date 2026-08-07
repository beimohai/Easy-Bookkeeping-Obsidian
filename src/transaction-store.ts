import { App, TFile, normalizePath, parseYaml, stringifyYaml } from "obsidian";
import type { BookkeepingSettings, MonthSummary, Transaction, TransactionDraft } from "./types";
import { errorMessageZh, escapeCsv, monthOf, normalizeDate, normalizeTime, parseCsv, roundMoney, safeFolder, sanitizeFileName } from "./utils";

type Frontmatter = Record<string, unknown>;

function isFrontmatter(value: unknown): value is Frontmatter {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export interface ImportFailure {
  row: number;
  reason: string;
  raw: string[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failures: ImportFailure[];
  failureReport?: TFile;
}

export interface CsvMetadataAnalysis {
  differences: string[];
  hasDifferences: boolean;
}

export interface PendingDelete {
  file: TFile;
  originalPath: string;
}

export interface ExportOptions {
  folder?: string;
  fileName?: string;
  dateFrom?: string;
  dateTo?: string;
  transactionIds?: string[];
}

export class TransactionStore {
  constructor(private readonly app: App, private readonly getSettings: () => BookkeepingSettings) {}

  async list(): Promise<Transaction[]> {
    const settings = this.getSettings();
    const root = `${safeFolder(settings.ledgerFolder)}/`;
    const trashRoot = `${safeFolder(settings.ledgerFolder)}/.bookkeeping-trash/`;
    const transactions: Transaction[] = [];

    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!file.path.startsWith(root)) continue;
      if (file.path.startsWith(trashRoot)) continue;
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!isFrontmatter(frontmatter)) continue;
      const transaction = this.fromFrontmatter(file, frontmatter);
      if (transaction) transactions.push(transaction);
    }

    return transactions.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  }

  async create(draft: TransactionDraft): Promise<TFile> {
    const settings = this.getSettings();
    await this.assertContentAvailable(draft.title, "", draft.date);
    const [year = "0000", month = "00", day = "00"] = draft.date.split("-");
    const folder = normalizePath(`${safeFolder(settings.ledgerFolder)}/${year}/${month}/${day}`);
    await this.ensureFolder(folder);

    const timePart = draft.time.replace(":", "");
    const baseName = `${timePart}-${sanitizeFileName(draft.title)}`;
    const path = this.uniquePath(folder, baseName);
    const id = this.makeId();
    const content = `---\n${stringifyYaml(this.toFrontmatter(draft, id))}---\n${this.attachmentSection(draft.attachments)}`;
    return this.app.vault.create(path, content);
  }

  async update(transaction: Transaction, draft: TransactionDraft): Promise<void> {
    if (draft.title.trim().toLocaleLowerCase() !== transaction.title.trim().toLocaleLowerCase()) {
      await this.assertContentAvailable(draft.title, transaction.id, draft.date);
    }
    const dateChanged = draft.date !== transaction.date;
    await this.app.fileManager.processFrontMatter(transaction.file, (frontmatter) => {
      const next = this.toFrontmatter(draft, transaction.id === transaction.file.path ? this.makeId() : transaction.id);
      delete frontmatter["日期"];
      delete frontmatter["时刻"];
      if (draft.type !== "转账") delete frontmatter["目标账户"];
      if (!draft.attachments.length) delete frontmatter["附件"];
      Object.assign(frontmatter, next);
    });
    await this.syncAttachmentSection(transaction.file, draft.attachments);
    if (dateChanged && this.app.vault.getAbstractFileByPath(transaction.file.path)) {
      const [year = "0000", month = "00", day = "00"] = draft.date.split("-");
      const folder = normalizePath(`${safeFolder(this.getSettings().ledgerFolder)}/${year}/${month}/${day}`);
      await this.ensureFolder(folder);
      await this.app.fileManager.renameFile(transaction.file, this.uniquePath(folder, transaction.file.basename));
    }
  }

  async saveAttachment(file: File, draft: Pick<TransactionDraft, "date" | "time" | "title">): Promise<TFile> {
    const settings = this.getSettings();
    const [year = "0000", month = "00", day = "00"] = draft.date.split("-");
    const folder = normalizePath(`${safeFolder(settings.attachmentFolder)}/${year}/${month}/${day}`);
    await this.ensureFolder(folder);
    const dot = file.name.lastIndexOf(".");
    const extension = dot > 0 ? file.name.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
    const base = sanitizeFileName(`${draft.time.replace(":", "")}-${draft.title}`);
    const path = this.uniqueFilePath(folder, base, extension);
    return this.app.vault.createBinary(path, await file.arrayBuffer());
  }

  private async assertContentAvailable(title: string, excludedId = "", date = ""): Promise<void> {
    if (this.getSettings().allowDuplicateContent) return;
    const normalized = title.trim().toLocaleLowerCase();
    if (!normalized) return;
    const duplicate = (await this.list()).some((item) => item.id !== excludedId && (!date || item.date === date) && item.title.trim().toLocaleLowerCase() === normalized);
    if (duplicate) throw new Error(`同日内容“${title.trim()}”已存在，不允许重复`);
  }

  async remove(transaction: Transaction): Promise<void> {
    await this.app.fileManager.trashFile(transaction.file);
  }

  async stageRemove(transaction: Transaction): Promise<PendingDelete> {
    const folder = normalizePath(`${safeFolder(this.getSettings().ledgerFolder)}/.bookkeeping-trash`);
    await this.ensureFolder(folder);
    const target = this.uniquePath(folder, `${this.makeId()}-${sanitizeFileName(transaction.file.basename)}`);
    const originalPath = transaction.file.path;
    await this.app.fileManager.renameFile(transaction.file, target);
    return { file: transaction.file, originalPath };
  }

  async undoRemove(pending: PendingDelete): Promise<void> {
    if (!this.app.vault.getAbstractFileByPath(pending.file.path)) return;
    const target = this.availableMarkdownPath(pending.originalPath);
    await this.ensureFolder(target.slice(0, target.lastIndexOf("/")));
    await this.app.fileManager.renameFile(pending.file, target);
  }

  async finalizeRemove(pending: PendingDelete): Promise<void> {
    if (this.app.vault.getAbstractFileByPath(pending.file.path)) await this.app.fileManager.trashFile(pending.file);
  }

  async cleanupPendingDeletes(): Promise<void> {
    const trashRoot = `${safeFolder(this.getSettings().ledgerFolder)}/.bookkeeping-trash/`;
    for (const file of this.app.vault.getMarkdownFiles().filter((item) => item.path.startsWith(trashRoot))) {
      await this.app.fileManager.trashFile(file);
    }
  }

  async legacyFileCount(folder = ""): Promise<number> {
    const prefix = folder ? `${safeFolder(folder)}/` : "";
    return (await this.list()).filter((item) => item.legacy && (!prefix || item.file.path.startsWith(prefix))).length;
  }

  async convertLegacyFiles(onProgress?: (done: number, total: number) => void, folder = ""): Promise<number> {
    const prefix = folder ? `${safeFolder(folder)}/` : "";
    const legacy = (await this.list()).filter((item) => item.legacy && (!prefix || item.file.path.startsWith(prefix)));
    for (let index = 0; index < legacy.length; index++) {
      const item = legacy[index] as Transaction;
      await this.update(item, {
        date: item.date,
        time: item.time,
        type: item.type,
        necessity: item.necessity,
        category: item.category || "未分类",
        account: item.account || this.getSettings().defaultAccount,
        targetAccount: item.targetAccount,
        title: item.title,
        amount: item.amount,
        expression: item.expression,
        note: item.note,
        tags: item.tags,
        attachments: item.attachments
      });
      if ((index + 1) % 10 === 0 || index + 1 === legacy.length) onProgress?.(index + 1, legacy.length);
    }
    return legacy.length;
  }

  async importExternalLegacyMarkdown(files: Array<{ name: string; content: string }>, onProgress?: (done: number, total: number) => void): Promise<{ imported: number; failed: number }> {
    const existing = new Set((await this.list()).map((item) => this.fingerprint(item)));
    let imported = 0, failed = 0;
    for (let index = 0; index < files.length; index++) {
      const source = files[index] as { name: string; content: string };
      try {
        const match = source.content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (!match?.[1]) throw new Error("缺少Properties");
        const parsed = parseYaml(match[1]);
        if (!isFrontmatter(parsed)) throw new Error("Properties格式不合法");
        const frontmatter = parsed;
        const typeValue = String(frontmatter["类型"] ?? "");
        const type = typeValue === "收入" || typeValue === "转账" ? typeValue : typeValue === "支出" ? "支出" : null;
        const date = normalizeDate(frontmatter["日期"] ?? frontmatter["时间"]);
        const amount = Number(frontmatter["金额"]);
        if (!type || !date || !Number.isFinite(amount) || amount === 0) throw new Error("缺少有效的类型、日期或金额");
        const rawNote = String(frontmatter["备注"] ?? "");
        const extracted = this.extractExpression(rawNote, String(frontmatter["算式"] ?? ""), Math.abs(roundMoney(amount)));
        const tagsValue = frontmatter["tags"];
        const tags = (Array.isArray(tagsValue) ? tagsValue.map(String) : String(tagsValue ?? "").split(/[ ,，]+/)).map((tag) => tag.replace(/^#/, "")).filter((tag) => tag && tag !== "记账");
        const draft: TransactionDraft = {
          date, time: String(frontmatter["时刻"] ?? normalizeTime(frontmatter["时间"])), type,
          necessity: frontmatter["标签"] === "非必需" ? "非必需" : "必需",
          category: String(frontmatter["分类"] ?? "未分类"), account: String(frontmatter["账户"] ?? this.getSettings().defaultAccount),
          targetAccount: String(frontmatter["目标账户"] ?? ""), title: String(frontmatter["内容"] ?? source.name.replace(/\.md$/i, "")),
          amount: Math.abs(roundMoney(amount)), expression: extracted.expression, note: extracted.note,
          tags: [...new Set(tags)], attachments: this.readStringList(frontmatter["附件"])
        };
        const fingerprint = this.fingerprint(draft);
        if (existing.has(fingerprint)) throw new Error("重复账目");
        await this.create(draft); existing.add(fingerprint); imported++;
      } catch { failed++; }
      if ((index + 1) % 10 === 0 || index + 1 === files.length) onProgress?.(index + 1, files.length);
    }
    return { imported, failed };
  }

  async rewriteExpressionStorage(onProgress?: (done: number, total: number) => void): Promise<number> {
    const transactions = await this.list();
    for (let index = 0; index < transactions.length; index++) {
      const item = transactions[index] as Transaction;
      await this.update(item, this.toDraft(item));
      if ((index + 1) % 10 === 0 || index + 1 === transactions.length) onProgress?.(index + 1, transactions.length);
    }
    return transactions.length;
  }

  async updateTagGlobally(oldTag: string, newTag: string | null, onProgress?: (done: number, total: number) => void): Promise<number> {
    const transactions = (await this.list()).filter((item) => item.tags.includes(oldTag));
    for (let index = 0; index < transactions.length; index++) {
      const item = transactions[index] as Transaction;
      const replacement = newTag?.replace(/^#/, "").trim();
      const tags = item.tags.flatMap((tag) => tag === oldTag ? (replacement ? [replacement] : []) : [tag]);
      const draft = this.toDraft(item);
      draft.tags = [...new Set(tags)];
      draft.note = this.replaceTagInNote(draft.note, oldTag, replacement || null);
      await this.update(item, draft);
      if ((index + 1) % 10 === 0 || index + 1 === transactions.length) onProgress?.(index + 1, transactions.length);
    }
    return transactions.length;
  }

  async deleteTransactionsWithTag(tag: string, onProgress?: (done: number, total: number) => void): Promise<number> {
    const transactions = (await this.list()).filter((item) => item.tags.includes(tag));
    for (let index = 0; index < transactions.length; index++) {
      await this.remove(transactions[index] as Transaction);
      if ((index + 1) % 10 === 0 || index + 1 === transactions.length) onProgress?.(index + 1, transactions.length);
    }
    return transactions.length;
  }

  async updateAttachmentPath(oldPath: string, newPath: string): Promise<number> {
    const transactions = (await this.list()).filter((item) => item.attachments.includes(oldPath));
    for (const item of transactions) {
      const draft = this.toDraft(item);
      draft.attachments = draft.attachments.map((path) => path === oldPath ? newPath : path);
      await this.update(item, draft);
    }
    return transactions.length;
  }

  async renameAccountGlobally(oldName: string, newName: string): Promise<number> {
    if (!oldName || !newName || oldName === newName) return 0;
    const transactions = (await this.list()).filter((item) => item.account === oldName || item.targetAccount === oldName);
    for (const item of transactions) {
      const draft = this.toDraft(item);
      if (draft.account === oldName) draft.account = newName;
      if (draft.targetAccount === oldName) draft.targetAccount = newName;
      await this.update(item, draft);
    }
    return transactions.length;
  }

  async renameCategoryGlobally(oldName: string, newName: string): Promise<number> {
    if (!oldName || !newName || oldName === newName) return 0;
    const transactions = (await this.list()).filter((item) => item.category === oldName);
    for (const item of transactions) {
      const draft = this.toDraft(item);
      draft.category = newName;
      await this.update(item, draft);
    }
    return transactions.length;
  }

  async syncAttachmentPreviews(): Promise<number> {
    const transactions = (await this.list()).filter((item) => item.attachments.length > 0);
    for (const item of transactions) await this.syncAttachmentSection(item.file, item.attachments);
    return transactions.length;
  }

  summarize(transactions: Transaction[], month: string): MonthSummary {
    const current = transactions.filter((item) => monthOf(item.date) === month && this.typeEffect(item.type) !== "neutral");
    const incomeItems = current.filter((item) => this.typeEffect(item.type) === "positive");
    const expenseItems = current.filter((item) => this.typeEffect(item.type) === "negative");
    const income = roundMoney(incomeItems.reduce((sum, item) => sum + item.amount, 0));
    const expense = roundMoney(expenseItems.reduce((sum, item) => sum + item.amount, 0));
    const byCategory = new Map<string, number>();
    const byDay = new Map<string, number>();

    for (const item of expenseItems) {
      const category = item.category || "未分类";
      byCategory.set(category, roundMoney((byCategory.get(category) ?? 0) + item.amount));
      byDay.set(item.date, roundMoney((byDay.get(item.date) ?? 0) + item.amount));
    }

    return {
      income,
      expense,
      balance: roundMoney(income - expense),
      expenseCount: expenseItems.length,
      incomeCount: incomeItems.length,
      byCategory,
      byDay
    };
  }

  accountMonthlyBalances(transactions: Transaction[], month: string): { opening: Map<string, number>; closing: Map<string, number> } {
    const settings = this.getSettings();
    const accountNames = new Set(settings.accounts.map((account) => account.name));
    transactions.forEach((item) => {
      if (item.account) accountNames.add(item.account);
      if (item.targetAccount) accountNames.add(item.targetAccount);
    });
    const opening = new Map<string, number>();
    for (const accountName of accountNames) {
      const configured = settings.accounts.find((account) => account.name === accountName);
      const overrides = Object.entries(settings.monthlyOpeningBalances)
        .filter(([overrideMonth, values]) => overrideMonth <= month && Number.isFinite(values[accountName]))
        .sort(([a], [b]) => b.localeCompare(a));
      const latest = overrides[0];
      const baseMonth = latest?.[0] ?? "";
      let balance = latest ? Number(latest[1][accountName]) : (configured?.initialBalance ?? 0);
      for (const item of transactions) {
        if (item.date >= `${month}-01`) continue;
        if (baseMonth && item.date < `${baseMonth}-01`) continue;
        balance = this.applyAccountTransaction(balance, item, accountName);
      }
      opening.set(accountName, roundMoney(balance));
    }
    const closing = new Map(opening);
    for (const item of transactions) {
      if (monthOf(item.date) !== month) continue;
      for (const accountName of accountNames) {
        closing.set(accountName, roundMoney(this.applyAccountTransaction(closing.get(accountName) ?? 0, item, accountName)));
      }
    }
    return { opening, closing };
  }

  private applyAccountTransaction(balance: number, item: Transaction, accountName: string): number {
    const effect = this.typeEffect(item.type);
    if (item.type === "转账" && effect === "neutral") {
      if (item.account === accountName) balance -= item.amount;
      if (item.targetAccount === accountName) balance += item.amount;
      return balance;
    }
    if (effect === "positive" && item.account === accountName) return balance + item.amount;
    if (effect === "negative" && item.account === accountName) return balance - item.amount;
    return balance;
  }

  typeEffect(type: Transaction["type"]): "positive" | "negative" | "neutral" {
    return this.getSettings().typeEffects[type] ?? (type === "收入" ? "positive" : type === "支出" ? "negative" : "neutral");
  }

  async exportCsv(options: ExportOptions = {}): Promise<TFile> {
    const settings = this.getSettings();
    const folder = safeFolder(options.folder || settings.exportFolder);
    await this.ensureFolder(folder);
    const csv = await this.buildCsv(options);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const requestedName = (options.fileName || `账目导出-${stamp}`).replace(/\.csv$/i, "");
    const path = this.uniqueFilePath(folder, sanitizeFileName(requestedName), "csv");
    return this.app.vault.create(path, csv);
  }

  async buildCsv(options: ExportOptions = {}): Promise<string> {
    const allowedIds = options.transactionIds ? new Set(options.transactionIds) : null;
    const transactions = (await this.list()).filter((item) => {
      if (allowedIds && !allowedIds.has(item.id)) return false;
      if (options.dateFrom && item.date < options.dateFrom) return false;
      if (options.dateTo && item.date > options.dateTo) return false;
      return true;
    });
    const rows = transactions.map((item) => [
      item.date,
      item.time,
      item.type,
      item.necessity,
      item.category,
      item.account,
      item.targetAccount,
      item.title,
      item.amount.toFixed(2),
      item.expression || String(item.amount),
      item.note,
      item.tags.join(" "),
      item.attachments.join(" | "),
      item.file.path
    ].map(escapeCsv).join(","));
    const csv = ["日期,时间,类型,标签,分类,账户,目标账户,内容,金额,算式,备注,附加标签,附件,文件", ...rows].join("\n");
    return `\uFEFF${csv}`;
  }

  inspectCsvMetadata(text: string): CsvMetadataAnalysis {
    const rows = parseCsv(text);
    if (rows.length < 2) return { differences: [], hasDifferences: false };
    const headers = (rows[0] ?? []).map((header) => header.toLocaleLowerCase("zh-CN").replace(/[\s_-]/g, ""));
    const find = (...aliases: string[]): number => headers.findIndex((header) => aliases.includes(header));
    const indexes = {
      type: find("类型", "收支类型", "交易类型", "type"),
      necessity: find("必要性", "标签", "necessity"),
      category: find("分类", "category"),
      account: find("账户", "account")
    };
    const unique = (index: number): string[] => index < 0 ? [] : [...new Set(rows.slice(1).map((row) => String(row[index] ?? "").trim()).filter(Boolean))];
    const settings = this.getSettings();
    const differences: string[] = [];
    const unknownTypes = unique(indexes.type).filter((value) => !["支出", "收入", "转账", "expense", "income", "transfer"].includes(value.toLocaleLowerCase("zh-CN")));
    const unknownNecessity = unique(indexes.necessity).filter((value) => value !== "必需" && value !== "非必需");
    const categories = new Set([...settings.categories, ...settings.incomeCategories, "未分类"]);
    const unknownCategories = unique(indexes.category).filter((value) => !categories.has(value));
    const accounts = new Set(settings.accounts.map((account) => account.name));
    const unknownAccounts = unique(indexes.account).filter((value) => !accounts.has(value));
    if (unknownTypes.length) differences.push(`未知类型：${unknownTypes.join("、")}`);
    if (unknownNecessity.length) differences.push(`未知必要性：${unknownNecessity.join("、")}`);
    if (unknownCategories.length) differences.push(`仓库中没有的分类：${unknownCategories.join("、")}`);
    if (unknownAccounts.length) differences.push(`仓库中没有的账户：${unknownAccounts.join("、")}`);
    return { differences, hasDifferences: differences.length > 0 };
  }

  async importCsv(text: string, onProgress?: (done: number, total: number) => void, normalizeMetadata = false): Promise<ImportResult> {
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error("CSV没有可导入的数据行");
    const headers = (rows[0] ?? []).map((header) => header.toLocaleLowerCase("zh-CN").replace(/[\s_-]/g, ""));
    const aliases: Record<string, string[]> = {
      date: ["日期", "交易日期", "date", "datetime", "时间"],
      time: ["时间", "时刻", "交易时间", "time"],
      type: ["类型", "收支类型", "交易类型", "type"],
      necessity: ["必要性", "标签", "necessity"],
      category: ["分类", "category"],
      account: ["账户", "account"],
      targetAccount: ["目标账户", "转入账户", "targetaccount"],
      title: ["内容", "名称", "摘要", "商品", "description", "title", "memo"],
      amount: ["金额", "交易金额", "amount", "money"],
      expression: ["算式", "expression", "formula"],
      note: ["备注", "note", "remark"],
      tags: ["附加标签", "tags", "tag"],
      attachments: ["附件", "attachments", "attachment"]
    };
    const indexOf = (key: string): number => headers.findIndex((header) => (aliases[key] ?? []).includes(header));
    const indexes: Record<string, number> = {};
    for (const key of Object.keys(aliases)) indexes[key] = indexOf(key);
    if ((indexes["date"] ?? -1) < 0 || (indexes["amount"] ?? -1) < 0) throw new Error("CSV至少需要日期和金额两列");
    const existing = new Set((await this.list()).map((item) => this.fingerprint(item)));
    const failures: ImportFailure[] = [];
    let imported = 0;
    let skipped = 0;
    const dataRows = rows.slice(1);
    for (let index = 0; index < dataRows.length; index++) {
      const row = dataRows[index] ?? [];
      try {
        const get = (key: string): string => (indexes[key] ?? -1) >= 0 ? String(row[indexes[key] as number] ?? "").trim() : "";
        const rawDate = get("date");
        const date = normalizeDate(rawDate);
        if (!date) throw new Error("日期无效");
        const amountText = get("amount").replace(/[￥¥$€,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
        const signedAmount = Number(amountText);
        if (!Number.isFinite(signedAmount) || signedAmount === 0) throw new Error("金额必须是非零数字");
        const rawType = get("type").toLocaleLowerCase("zh-CN");
        const type: Transaction["type"] = /收入|income|入账|收款/.test(rawType) ? "收入"
          : /转账|transfer/.test(rawType) ? "转账"
          : /支出|expense|付款|消费/.test(rawType) ? "支出"
          : signedAmount < 0 ? "支出" : this.getSettings().defaultType === "转账" ? "支出" : this.getSettings().defaultType;
        const title = get("title") || get("note") || "CSV导入账目";
        const timeText = get("time") || rawDate;
        const directTime = timeText.match(/^(\d{1,2}):(\d{2})$/);
        if (directTime && (Number(directTime[1]) > 23 || Number(directTime[2]) > 59)) throw new Error("时间无效");
        const time = directTime ? `${String(Number(directTime[1])).padStart(2, "0")}:${directTime[2]}` : normalizeTime(timeText);
        const amount = Math.abs(roundMoney(signedAmount));
        const settings = this.getSettings();
        const validAccounts = new Set(settings.accounts.map((account) => account.name));
        const rawAccount = get("account") || settings.defaultAccount;
        const account = normalizeMetadata && !validAccounts.has(rawAccount) ? settings.defaultAccount : rawAccount;
        const rawTargetAccount = get("targetAccount");
        const targetAccount = normalizeMetadata && rawTargetAccount && !validAccounts.has(rawTargetAccount)
          ? (settings.accounts.find((item) => item.name !== account)?.name ?? "") : rawTargetAccount;
        if (type === "转账" && (!targetAccount || targetAccount === account)) throw new Error("转账缺少有效的目标账户");
        const rawCategory = get("category") || "未分类";
        const positiveType = this.typeEffect(type) === "positive";
        const validCategories = new Set(positiveType ? settings.incomeCategories : settings.categories);
        const category = normalizeMetadata && rawCategory !== "未分类" && !validCategories.has(rawCategory)
          ? (positiveType ? settings.defaultIncomeCategory : settings.defaultCategory) || "未分类"
          : rawCategory;
        const rawNecessity = get("necessity");
        const draft: TransactionDraft = {
          date,
          time,
          type,
          necessity: rawNecessity === "非必需" ? "非必需" : normalizeMetadata && rawNecessity !== "必需" ? settings.defaultNecessity : "必需",
          category,
          account,
          targetAccount,
          title,
          amount,
          expression: get("expression") || String(amount),
          note: get("note"),
          tags: [...new Set(get("tags").split(/[\s,，]+/).map((tag) => tag.replace(/^#/, "")).filter(Boolean))],
          attachments: get("attachments").split(/[|,，\n]+/).map((path) => path.trim()).filter(Boolean)
        };
        const fingerprint = this.fingerprint(draft);
        if (existing.has(fingerprint)) {
          skipped++;
          throw new Error("疑似重复账目，已跳过");
        }
        await this.create(draft);
        existing.add(fingerprint);
        imported++;
      } catch (error) {
        failures.push({ row: index + 2, reason: errorMessageZh(error, "该行数据无法导入"), raw: row });
      }
      if ((index + 1) % 10 === 0 || index + 1 === dataRows.length) onProgress?.(index + 1, dataRows.length);
    }
    const realFailures = failures.filter((failure) => !failure.reason.includes("重复"));
    const failureReport = failures.length ? await this.writeImportFailureReport(headers, failures) : undefined;
    return { imported, skipped, failures: realFailures, failureReport };
  }

  private fromFrontmatter(file: TFile, frontmatter: Frontmatter): Transaction | null {
    const typeValue = String(frontmatter["类型"] ?? "").trim();
    if (!typeValue) return null;
    const date = normalizeDate(frontmatter["日期"] ?? frontmatter["时间"]);
    const amount = Number(frontmatter["金额"]);
    if (!date || !Number.isFinite(amount)) return null;
    const necessityValue = String(frontmatter["标签"] ?? "").trim();
    const necessity = necessityValue || this.getSettings().defaultNecessity;
    const tagsValue = frontmatter["tags"];
    const frontmatterTags = Array.isArray(tagsValue)
      ? tagsValue.map(String)
      : typeof tagsValue === "string" ? tagsValue.split(/[ ,，]+/).filter(Boolean) : [];
    const rawNote = String(frontmatter["备注"] ?? "");
    const extracted = this.extractExpression(rawNote, String(frontmatter["算式"] ?? ""), Math.abs(roundMoney(amount)));
    const note = extracted.note;
    const noteTags = [...note.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((match) => match[1] ?? "").filter(Boolean);
    const tags = [...new Set([...frontmatterTags, ...noteTags].map((tag) => tag.replace(/^#/, "")))];
    return {
      id: String(frontmatter["账目ID"] ?? file.path),
      file,
      legacy: frontmatter["记账插件"] !== true
        || "日期" in frontmatter
        || "时刻" in frontmatter
        || !frontmatter["账目ID"]
        || !frontmatter["分类"]
        || !frontmatter["账户"]
        || !frontmatter["内容"]
        || !("算式" in frontmatter),
      date,
      time: String(frontmatter["时刻"] ?? normalizeTime(frontmatter["时间"])),
      type: typeValue,
      necessity,
      category: String(frontmatter["分类"] ?? "未分类"),
      account: String(frontmatter["账户"] ?? this.getSettings().defaultAccount),
      targetAccount: String(frontmatter["目标账户"] ?? ""),
      title: String(frontmatter["内容"] ?? file.basename),
      amount: Math.abs(roundMoney(amount)),
      expression: extracted.expression,
      note,
      tags,
      attachments: this.readStringList(frontmatter["附件"])
    };
  }

  private toFrontmatter(draft: TransactionDraft, id: string): Frontmatter {
    return {
      "记账插件": true,
      "账目ID": id,
      "时间": `${draft.date} ${draft.time}`,
      "类型": draft.type,
      "标签": draft.necessity,
      "分类": draft.category || "未分类",
      "账户": draft.account || this.getSettings().defaultAccount,
      ...(draft.type === "转账" ? { "目标账户": draft.targetAccount } : {}),
      "内容": draft.title,
      "金额": roundMoney(draft.amount),
      "算式": this.normalizedExpression(draft),
      "备注": this.storedNote(draft),
      "tags": ["记账", ...draft.tags.filter((tag) => tag !== "记账")],
      ...(draft.attachments.length ? { "附件": draft.attachments } : {})
    };
  }

  private normalizedExpression(draft: Pick<TransactionDraft, "expression" | "amount">): string {
    return draft.expression.trim() || String(roundMoney(draft.amount));
  }

  private storedNote(draft: TransactionDraft): string {
    const note = !draft.note || draft.note === "无" ? "" : draft.note.trim();
    if (!this.getSettings().saveExpressionInNote) return note || "无";
    const expression = this.normalizedExpression(draft);
    return note ? `${note}\n算式：${expression}` : `算式：${expression}`;
  }

  private extractExpression(rawNote: string, storedExpression: string, amount: number): { note: string; expression: string } {
    let note = rawNote === "无" ? "" : rawNote.trim();
    let expression = storedExpression.trim();
    const explicit = note.match(/(?:^|\n)\s*(?:算式|计算式|金额算式)\s*[:：]\s*([^\n]+)\s*$/i);
    if (explicit?.[1]) {
      if (!expression) expression = explicit[1].trim();
      note = note.replace(explicit[0], "").trim();
    }
    const trailing = note.match(/^(.*?)[（(]\s*([\d.＋+\-－—*/×÷()（）\s]+)\s*[）)]$/);
    if (trailing?.[2] && /[+\-－—*/×÷]/.test(trailing[2])) {
      if (!expression) expression = trailing[2].trim();
      note = (trailing[1] ?? "").trim();
    } else if (/^[\d.＋+\-－—*/×÷()（）\s]+$/.test(note) && /[+\-－—*/×÷]/.test(note)) {
      if (!expression) expression = note;
      note = "";
    }
    return { note: note || "无", expression: expression || String(amount) };
  }

  private readStringList(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
    if (typeof value === "string") return value.split(/[\n,，]+/).map((item) => item.trim()).filter(Boolean);
    return [];
  }

  private toDraft(item: Transaction): TransactionDraft {
    return {
      date: item.date,
      time: item.time,
      type: item.type,
      necessity: item.necessity,
      category: item.category,
      account: item.account,
      targetAccount: item.targetAccount,
      title: item.title,
      amount: item.amount,
      expression: item.expression || String(item.amount),
      note: item.note === "无" ? "" : item.note,
      tags: [...item.tags],
      attachments: [...item.attachments]
    };
  }

  private fingerprint(item: Pick<TransactionDraft, "date" | "time" | "type" | "amount" | "title">): string {
    return `${item.date}|${item.time}|${item.type}|${roundMoney(item.amount)}|${item.title.trim().toLocaleLowerCase("zh-CN")}`;
  }

  private replaceTagInNote(note: string, oldTag: string, replacement: string | null): string {
    const escaped = oldTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`#${escaped}(?=$|[\\s,，。.!！？;；])`, "gu");
    const next = note.replace(pattern, replacement ? `#${replacement}` : "").replace(/\s{2,}/g, " ").trim();
    return next === "无" ? "" : next;
  }

  private async writeImportFailureReport(headers: string[], failures: ImportFailure[]): Promise<TFile> {
    const folder = safeFolder(this.getSettings().exportFolder);
    await this.ensureFolder(folder);
    const lines = ["行号,失败原因," + headers.map(escapeCsv).join(","), ...failures.map((failure) => [failure.row, failure.reason, ...failure.raw].map(escapeCsv).join(","))];
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return this.app.vault.create(normalizePath(`${folder}/CSV导入失败-${stamp}.csv`), `\uFEFF${lines.join("\n")}`);
  }

  private availableMarkdownPath(originalPath: string): string {
    if (!this.app.vault.getAbstractFileByPath(originalPath)) return originalPath;
    const dot = originalPath.toLowerCase().endsWith(".md") ? originalPath.length - 3 : originalPath.length;
    const base = originalPath.slice(0, dot);
    let index = 2;
    let path = `${base}-${index}.md`;
    while (this.app.vault.getAbstractFileByPath(path)) path = `${base}-${++index}.md`;
    return path;
  }

  private uniquePath(folder: string, baseName: string): string {
    let index = 1;
    let path = normalizePath(`${folder}/${baseName}.md`);
    while (this.app.vault.getAbstractFileByPath(path)) {
      index++;
      path = normalizePath(`${folder}/${baseName}-${index}.md`);
    }
    return path;
  }

  private uniqueFilePath(folder: string, baseName: string, extension: string): string {
    const suffix = extension ? `.${extension}` : "";
    let index = 1;
    let path = normalizePath(`${folder}/${baseName}${suffix}`);
    while (this.app.vault.getAbstractFileByPath(path)) path = normalizePath(`${folder}/${baseName}-${++index}${suffix}`);
    return path;
  }

  private attachmentSection(paths: string[]): string {
    if (!paths.length) return "";
    const attachments = paths.map((path) => {
      const safePath = path.replace(/\]\]/g, "] ]");
      const fileName = path.split("/").pop()?.replace(/[|\]]/g, " ") || "查看附件";
      return `![[${safePath}]]\n[[${safePath}|📎 ${fileName}]]`;
    }).join("\n\n");
    return `\n<!-- bookkeeping-attachments:start -->\n## 关联附件\n${attachments}\n<!-- bookkeeping-attachments:end -->\n`;
  }

  private async syncAttachmentSection(file: TFile, paths: string[]): Promise<void> {
    const content = await this.app.vault.read(file);
    const pattern = /\n?<!-- bookkeeping-attachments:start -->[\s\S]*?<!-- bookkeeping-attachments:end -->\n?/g;
    const withoutManaged = content.replace(pattern, "\n").replace(/\n{3,}/g, "\n\n").trimEnd();
    const next = `${withoutManaged}${this.attachmentSection(paths)}`;
    if (next !== content) await this.app.vault.modify(file, next);
  }

  private async ensureFolder(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (!normalized) return;
    let current = "";
    for (const part of normalized.split("/")) {
      current = current ? `${current}/${part}` : part;
      if (this.app.vault.getAbstractFileByPath(current) || await this.app.vault.adapter.exists(current)) continue;
      try {
        await this.app.vault.createFolder(current);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        const exists = Boolean(this.app.vault.getAbstractFileByPath(current)) || await this.app.vault.adapter.exists(current);
        if (!exists && !/folder.*already exists|already exists.*folder|eexist/i.test(message)) throw error;
      }
    }
  }

  private makeId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

}
