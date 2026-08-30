import { App, TFile, normalizePath, parseYaml, stringifyYaml } from "obsidian";
import { customFieldDefaultValue, customFieldKey, isReservedTransactionProperty } from "./types";
import type { BookkeepingSettings, CustomFieldConfig, EntryField, MonthSummary, Transaction, TransactionDraft } from "./types";
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

export interface LegacyConversionResult {
  converted: number;
  skipped: number;
  failed: number;
  total: number;
  failureFolder?: string;
}

export interface ExternalLegacyImportResult {
  imported: number;
  skipped: number;
  failed: number;
  total: number;
  failureFolder?: string;
}

interface LegacyFailureSource {
  name: string;
  path: string;
  reason: string;
  content: string;
}

interface VaultLegacyCandidate {
  file: TFile;
  content: string;
  draft?: TransactionDraft;
  reason?: string;
}

export interface CsvMetadataAnalysis {
  differences: string[];
  hasDifferences: boolean;
}

export interface CsvCustomFieldConfiguration {
  version: 1;
  builtInEnabled: {
    account: boolean;
    type: boolean;
    necessity: boolean;
    category: boolean;
    note: boolean;
    attachments: boolean;
  };
  fields: CustomFieldConfig[];
  optionFieldOrder: EntryField[];
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
  includeFieldConfig?: boolean;
}

