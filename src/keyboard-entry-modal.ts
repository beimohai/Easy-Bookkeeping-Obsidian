import { App, Modal, Notice } from "obsidian";
import type { BookkeepingSettings, CustomFieldConfig, EntryField, TransactionDraft } from "./types";
import { ENTRY_FIELD_LABELS, customFieldDefaultValue, customFieldId, isCustomFieldKey } from "./types";
import type { TransactionStore } from "./transaction-store";
import { currentMonth, currentTime, errorMessageZh, evaluateAmount, formatMoney, formatMonthDisplay, parseNoteTags, today } from "./utils";
import { translate } from "./locales";

type KeyboardStep = EntryField | "targetAccount";

export class KeyboardEntryModal extends Modal {
  private readonly month: string;
  private draft: TransactionDraft;
  private step: KeyboardStep = "date";
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
    content.createDiv({ cls: "bookkeeping-keyboard-step", text: `${index + 1}/${steps.length} ${this.stepTitle(this.step)}` });

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
    content.createDiv({ cls: "bookkeeping-keyboard-help", text: this.helpText(this.step) });
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
      if (currentStep === "date") {
        const day = Number(value);
        const days = this.daysInMonth();
        if (!Number.isInteger(day) || day < 1 || day > days) throw new Error(`请输入1-${days}之间的日期`);
        this.lastDay = String(day).padStart(2, "0");
        this.draft.date = `${this.month}-${this.lastDay}`;
      } else if (choices.length) {
        if (isCustomFieldKey(currentStep) && !value) {
          const field = this.customField(currentStep);
          this.draft.customValues[customFieldId(currentStep)] = field ? customFieldDefaultValue(field) : "";
        } else {
        const selected = this.resolveChoice(value, choices, this.optionCodes(currentStep, choices));
        if (!selected) throw new Error(this.optionError(currentStep));
        this.applyOption(currentStep, selected);
        }
      } else if (currentStep === "title") {
        if (!value) throw new Error("内容不得为空");
        if (!this.settings.allowNumericTitle && /^\d+$/.test(value)) throw new Error("内容不能为纯数字");
        this.draft.title = value;
      } else if (currentStep === "amount") {
        if (!value && this.settings.allowEmptyAmount) {
          this.draft.expression = "";
          this.draft.amount = 0;
        } else {
          if (!value) throw new Error("金额不得为空");
          try {
            this.draft.expression = value;
            this.draft.amount = evaluateAmount(value);
          } catch {
            throw new Error("金额或算式无效");
          }
        }
      } else if (currentStep === "note") {
        const parsed = parseNoteTags(value);
        this.draft.note = parsed.note;
        this.draft.tags = parsed.tags;
      } else if (isCustomFieldKey(currentStep)) {
        this.draft.customValues[customFieldId(currentStep)] = value;
      }

