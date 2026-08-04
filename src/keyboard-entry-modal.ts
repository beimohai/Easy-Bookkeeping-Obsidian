import { App, Modal, Notice } from "obsidian";
import type { BookkeepingSettings, OptionField, TransactionDraft } from "./types";
import { OPTION_FIELD_LABELS } from "./types";
import type { TransactionStore } from "./transaction-store";
import { currentMonth, currentTime, errorMessageZh, evaluateAmount, formatMoney, formatMonthDisplay, today } from "./utils";
import { translate } from "./locales";

type KeyboardStep = "day" | OptionField | "targetAccount" | "title" | "amount" | "note" | "attachments";

export class KeyboardEntryModal extends Modal {
  private readonly month: string;
  private draft: TransactionDraft;
  private step: KeyboardStep = "day";
  private lastDay: string;
  private pendingAttachments: File[] = [];
  private activeOption = 0;
  private inputEl!: HTMLInputElement;
  private errorEl!: HTMLElement;

  constructor(
    app: App,
    private readonly store: TransactionStore,
    private readonly settings: BookkeepingSettings,
    month: string,
    private readonly onSaved: () => Promise<void>
  ) {
    super(app);
    this.month = /^\d{4}-\d{2}$/.test(month) ? month : currentMonth();
    const days = new Date(Number(this.month.slice(0, 4)), Number(this.month.slice(5, 7)), 0).getDate();
    this.lastDay = String(Math.min(Number(today().slice(8, 10)), days)).padStart(2, "0");
    this.draft = this.newDraft();
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal", "bookkeeping-keyboard-modal");
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const content = this.contentEl;
    content.empty();
    const header = content.createDiv({ cls: "bookkeeping-keyboard-header" });
    const titleWrap = header.createDiv();
    titleWrap.createEl("h2", { text: this.settings.desktopContinuousEntry ? "桌面版连续记账" : "桌面版记账" });
    titleWrap.createDiv({ cls: "bookkeeping-keyboard-month", text: `记账月份：${formatMonthDisplay(this.month, this.settings.yearMonthDisplayFormat, this.settings.language)}` });

    const steps = this.steps();
    const index = Math.max(steps.indexOf(this.step), 0);
    const progress = content.createDiv({ cls: "bookkeeping-keyboard-progress" });
    progress.createDiv({ cls: "bookkeeping-keyboard-progress-fill", attr: { style: `width:${(index + 1) / steps.length * 100}%` } });
    content.createDiv({ cls: "bookkeeping-keyboard-step", text: `${index + 1}/${steps.length}　${this.stepTitle(this.step)}` });

    const optionValues = this.optionValues(this.step);
    const optionCodes = this.optionCodes(this.step, optionValues);
    if (optionValues.length) {
      const list = content.createDiv({ cls: "bookkeeping-keyboard-options" });
      optionValues.forEach((value, optionIndex) => {
        const item = list.createDiv({ cls: `bookkeeping-keyboard-option${optionIndex === this.activeOption ? " is-active" : ""}` });
        item.createSpan({ cls: "bookkeeping-option-number", text: optionCodes[optionIndex] ?? String(optionIndex + 1) });
        item.createSpan({ text: value });
        item.addEventListener("click", () => {
          this.activeOption = optionIndex;
          this.inputEl.value = optionCodes[optionIndex] ?? String(optionIndex + 1);
          void this.advance();
        });
      });
    }
    if (this.step === "attachments") this.renderAttachmentUploader(content);

    this.inputEl = content.createEl("input", {
      type: "text",
      cls: "bookkeeping-keyboard-input",
      placeholder: this.placeholder(this.step)
    });
    this.inputEl.value = this.initialInputValue(this.step, optionValues);
    if (this.step === "attachments") this.inputEl.readOnly = true;
    this.inputEl.addEventListener("keydown", (event) => {
      if (this.matchesShortcut(event, this.settings.keyboardShortcuts.close)) {
        event.preventDefault();
        event.stopPropagation();
        this.close();
      } else if (this.matchesShortcut(event, this.settings.keyboardShortcuts.back)) {
        event.preventDefault();
        event.stopPropagation();
        this.goBack();
      } else if (this.matchesShortcut(event, this.settings.keyboardShortcuts.confirm)) {
        event.preventDefault();
        void this.advance();
      } else if (optionValues.length && (this.matchesShortcut(event, this.settings.keyboardShortcuts.next) || this.matchesShortcut(event, this.settings.keyboardShortcuts.previous))) {
        event.preventDefault();
        const direction = this.matchesShortcut(event, this.settings.keyboardShortcuts.next) ? 1 : -1;
        this.activeOption = (this.activeOption + direction + optionValues.length) % optionValues.length;
        this.inputEl.value = optionCodes[this.activeOption] ?? String(this.activeOption + 1);
        this.renderOptionHighlight();
      }
    });

    this.errorEl = content.createDiv({ cls: "bookkeeping-form-error" });
    content.createDiv({ cls: "bookkeeping-keyboard-help", text: `${this.displayKey(this.settings.keyboardShortcuts.confirm)}确认　${this.displayKey(this.settings.keyboardShortcuts.previous)}/${this.displayKey(this.settings.keyboardShortcuts.next)}选择　${this.displayKey(this.settings.keyboardShortcuts.back)}返回　${this.displayKey(this.settings.keyboardShortcuts.close)}关闭` });
    window.setTimeout(() => {
      this.inputEl.focus();
      this.inputEl.select();
    }, 0);
  }