const CSV_FIELD_CONFIG_PREFIX = "#EasyBookkeepingCustomFields=";

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

  async create(draft: TransactionDraft, skipContentCheck = false): Promise<TFile> {
    const settings = this.getSettings();
    if (!skipContentCheck) await this.assertContentAvailable(draft.title, "", draft.date);
    const [year = "0000", month = "00", day = "00"] = draft.date.split("-");
    const folder = normalizePath(`${safeFolder(settings.ledgerFolder)}/${year}/${month}/${day}`);
    await this.ensureFolder(folder);

    const timePart = draft.time.replace(":", "");
    const baseName = `${timePart}-${sanitizeFileName(draft.title)}`;
    const path = this.uniquePath(folder, baseName);
    const attachments = settings.enableEntryAttachments ? draft.attachments : [];
    const content = `---\n${stringifyYaml(this.toFrontmatter(draft))}---\n${this.attachmentSection(attachments)}`;
    return this.app.vault.create(path, content);
  }

  async update(transaction: Transaction, draft: TransactionDraft): Promise<void> {
    if (draft.title.trim().toLocaleLowerCase() !== transaction.title.trim().toLocaleLowerCase()) {
      await this.assertContentAvailable(draft.title, transaction.id, draft.date);
    }
    const dateChanged = draft.date !== transaction.date;
    await this.app.fileManager.processFrontMatter(transaction.file, (frontmatter) => {
      const properties = frontmatter as Frontmatter;
      const next = this.toFrontmatter(draft);
      delete properties["日期"];
      delete properties["时刻"];
      for (const key of ["记账插件", "账目ID", "类型", "标签", "分类", "账户", "目标账户", "内容", "金额", "算式", "备注", "附件", "tags"]) delete properties[key];
      for (const field of this.getSettings().customFields) delete properties[field.property];
      Object.assign(properties, next);
    });
    await this.syncAttachmentSection(transaction.file, this.getSettings().enableEntryAttachments ? draft.attachments : []);
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
    return (await this.scanVaultLegacyCandidates(folder)).length;
  }

  async convertLegacyFiles(onProgress?: (done: number, total: number) => void, folder = ""): Promise<LegacyConversionResult> {
    const candidates = await this.scanVaultLegacyCandidates(folder);
    const existing = new Set((await this.list()).filter((item) => !item.legacy).map((item) => this.fingerprint(item)));
    const failures: LegacyFailureSource[] = [];
    let converted = 0, skipped = 0;
    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index] as VaultLegacyCandidate;
      const draft = candidate.draft;
      if (!draft) {
        failures.push({ name: candidate.file.name, path: candidate.file.path, reason: candidate.reason ?? "无法读取旧版账目属性", content: candidate.content });
      } else {
        try {
          const fingerprint = this.fingerprint(draft);
          if (existing.has(fingerprint)) skipped++;
          else {
            await this.create(draft, true);
            existing.add(fingerprint);
            converted++;
          }
        } catch (error) {
          failures.push({ name: candidate.file.name, path: candidate.file.path, reason: errorMessageZh(error, "转换失败"), content: candidate.content });
        }
      }
      if ((index + 1) % 10 === 0 || index + 1 === candidates.length) onProgress?.(index + 1, candidates.length);
    }
    const failureFolder = failures.length ? await this.writeLegacyFailureFolder(failures) : undefined;
    return { converted, skipped, failed: failures.length, total: candidates.length, failureFolder };
  }

  async importExternalLegacyMarkdown(files: Array<{ name: string; path?: string; content: string }>, onProgress?: (done: number, total: number) => void): Promise<ExternalLegacyImportResult> {
    const existing = new Set((await this.list()).map((item) => this.fingerprint(item)));
    const failures: LegacyFailureSource[] = [];
    let imported = 0, skipped = 0;
    for (let index = 0; index < files.length; index++) {
      const source = files[index] as { name: string; path?: string; content: string };
      try {
        const match = source.content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (!match?.[1]) throw new Error("缺少Properties");
        const parsed: unknown = parseYaml(match[1]);
        if (!isFrontmatter(parsed)) throw new Error("Properties格式不合法");
        const frontmatter = parsed;
        const draft = this.legacyDraftFromProperties(frontmatter, source.path ?? source.name, source.name.replace(/\.md$/i, ""));
        const fingerprint = this.fingerprint(draft);
        if (existing.has(fingerprint)) {
          skipped++;
        } else {
          await this.create(draft); existing.add(fingerprint); imported++;
        }
      } catch (error) {
        failures.push({
          name: source.name,
          path: source.path ?? source.name,
          reason: errorMessageZh(error, "无法转换该文件"),
          content: source.content
        });
      }
      if ((index + 1) % 10 === 0 || index + 1 === files.length) onProgress?.(index + 1, files.length);
    }
    const failureFolder = failures.length ? await this.writeLegacyFailureFolder(failures) : undefined;
    return { imported, skipped, failed: failures.length, total: files.length, failureFolder };
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

  async renameCustomFieldValueGlobally(property: string, oldValue: string, newValue: string): Promise<number> {
    if (!property || !oldValue || !newValue || oldValue === newValue) return 0;
    const root = `${safeFolder(this.getSettings().ledgerFolder)}/`;
    const files = this.app.vault.getMarkdownFiles().filter((file) => {
      if (!file.path.startsWith(root)) return false;
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      return isFrontmatter(frontmatter) && String(frontmatter[property] ?? "") === oldValue;
    });
    for (const file of files) {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        if (String((frontmatter as Frontmatter)[property] ?? "") === oldValue) (frontmatter as Frontmatter)[property] = newValue;
      });
    }
    return files.length;
  }

  async clearCustomFieldProperties(properties: string[], onProgress?: (done: number, total: number) => void): Promise<number> {
    const propertySet = new Set(properties.map((property) => property.trim()).filter(Boolean));
    if (!propertySet.size) return 0;
    const root = `${safeFolder(this.getSettings().ledgerFolder)}/`;
    const files = this.app.vault.getMarkdownFiles().filter((file) => {
      if (!file.path.startsWith(root)) return false;
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      return isFrontmatter(frontmatter) && [...propertySet].some((property) => property in frontmatter);
    });
    for (const [index, file] of files.entries()) {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        for (const property of propertySet) delete (frontmatter as Frontmatter)[property];
      });
      if ((index + 1) % 10 === 0 || index + 1 === files.length) onProgress?.(index + 1, files.length);
    }
    return files.length;
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
    const settings = this.getSettings();
    const customFields = settings.customFields;
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
      ...customFields.map((field) => item.customValues[field.id] ?? ""),
      item.file.path
    ].map(escapeCsv).join(","));
    const header = ["日期", "时间", "类型", "标签", "分类", "账户", "目标账户", "内容", "金额", "算式", "备注", "附加标签", "附件", ...customFields.map((field) => field.name), "文件"];
    const csv = [header.map(escapeCsv).join(","), ...rows].join("\n");
    const configuration = options.includeFieldConfig
      ? `${CSV_FIELD_CONFIG_PREFIX}${encodeURIComponent(JSON.stringify({
        version: 1,
        builtInEnabled: {
          account: settings.enableAccount,
          type: settings.enableType,
          necessity: settings.enableNecessity,
          category: settings.enableCategory,
          note: settings.enableNote,
          attachments: settings.enableEntryAttachments
        },
        fields: customFields.map((field) => ({ ...field, options: [...field.options] })),
        optionFieldOrder: [...settings.optionFieldOrder]
      } satisfies CsvCustomFieldConfiguration))}\n`
      : "";
    return `\uFEFF${configuration}${csv}`;
  }

  inspectCsvCustomFieldConfiguration(text: string): CsvCustomFieldConfiguration | null {
    return this.splitCsvDocument(text).configuration;
  }

  validateCsvImportStructure(text: string): void {
    const rows = parseCsv(this.splitCsvDocument(text).body);
    if (rows.length < 2) throw new Error("CSV没有可导入的数据行");
    const headers = (rows[0] ?? []).map((header) => header.toLocaleLowerCase("zh-CN").replace(/[\s_-]/g, ""));
    const hasDate = headers.some((header) => ["日期", "交易日期", "date", "datetime", "时间"].includes(header));
    const hasAmount = headers.some((header) => ["金额", "交易金额", "amount", "money"].includes(header));
    if (!hasDate || !hasAmount) throw new Error("CSV至少需要日期和金额两列");
  }

  inspectCsvMetadata(text: string): CsvMetadataAnalysis {
    const rows = parseCsv(this.splitCsvDocument(text).body);
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
    for (const field of settings.customFields.filter((item) => item.kind === "select")) {
      const aliases = [field.name, field.property].map((value) => value.toLocaleLowerCase("zh-CN").replace(/[\s_-]/g, ""));
      const index = headers.findIndex((header) => aliases.includes(header));
      const unknown = unique(index).filter((value) => !field.options.includes(value));
      if (unknown.length) differences.push(`自定义字段“${field.name}”中没有的预设：${unknown.join("、")}`);
    }
    return { differences, hasDifferences: differences.length > 0 };
  }

  async importCsv(text: string, onProgress?: (done: number, total: number) => void, normalizeMetadata = false): Promise<ImportResult> {
    const rows = parseCsv(this.splitCsvDocument(text).body);
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
    const customIndexes = Object.fromEntries(this.getSettings().customFields.map((field) => {
      const aliases = [field.name, field.property].map((value) => value.toLocaleLowerCase("zh-CN").replace(/[\s_-]/g, ""));
      return [field.id, headers.findIndex((header) => aliases.includes(header))];
    }));
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
          attachments: get("attachments").split(/[|,，\n]+/).map((path) => path.trim()).filter(Boolean),
          customValues: Object.fromEntries(this.getSettings().customFields.map((field) => {
            const customIndex = customIndexes[field.id] ?? -1;
            const value = customIndex >= 0 ? String(row[customIndex] ?? "").trim() : "";
            const normalized = normalizeMetadata && field.kind === "select" && value && !field.options.includes(value) ? "" : value;
            return [field.id, normalized || customFieldDefaultValue(field)];
          }))
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

  private splitCsvDocument(text: string): { body: string; configuration: CsvCustomFieldConfiguration | null } {
    const normalized = text.replace(/^\uFEFF/, "");
    const newline = normalized.indexOf("\n");
    const firstLine = (newline >= 0 ? normalized.slice(0, newline) : normalized).replace(/\r$/, "");
    if (!firstLine.startsWith(CSV_FIELD_CONFIG_PREFIX)) return { body: text, configuration: null };
    const body = newline >= 0 ? normalized.slice(newline + 1) : "";
    try {
      const parsed: unknown = JSON.parse(decodeURIComponent(firstLine.slice(CSV_FIELD_CONFIG_PREFIX.length)));
      const configuration = this.normalizeCsvCustomFieldConfiguration(parsed);
      return { body, configuration };
    } catch {
      return { body, configuration: null };
    }
  }

  private normalizeCsvCustomFieldConfiguration(value: unknown): CsvCustomFieldConfiguration | null {
    if (!value || typeof value !== "object") return null;
    const raw = value as Record<string, unknown>;
    if (raw["version"] !== 1 || !Array.isArray(raw["fields"]) || !Array.isArray(raw["optionFieldOrder"]) || !raw["builtInEnabled"] || typeof raw["builtInEnabled"] !== "object") return null;
    const rawBuiltIn = raw["builtInEnabled"] as Record<string, unknown>;
    const builtInKeys = ["account", "type", "necessity", "category", "note", "attachments"] as const;
    if (builtInKeys.some((key) => typeof rawBuiltIn[key] !== "boolean")) return null;
    const builtInEnabled: CsvCustomFieldConfiguration["builtInEnabled"] = {
      account: rawBuiltIn["account"] as boolean,
      type: rawBuiltIn["type"] as boolean,
      necessity: rawBuiltIn["necessity"] as boolean,
      category: rawBuiltIn["category"] as boolean,
      note: rawBuiltIn["note"] as boolean,
      attachments: rawBuiltIn["attachments"] as boolean
    };
    const ids = new Set<string>();
    const properties = new Set<string>();
    const fields: CustomFieldConfig[] = [];
    for (const item of raw["fields"]) {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const id = String(source["id"] ?? "").trim();
      const name = String(source["name"] ?? "").trim();
      const property = String(source["property"] ?? name).trim();
      const normalizedProperty = property.toLocaleLowerCase("zh-CN");
      if (!/^[a-zA-Z0-9_-]+$/.test(id) || !name || !property || isReservedTransactionProperty(normalizedProperty) || ids.has(id) || properties.has(normalizedProperty)) return null;
      const kind = source["kind"] === "select" ? "select" : "text";
      const options = kind === "select" ? [...new Set((Array.isArray(source["options"]) ? source["options"] : []).map(String).map((option) => option.trim()).filter(Boolean))] : [];
      const rawCodes = source["optionCodes"] && typeof source["optionCodes"] === "object" ? source["optionCodes"] as Record<string, unknown> : {};
      const optionCodes = Object.fromEntries(options.map((option, index) => [option, String(rawCodes[option] ?? index + 1).trim() || String(index + 1)]));
      const defaultValue = options.includes(String(source["defaultValue"] ?? "")) ? String(source["defaultValue"]) : (options[0] ?? "");
      const loadedInitial = Array.isArray(source["initialOptions"])
        ? [...new Set(source["initialOptions"].map(String).map((option) => option.trim()).filter(Boolean))]
        : [];
      const initialOptions = kind === "select" && loadedInitial.length ? loadedInitial : [...options];
      const rawInitialCodes = source["initialOptionCodes"] && typeof source["initialOptionCodes"] === "object" ? source["initialOptionCodes"] as Record<string, unknown> : {};
      const initialOptionCodes = Object.fromEntries(initialOptions.map((option, index) => [option, String(rawInitialCodes[option] ?? optionCodes[option] ?? index + 1).trim() || String(index + 1)]));
      const initialDefaultValue = initialOptions.includes(String(source["initialDefaultValue"] ?? "")) ? String(source["initialDefaultValue"]) : (initialOptions[0] ?? "");
      ids.add(id);
      properties.add(normalizedProperty);
      fields.push({ id, name, property, kind, options, optionCodes, defaultValue, initialOptions, initialOptionCodes, initialDefaultValue, enabled: source["enabled"] !== false });
    }
    const builtinOrder: EntryField[] = ["date", "account", "type", "necessity", "category", "title", "amount", "note", "attachments"];
    const customKeys = fields.map((field) => customFieldKey(field.id));
    const allowed = new Set<EntryField>([...builtinOrder, ...customKeys]);
    const importedOrder = raw["optionFieldOrder"]
      .map(String)
      .filter((item): item is EntryField => allowed.has(item as EntryField));
    const optionFieldOrder = [...new Set([...importedOrder, ...builtinOrder, ...customKeys])];
    return { version: 1, builtInEnabled, fields, optionFieldOrder };
  }

  private fromFrontmatter(file: TFile, frontmatter: Frontmatter): Transaction | null {
    const typeValue = String(frontmatter["类型"] ?? this.getSettings().defaultType).trim() || this.getSettings().defaultType;
    const date = normalizeDate(frontmatter["日期"] ?? frontmatter["时间"]);
    const amount = Number(frontmatter["金额"]);
    if (!date || !Number.isFinite(amount)) return null;
    const necessityValue = String(frontmatter["标签"] ?? "").trim();
    const necessity = necessityValue || this.getSettings().defaultNecessity;
    const frontmatterTags = this.readFrontmatterTags(frontmatter["tags"]);
    const rawNote = String(frontmatter["备注"] ?? "");
    const extracted = this.extractExpression(rawNote, String(frontmatter["算式"] ?? ""), Math.abs(roundMoney(amount)));
    const note = extracted.note;
    const noteTags = [...note.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((match) => match[1] ?? "").filter(Boolean);
    const tags = [...new Set([...frontmatterTags, ...noteTags].map((tag) => tag.replace(/^#/, "")))];
    return {
      id: file.path,
      file,
      legacy: !this.isCurrentTransactionProperties(frontmatter),
      date,
      time: String(frontmatter["时刻"] ?? normalizeTime(frontmatter["时间"])),
      type: typeValue,
      necessity,
      category: String(frontmatter["分类"] ?? (this.typeEffect(typeValue) === "positive" ? this.getSettings().defaultIncomeCategory : this.getSettings().defaultCategory)),
      account: String(frontmatter["账户"] ?? this.getSettings().defaultAccount),
      targetAccount: String(frontmatter["目标账户"] ?? ""),
      title: String(frontmatter["内容"] ?? file.basename),
      amount: Math.abs(roundMoney(amount)),
      expression: extracted.expression,
      note,
      tags,
      attachments: this.readStringList(frontmatter["附件"]),
      customValues: Object.fromEntries(this.getSettings().customFields.map((field) => [field.id, String(frontmatter[field.property] ?? "").trim() || customFieldDefaultValue(field)]))
    };
  }

  private toFrontmatter(draft: TransactionDraft): Frontmatter {
    const settings = this.getSettings();
    const note = !draft.note || draft.note === "无" ? "" : draft.note.trim();
    const tags = draft.tags.filter((tag) => tag.replace(/^#/, "").trim() !== "记账");
    const customProperties = new Map(settings.customFields
      .filter((field) => field.enabled)
      .map((field) => [field.id, field.property] as const));
    for (const [id, property] of Object.entries(draft.customProperties ?? {})) {
      if (id && property.trim()) customProperties.set(id, property.trim());
    }
    return {
      "记账插件": true,
      "时间": `${draft.date} ${draft.time}`,
      ...(settings.enableType ? { "类型": draft.type } : {}),
      ...(settings.enableNecessity && draft.type !== "转账" ? { "标签": draft.necessity } : {}),
      ...(settings.enableCategory && draft.type !== "转账" ? { "分类": draft.category || "未分类" } : {}),
      ...(settings.enableAccount ? { "账户": draft.account || settings.defaultAccount } : {}),
      ...(settings.enableAccount && draft.type === "转账" ? { "目标账户": draft.targetAccount } : {}),
      "内容": draft.title,
      "金额": roundMoney(draft.amount),
      ...(settings.enableNote && settings.saveExpressionInNote ? { "算式": this.normalizedExpression(draft) } : {}),
      ...(settings.enableNote && (note || settings.saveExpressionInNote) ? { "备注": this.storedNote(draft) } : {}),
      ...(tags.length ? { "tags": tags } : {}),
      ...(settings.enableEntryAttachments && draft.attachments.length ? { "附件": draft.attachments } : {}),
      ...Object.fromEntries([...customProperties]
        .map(([id, property]) => {
          const field = settings.customFields.find((item) => item.id === id);
          const value = String(draft.customValues[id] ?? "").trim() || (field ? customFieldDefaultValue(field) : "");
          return [property, value] as const;
        })
        .filter(([, value]) => value))
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

  private readFrontmatterTags(value: unknown): string[] {
    const tags = Array.isArray(value)
      ? value.map(String)
      : typeof value === "string" ? value.split(/[ ,，]+/) : [];
    return tags.map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean);
  }

  private isCurrentTransactionProperties(frontmatter: Frontmatter): boolean {
    const marker = frontmatter["记账插件"] === true || this.readFrontmatterTags(frontmatter["tags"]).includes("记账");
    return marker && !("日期" in frontmatter) && !("时刻" in frontmatter);
  }

  private legacyDraftFromProperties(frontmatter: Frontmatter, sourcePath: string, fallbackTitle: string): TransactionDraft {
    const settings = this.getSettings();
    const date = normalizeDate(frontmatter["日期"] ?? frontmatter["时间"]) ?? this.inferDateFromPath(sourcePath);
    if (!date) throw new Error("缺少有效日期，且无法从年月日文件夹补全");
    const signedAmount = Number(frontmatter["金额"]);
    if (!Number.isFinite(signedAmount)) throw new Error("缺少有效金额");
    const type = String(frontmatter["类型"] ?? settings.defaultType).trim() || settings.defaultType;
    const rawMoment = String(frontmatter["时刻"] ?? "").trim();
    const directTime = rawMoment.match(/^(\d{1,2}):(\d{2})$/);
    const time = directTime && Number(directTime[1]) <= 23 && Number(directTime[2]) <= 59
      ? `${String(Number(directTime[1])).padStart(2, "0")}:${directTime[2]}`
      : normalizeTime(frontmatter["时间"]);
    const rawNote = String(frontmatter["备注"] ?? "");
    const extracted = this.extractExpression(rawNote, String(frontmatter["算式"] ?? ""), Math.abs(roundMoney(signedAmount)));
    const frontmatterTags = this.readFrontmatterTags(frontmatter["tags"]);
    const noteTags = [...extracted.note.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((match) => match[1] ?? "").filter(Boolean);
    const tags = [...new Set([...frontmatterTags, ...noteTags]
      .map((tag) => tag.replace(/^#/, "").trim())
      .filter((tag) => tag && tag !== "记账"))];
    return {
      date,
      time,
      type,
      necessity: String(frontmatter["标签"] ?? settings.defaultNecessity).trim() || settings.defaultNecessity,
      category: String(frontmatter["分类"] ?? (this.typeEffect(type) === "positive" ? settings.defaultIncomeCategory : settings.defaultCategory)),
      account: String(frontmatter["账户"] ?? settings.defaultAccount),
      targetAccount: String(frontmatter["目标账户"] ?? ""),
      title: String(frontmatter["内容"] ?? fallbackTitle).trim() || fallbackTitle,
      amount: Math.abs(roundMoney(signedAmount)),
      expression: extracted.expression,
      note: extracted.note === "无" ? "" : extracted.note,
      tags,
      attachments: this.readStringList(frontmatter["附件"]),
      customValues: Object.fromEntries(settings.customFields.map((field) => [field.id, String(frontmatter[field.property] ?? "").trim() || customFieldDefaultValue(field)]))
    };
  }

  private inferDateFromPath(sourcePath: string): string | null {
    const directories = sourcePath.replace(/\\/g, "/").split("/").slice(0, -1);
    for (let index = directories.length - 3; index >= 0; index--) {
      const year = directories[index]?.match(/^(\d{4})年?$/)?.[1];
      const month = directories[index + 1]?.match(/^(\d{1,2})月?$/)?.[1];
      const day = directories[index + 2]?.match(/^(\d{1,2})日?$/)?.[1];
      if (!year || !month || !day) continue;
      const normalized = normalizeDate(`${year}-${month}-${day}`);
      if (normalized) return normalized;
    }
    return null;
  }

  private async scanVaultLegacyCandidates(folder: string): Promise<VaultLegacyCandidate[]> {
    const rawFolder = folder.trim().replace(/^\/+|\/+$/g, "");
    const selectedFolder = rawFolder ? safeFolder(rawFolder) : "";
    const prefix = selectedFolder ? `${selectedFolder}/` : "";
    const candidates: VaultLegacyCandidate[] = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (prefix && !file.path.startsWith(prefix)) continue;
      const content = await this.app.vault.cachedRead(file);
      let frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!isFrontmatter(frontmatter)) {
        const match = content.match(/^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
        if (!match?.[1]) continue;
        if (!this.looksLikeLegacyProperties(match[1])) continue;
        try {
          const parsed: unknown = parseYaml(match[1]);
          if (!isFrontmatter(parsed)) {
            candidates.push({ file, content, reason: "Properties格式不合法" });
            continue;
          }
          frontmatter = parsed;
        } catch (error) {
          candidates.push({ file, content, reason: errorMessageZh(error, "Properties解析失败") });
          continue;
        }
      }
      if (!this.looksLikeTransactionProperties(frontmatter)) continue;
      const legacy = !this.isCurrentTransactionProperties(frontmatter);
      if (!legacy) continue;
      try {
        candidates.push({ file, content, draft: this.legacyDraftFromProperties(frontmatter, file.path, file.basename) });
      } catch (error) {
        candidates.push({ file, content, reason: errorMessageZh(error, "无法读取旧版账目属性") });
      }
    }
    return candidates;
  }

  private looksLikeLegacyProperties(yaml: string): boolean {
    return /^(?:记账插件|类型|金额|时间|日期|内容|分类|账户|标签)\s*:/mu.test(yaml);
  }

  private looksLikeTransactionProperties(frontmatter: Frontmatter): boolean {
    if ("记账插件" in frontmatter) return true;
    const keys = ["类型", "金额", "时间", "日期", "内容", "分类", "账户", "标签"];
    return keys.filter((key) => key in frontmatter).length >= 2 && ("金额" in frontmatter || "时间" in frontmatter || "日期" in frontmatter);
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
      attachments: [...item.attachments],
      customValues: { ...item.customValues }
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

  private async writeLegacyFailureFolder(failures: LegacyFailureSource[]): Promise<string> {
    const root = safeFolder(this.getSettings().exportFolder);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const folder = normalizePath(root ? `${root}/旧版转换失败-${stamp}` : `旧版转换失败-${stamp}`);
    await this.ensureFolder(folder);
    const reportRows: string[] = ["文件,原始路径,失败原因"];
    for (const failure of failures) {
      const baseName = sanitizeFileName(failure.name.replace(/\.md$/i, "")) || "转换失败文件";
      const copyPath = this.uniqueFilePath(folder, baseName, "md");
      await this.app.vault.create(copyPath, failure.content);
      reportRows.push([copyPath.split("/").pop() ?? failure.name, failure.path, failure.reason].map(escapeCsv).join(","));
    }
    const reportPath = this.uniqueFilePath(folder, "失败说明", "csv");
    await this.app.vault.create(reportPath, `\uFEFF${reportRows.join("\n")}`);
    return folder;
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