      const rebuilt = this.steps();
      const currentIndex = rebuilt.indexOf(currentStep);
      if (currentIndex >= rebuilt.length - 1) return void await this.finishSave();
      this.step = rebuilt[Math.min(currentIndex + 1, rebuilt.length - 1)] ?? "date";
      this.activeOption = 0;
      this.render();
    } catch (error) {
      this.errorEl.setText(errorMessageZh(error, "输入无效，请检查当前步骤"));
      this.inputEl.focus();
      this.inputEl.select();
    }
  }

  private steps(): KeyboardStep[] {
    const result: KeyboardStep[] = [];
    for (const field of this.settings.optionFieldOrder) {
      if (isCustomFieldKey(field)) {
        if (this.customField(field)?.enabled) result.push(field);
        continue;
      }
      if (field === "date" || field === "title" || field === "amount") result.push(field);
      else if (field === "note" && this.settings.enableNote) result.push(field);
      if (field === "account" && this.settings.enableAccount) result.push(field);
      else if (field === "category" && this.settings.enableCategory && this.draft.type !== "转账") result.push(field);
      else if (field === "type" && this.settings.enableType) result.push(field);
      else if (field === "necessity" && this.settings.enableNecessity && this.draft.type !== "转账") result.push(field);
      else if (field === "attachments" && this.settings.enableEntryAttachments) result.push(field);
    }
    if (this.draft.type === "转账" && this.settings.enableAccount) result.push("targetAccount");
    return result;
  }

  private optionValues(step: KeyboardStep): string[] {
    if (isCustomFieldKey(step)) {
      const field = this.customField(step);
      return field?.kind === "select" ? field.options : [];
    }
    if (step === "account" || step === "targetAccount") return this.settings.accounts.map((account) => account.name);
    if (step === "type") return this.settings.typeOrder.filter((type) => this.settings.enableAccount || type !== "转账").map((type) => this.settings.typeLabels[type] ?? type);
    if (step === "necessity") return this.settings.necessityOrder.map((value) => this.settings.necessityLabels[value] ?? value);
    if (step === "category") return this.settings.typeEffects[this.draft.type] === "positive" ? this.settings.incomeCategories : this.settings.categories;
    return [];
  }

  private optionCodes(step: KeyboardStep, choices: string[]): string[] {
    if (isCustomFieldKey(step)) {
      const field = this.customField(step);
      return choices.map((choice, index) => field?.optionCodes[choice] || String(index + 1));
    }
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
    if (isCustomFieldKey(step)) this.draft.customValues[customFieldId(step)] = value;
    else if (step === "account") this.draft.account = value;
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
    if (step === "date") return this.lastDay;
    if (isCustomFieldKey(step) && !choices.length) return this.draft.customValues[customFieldId(step)] ?? "";
    if (isCustomFieldKey(step) && !(this.draft.customValues[customFieldId(step)] ?? "")) return "";
    if (!choices.length) return "";
    const current = isCustomFieldKey(step) ? (this.draft.customValues[customFieldId(step)] ?? "")
      : step === "account" ? this.draft.account
      : step === "targetAccount" ? this.draft.targetAccount
      : step === "type" ? (this.settings.typeLabels[this.draft.type] ?? this.draft.type)
      : step === "necessity" ? (this.settings.necessityLabels[this.draft.necessity] ?? this.draft.necessity)
      : this.draft.category;
    const index = Math.max(choices.indexOf(current), 0);
    this.activeOption = index;
    return this.optionCodes(step, choices)[index] ?? String(index + 1);
  }

  private daysInMonth(): number {
    return new Date(Number(this.month.slice(0, 4)), Number(this.month.slice(5, 7)), 0).getDate();
  }

  private placeholder(step: KeyboardStep): string {
    if (step === "date") return `请输入1-${this.daysInMonth()}之间的日期`;
    if (step === "type") return "请输入类型编号或完整名称";
    if (step === "necessity") return "请输入必要性编号或完整名称";
    if (this.optionValues(step).length) return `请输入${this.stepTitle(step).replace(/^选择/, "")}编号或完整名称`;
    if (step === "title") return this.settings.allowNumericTitle ? "请输入账目内容" : "请输入账目内容（不能为纯数字）";
    if (step === "amount") return "请输入金额或算式";
    if (step === "attachments") return `按 ${this.displayKey(this.settings.keyboardShortcuts.confirm)} 继续`;
    if (isCustomFieldKey(step)) return this.customField(step)?.kind === "select" ? `请输入${this.customField(step)?.name ?? "选项"}编号或完整名称` : "可以留空，直接确认继续";
    return "请输入备注，可以留空";
  }

  private helpText(step: KeyboardStep): string {
    const confirm = this.displayKey(this.settings.keyboardShortcuts.confirm);
    if (step === "attachments") return `按 ${confirm} 继续`;
    return `${confirm}确认 ${this.displayKey(this.settings.keyboardShortcuts.previous)}/${this.displayKey(this.settings.keyboardShortcuts.next)}选择 ${this.displayKey(this.settings.keyboardShortcuts.back)}返回 ${this.displayKey(this.settings.keyboardShortcuts.close)}关闭`;
  }

  private stepTitle(step: KeyboardStep): string {
    if (step === "date") return "输入日期";
    if (step === "targetAccount") return "选择转入账户";
    if (step === "title") return "输入内容";
    if (step === "amount") return "输入金额";
    if (step === "note") return "输入备注";
    if (step === "attachments") return "添加附件";
    if (isCustomFieldKey(step)) return `${this.customField(step)?.kind === "select" ? "选择" : "输入"}${this.customField(step)?.name ?? "自定义字段"}`;
    return `选择${ENTRY_FIELD_LABELS[step]}`;
  }

  private customField(step: EntryField): CustomFieldConfig | undefined {
    return isCustomFieldKey(step) ? this.settings.customFields.find((field) => field.id === customFieldId(step)) : undefined;
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
    this.step = steps[index - 1] ?? "date";
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
    this.step = "date";
    this.render();
  }

  private renderAttachmentUploader(content: HTMLElement): void {
    const area = content.createDiv({ cls: "bookkeeping-keyboard-attachment-dropzone", text: "拖动文件到此处，或点击选择文件" });
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
      attachments: [],
      customValues: Object.fromEntries(this.settings.customFields.map((field) => [field.id, customFieldDefaultValue(field)])),
      customProperties: Object.fromEntries(this.settings.customFields.filter((field) => field.enabled).map((field) => [field.id, field.property]))
    };
  }

  private optionError(step: KeyboardStep): string {
    if (step === "type") return "请输入类型编号或完整名称";
    if (step === "necessity") return "请输入必要性编号或完整名称";
    return `请输入${this.stepTitle(step).replace(/^选择/, "")}编号或完整名称`;
  }
}