  private async advance(): Promise<void> {
    try {
      this.errorEl.empty();
      const value = this.inputEl.value.trim();
      const currentStep = this.step;
      const choices = this.optionValues(currentStep);
      if (currentStep === "day") {
        const day = Number(value);
        const days = new Date(Number(this.month.slice(0, 4)), Number(this.month.slice(5, 7)), 0).getDate();
        if (!Number.isInteger(day) || day < 1 || day > days) throw new Error(`请输入1—${days}之间的日期`);
        this.lastDay = String(day).padStart(2, "0");
        this.draft.date = `${this.month}-${this.lastDay}`;
      } else if (choices.length) {
        const selected = this.resolveChoice(value, choices, this.optionCodes(currentStep, choices));
        if (!selected) throw new Error("请输入选项编号或完整名称");
        this.applyOption(currentStep, selected);
      } else if (currentStep === "title") {
        if (!value || /^\d+$/.test(value)) throw new Error("内容不能为空或纯数字");
        this.draft.title = value;
      } else if (currentStep === "amount") {
        this.draft.expression = value;
        this.draft.amount = evaluateAmount(value);
      } else if (currentStep === "note") {
        this.draft.note = value;
        this.draft.tags = [...new Set([...value.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((match) => match[1] ?? "").filter(Boolean))];
      }

      const rebuilt = this.steps();
      const currentIndex = rebuilt.indexOf(currentStep);
      if (currentIndex >= rebuilt.length - 1) return void await this.finishSave();
      this.step = rebuilt[Math.min(currentIndex + 1, rebuilt.length - 1)] ?? "day";
      this.activeOption = 0;
      this.render();
    } catch (error) {
      this.errorEl.setText(errorMessageZh(error, "输入无效，请检查当前步骤"));
      this.inputEl.focus();
      this.inputEl.select();
    }
  }

  private steps(): KeyboardStep[] {
    const optionSteps = this.settings.optionFieldOrder.filter((field) => {
      if (field === "account") return this.settings.enableAccount;
      if (field === "category") return this.settings.enableCategory && this.draft.type !== "转账";
      if (field === "type") return this.settings.enableType;
      if (field === "necessity") return this.settings.enableNecessity && this.draft.type !== "转账";
      if (field === "attachments") return this.settings.enableEntryAttachments;
      return false;
    });
    const result: KeyboardStep[] = ["day", ...optionSteps];
    if (this.draft.type === "转账" && this.settings.enableAccount) result.push("targetAccount");
    result.push("title", "amount", "note");
    return result;
  }

  private optionValues(step: KeyboardStep): string[] {
    if (step === "account" || step === "targetAccount") return this.settings.accounts.map((account) => account.name);
    if (step === "type") return this.settings.typeOrder.filter((type) => this.settings.enableAccount || type !== "转账").map((type) => this.settings.typeLabels[type] ?? type);
    if (step === "necessity") return this.settings.necessityOrder.map((value) => this.settings.necessityLabels[value] ?? value);
    if (step === "category") return this.settings.typeEffects[this.draft.type] === "positive" ? this.settings.incomeCategories : this.settings.categories;
    return [];
  }

  private optionCodes(step: KeyboardStep, choices: string[]): string[] {
    if (step === "account" || step === "targetAccount") {
      return choices.map((choice, index) => this.settings.accounts.find((account) => account.name === choice)?.code || String(index + 1));
    }
    if (step === "type") return choices.map((choice, index) => {
      const type = this.settings.typeOrder.find((value) => this.settings.typeLabels[value] === choice);
      return type ? (this.settings.typeCodes[type] ?? String(index + 1)) : String(index + 1);
    });
    if (step === "necessity") return choices.map((choice, index) => {
      const value = this.settings.necessityOrder.find((item) => this.settings.necessityLabels[item] === choice);
      return value ? (this.settings.necessityCodes[value] ?? String(index + 1)) : String(index + 1);
    });
    if (step === "category") {
      const codes = this.settings.typeEffects[this.draft.type] === "positive" ? this.settings.incomeCategoryCodes : this.settings.categoryCodes;
      return choices.map((choice, index) => codes[choice] || String(index + 1));
    }
    return [];
  }

  private applyOption(step: KeyboardStep, value: string): void {
    if (step === "account") this.draft.account = value;
    else if (step === "targetAccount") {
      if (value === this.draft.account) throw new Error("转入账户不能与转出账户相同");
      this.draft.targetAccount = value;
    } else if (step === "type") this.draft.type = this.settings.typeOrder.find((type) => this.settings.typeLabels[type] === value) ?? this.draft.type;
    else if (step === "necessity") this.draft.necessity = this.settings.necessityOrder.find((item) => this.settings.necessityLabels[item] === value) ?? this.draft.necessity;
    else if (step === "category") this.draft.category = value;
  }

  private resolveChoice(input: string, choices: string[], codes: string[]): string | null {
    const codeIndex = codes.findIndex((code) => code.toLocaleLowerCase() === input.toLocaleLowerCase());
    if (codeIndex >= 0) return choices[codeIndex] ?? null;
    const numeric = Number(input);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= choices.length) return choices[numeric - 1] ?? null;
    const exact = choices.find((choice) => choice === input);
    if (exact) return exact;
    const matches = choices.filter((choice) => choice.toLocaleLowerCase("zh-CN").includes(input.toLocaleLowerCase("zh-CN")));
    return matches.length === 1 ? matches[0] ?? null : null;
  }

  private initialInputValue(step: KeyboardStep, choices: string[]): string {
    if (step === "day") return this.lastDay;
    if (!choices.length) return "";
    const current = step === "account" ? this.draft.account
      : step === "targetAccount" ? this.draft.targetAccount
      : step === "type" ? (this.settings.typeLabels[this.draft.type] ?? this.draft.type)
      : step === "necessity" ? (this.settings.necessityLabels[this.draft.necessity] ?? this.draft.necessity)
      : this.draft.category;
    const index = Math.max(choices.indexOf(current), 0);
    this.activeOption = index;
    return this.optionCodes(step, choices)[index] ?? String(index + 1);
  }

  private placeholder(step: KeyboardStep): string {
    if (step === "day") return "输入日期中的日，例如21";
    if (this.optionValues(step).length) return "输入编号，直接回车使用默认值";
    if (step === "title") return "输入账目内容";
    if (step === "amount") return "输入金额或算式，例如11.4+5.1";
    if (step === "attachments") return this.steps().at(-1) === step ? "按Enter保存，可先拖入或选择附件" : "按Enter继续，可先拖入或选择附件";
    return "输入备注；无备注直接回车";
  }

  private stepTitle(step: KeyboardStep): string {
    if (step === "day") return "输入日期";
    if (step === "targetAccount") return "选择转入账户";
    if (step === "title") return "输入内容";
    if (step === "amount") return "输入金额";
    if (step === "note") return this.steps().at(-1) === step ? "输入备注并保存" : "输入备注";
    if (step === "attachments") return this.steps().at(-1) === step ? "添加附件并保存" : "添加附件";
    return `选择${OPTION_FIELD_LABELS[step]}`;
  }

  private renderOptionHighlight(): void {
    this.contentEl.querySelectorAll(".bookkeeping-keyboard-option").forEach((item, index) => {
      item.toggleClass("is-active", index === this.activeOption);
    });
  }

  private goBack(): void {
    const steps = this.steps();
    const index = steps.indexOf(this.step);
    if (index <= 0) return;
    this.step = steps[index - 1] ?? "day";
    this.activeOption = 0;
    this.render();
  }

  private displayKey(key: string): string {
    const labels: Record<string, string> = { Escape: "Esc", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Backspace: "⌫", Delete: "Del", Meta: "Cmd" };
    return key.split("+").map((part) => labels[part] ?? part).join("+");
  }

  private matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
    const parts = shortcut.split("+").map((part) => part.trim().toLocaleLowerCase()).filter(Boolean);
    const key = parts.find((part) => !["ctrl", "control", "meta", "cmd", "command", "alt", "option", "shift"].includes(part));
    if (!key) return false;
    const wantsCtrl = parts.includes("ctrl") || parts.includes("control");
    const wantsMeta = parts.includes("meta") || parts.includes("cmd") || parts.includes("command");
    const wantsAlt = parts.includes("alt") || parts.includes("option");
    const wantsShift = parts.includes("shift");
    const eventKey = event.key === " " ? "space" : event.key.toLocaleLowerCase();
    return event.ctrlKey === wantsCtrl && event.metaKey === wantsMeta && event.altKey === wantsAlt && event.shiftKey === wantsShift && eventKey === key;
  }

  private async finishSave(): Promise<void> {
    for (const file of this.pendingAttachments) {
      const stored = await this.store.saveAttachment(file, this.draft);
      this.draft.attachments = [...new Set([...this.draft.attachments, stored.path])];
    }
    this.pendingAttachments = [];
    await this.store.create(this.draft);
    new Notice(`${translate("已记录：", this.settings.language)}${this.draft.title} ${formatMoney(this.draft.amount, this.settings.currency, this.settings.numberGrouping)}`, 1800);
    await this.onSaved();
    if (!this.settings.desktopContinuousEntry) {
      this.close();
      return;
    }
    this.draft = this.newDraft(this.draft);
    this.step = "day";
    this.render();
  }

  private renderAttachmentUploader(content: HTMLElement): void {
    const area = content.createDiv({ cls: "bookkeeping-keyboard-attachment-dropzone", text: "拖动小票或发票到这里，或点击选择文件" });
    const input = area.createEl("input", { type: "file", attr: { multiple: "true", "aria-label": "选择附件" } });
    const list = content.createDiv({ cls: "bookkeeping-keyboard-attachment-list" });
    const renderList = (): void => {
      list.empty();
      this.pendingAttachments.forEach((file, index) => {
        const chip = list.createSpan({ cls: "bookkeeping-attachment-chip is-pending" });
        chip.createSpan({ text: file.name });
        const remove = chip.createEl("button", { text: "×", attr: { "aria-label": `移除${file.name}` } });
        remove.addEventListener("click", (event) => {
          event.stopPropagation();
          this.pendingAttachments.splice(index, 1);
          renderList();
        });
      });
    };
    const addFiles = (files: FileList): void => {
      const keys = new Set(this.pendingAttachments.map((file) => `${file.name}|${file.size}|${file.lastModified}`));
      for (const file of Array.from(files)) {
        const key = `${file.name}|${file.size}|${file.lastModified}`;
        if (!keys.has(key)) this.pendingAttachments.push(file);
        keys.add(key);
      }
      renderList();
    };
    input.addEventListener("change", () => {
      if (input.files) addFiles(input.files);
      input.value = "";
      window.setTimeout(() => this.inputEl.focus(), 0);
    });
    area.addEventListener("dragover", (event) => { event.preventDefault(); area.addClass("is-dragover"); });
    area.addEventListener("dragleave", () => area.removeClass("is-dragover"));
    area.addEventListener("drop", (event) => {
      event.preventDefault();
      area.removeClass("is-dragover");
      if (event.dataTransfer?.files) addFiles(event.dataTransfer.files);
      this.inputEl.focus();
    });
    renderList();
  }

  private newDraft(previous?: TransactionDraft): TransactionDraft {
    const accountNames = this.settings.accounts.map((account) => account.name);
    const account = previous?.account || (accountNames.includes(this.settings.defaultAccount) ? this.settings.defaultAccount : (accountNames[0] ?? ""));
    const type = previous?.type ?? this.settings.defaultType;
    return {
      date: `${this.month}-${this.lastDay}`,
      time: currentTime(),
      type: this.settings.enableAccount ? type : (type === "转账" ? "支出" : type),
      necessity: previous?.necessity ?? this.settings.defaultNecessity,
      category: this.settings.enableCategory ? (previous?.category || (this.settings.typeEffects[type] === "positive" ? this.settings.defaultIncomeCategory : this.settings.defaultCategory)) : "未分类",
      account,
      targetAccount: this.settings.enableAccount ? (previous?.targetAccount || accountNames.find((name) => name !== account) || account) : "",
      title: "",
      amount: 0,
      expression: "",
      note: "",
      tags: [],
      attachments: []
    };
  }
}
