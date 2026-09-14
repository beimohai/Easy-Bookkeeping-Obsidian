import { App, ButtonComponent, DropdownComponent, Modal, Notice, Setting, TFile, TextComponent, setIcon } from "obsidian";
import { canRecordTransfer, customFieldDefaultValue, customFieldId, isCustomFieldKey, usableDefaultType, type BookkeepingSettings, type Transaction, type TransactionDraft, type TransactionType } from "./types";
import { currentTime, errorMessageZh, evaluateAmount, formatMoney, normalizeDate, parseNoteTags, today, uniqueStrings } from "./utils";
import type { TransactionStore } from "./transaction-store";
import { translate } from "./locales";

export class TransactionModal extends Modal {
  private draft: TransactionDraft;
  private pendingAttachments: File[] = [];
  private previewUrls: string[] = [];
  private errorEl!: HTMLElement;

  constructor(
    app: App,
    private readonly store: TransactionStore,
    private readonly settings: BookkeepingSettings,
    private readonly existing: Transaction | null,
    private readonly forceContinuous: boolean,
    private readonly targetMonth: string,
    private readonly onSaved: () => Promise<void>
  ) {
    super(app);
    this.draft = existing ? this.copyExisting(existing) : this.emptyDraft();
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal", "bookkeeping-entry-modal");
    this.setTitle(translate(this.existing ? "编辑账目" : "开始记账", this.settings.language));
    const content = this.contentEl;
    content.empty();

    const timeSetting = new Setting(content).setName("时间");
    timeSetting.settingEl.addClass("bookkeeping-datetime-setting");
    const timeIcon = timeSetting.controlEl.createSpan({ cls: "bookkeeping-datetime-icon", attr: { "aria-hidden": "true" } });
    setIcon(timeIcon, "clock");
    const timeValue = timeSetting.controlEl.createSpan({ cls: "bookkeeping-datetime-value", text: this.draft.time, attr: { "aria-hidden": "true" } });
    timeSetting.addText((text) => {
      text.inputEl.type = "time";
      text.inputEl.lang = this.settings.language;
      text.setValue(this.draft.time).onChange((value) => {
        this.draft.time = value;
        timeValue.setText(value);
      });
    });

    let categoryDropdown: DropdownComponent | null = null;
    const optionSettings = new Map<string, Setting>();
    let refresh = (): void => {};
    const accounts = Object.fromEntries(this.settings.accounts.map((account) => [account.name, account.name]));
    const transferAvailable = canRecordTransfer(this.settings);
    let titleInput: TextComponent | null = null;
    let amountInput: TextComponent | null = null;
    let noteInput: HTMLTextAreaElement | null = null;
    let tagInput: TextComponent | null = null;
    const customClearers: Array<() => void> = [];
    for (const field of this.settings.optionFieldOrder) {
      if (!isCustomFieldKey(field)) {
        if (field === "account" && !this.settings.enableAccount) continue;
        if (field === "type" && !this.settings.enableType) continue;
        if (field === "necessity" && !this.settings.enableNecessity) continue;
        if (field === "category" && !this.settings.enableCategory) continue;
        if (field === "note" && !this.settings.enableNote) continue;
        if (field === "attachments" && !this.settings.enableEntryAttachments) continue;
      }
      if (isCustomFieldKey(field)) {
        const config = this.settings.customFields.find((item) => item.id === customFieldId(field));
        if (!config?.enabled) continue;
        const setting = new Setting(content).setName(config.name);
        if (config.kind === "select") {
          setting.addDropdown((dropdown) => {
            const fallback = customFieldDefaultValue(config);
            const current = this.draft.customValues[config.id] || fallback;
            this.draft.customValues[config.id] = current;
            dropdown.addOptions(Object.fromEntries([...new Set([current, ...config.options].filter(Boolean))].map((option) => [option, option])));
            dropdown.setValue(current);
            dropdown.onChange((value) => this.draft.customValues[config.id] = value);
            customClearers.push(() => {
              this.draft.customValues[config.id] = fallback;
              dropdown.setValue(fallback);
            });
          });
        } else {
          setting.addText((text) => {
            text.setPlaceholder("可以留空").setValue(this.draft.customValues[config.id] ?? "");
            text.onChange((value) => this.draft.customValues[config.id] = value.trim());
            customClearers.push(() => {
              text.setValue("");
            });
          });
        }
      } else if (field === "date") {
        const dateSetting = new Setting(content).setName("日期");
        dateSetting.settingEl.addClass("bookkeeping-datetime-setting");
        const dateIcon = dateSetting.controlEl.createSpan({ cls: "bookkeeping-datetime-icon", attr: { "aria-hidden": "true" } });
        setIcon(dateIcon, "calendar-days");
        const dateValue = dateSetting.controlEl.createSpan({ cls: "bookkeeping-datetime-value", text: this.displayPickerDate(this.draft.date), attr: { "aria-hidden": "true" } });
        dateSetting.addText((text) => {
          text.inputEl.type = "date";
          text.inputEl.lang = this.settings.language;
          text.setPlaceholder("请输入日期").setValue(this.draft.date).onChange((value) => {
            this.draft.date = value;
            dateValue.setText(this.displayPickerDate(value));
          });
        });
      } else if (field === "account") {
        const setting = new Setting(content).setName("账户");
        setting.addDropdown((dropdown) => dropdown.addOptions(accounts).setValue(this.draft.account).onChange((value) => this.draft.account = value));
        optionSettings.set(field, setting);
      } else if (field === "type") {
        const setting = new Setting(content).setName("类型");
        const typeOptions = Object.fromEntries(this.settings.typeOrder.map((type) => [type, this.settings.typeLabels[type] ?? type]));
        if (!transferAvailable && this.settings.typeOrder.includes("转账")) {
          setting.setDesc(this.settings.enableAccount ? "转账需至少添加两个账户" : "转账需先启用账户，并至少添加两个账户");
        }
        setting.addDropdown((dropdown) => {
          dropdown.addOptions(typeOptions);
          const transferOption = dropdown.selectEl.querySelector<HTMLOptionElement>('option[value="转账"]');
          if (transferOption && !transferAvailable) {
            transferOption.disabled = true;
            transferOption.textContent = `${this.settings.typeLabels["转账"] ?? "转账"}（暂不可用）`;
          }
          dropdown.setValue(this.draft.type).onChange((value) => {
            this.draft.type = value;
            refresh();
          });
        });
        optionSettings.set(field, setting);
      } else if (field === "necessity") {
        const setting = new Setting(content).setName("必要性");
        setting.addDropdown((dropdown) => dropdown
          .addOptions(Object.fromEntries(this.settings.necessityOrder.map((value) => [value, this.settings.necessityLabels[value] ?? value])))
          .setValue(this.draft.necessity)
          .onChange((value) => this.draft.necessity = value));
        optionSettings.set(field, setting);
      } else if (field === "category") {
        const setting = new Setting(content).setName("分类");
        setting.addDropdown((dropdown) => {
          categoryDropdown = dropdown;
          this.fillCategories(dropdown, this.draft.type);
          dropdown.onChange((value) => this.draft.category = value);
        });
        optionSettings.set(field, setting);
      } else if (field === "attachments") {
        this.renderAttachmentUploader(content);
      } else if (field === "title") {
        new Setting(content).setName("内容").addText((text) => {
          titleInput = text.setPlaceholder(this.settings.allowNumericTitle ? "请输入账目内容" : "请输入账目内容（不能为纯数字）").setValue(this.draft.title);
          text.onChange((value) => this.draft.title = value.trim());
        });
      } else if (field === "amount") {
        const amountSetting = new Setting(content).setName("金额");
        amountSetting.addText((text) => {
          amountInput = text.setPlaceholder("请输入金额或算式").setValue(this.draft.expression || (this.draft.amount ? String(this.draft.amount) : ""));
          text.inputEl.inputMode = "decimal";
          text.onChange((value) => this.draft.expression = value);
        });
      } else if (field === "note") {
        const noteSetting = new Setting(content).setName("备注");
        noteSetting.addTextArea((text) => {
          noteInput = text.inputEl;
          noteInput.rows = 2;
          text.setPlaceholder("请输入备注，可以留空").setValue(this.draft.note === "无" ? "" : this.draft.note);
          text.onChange((value) => {
            const parsed = parseNoteTags(value);
            this.draft.note = parsed.note;
            this.draft.tags = parsed.tags;
            tagInput?.setValue(this.formatTags());
          });
        });
        tagInput = this.renderTagInput(content);
      }
    }

    const targetAccountSetting = new Setting(content).setName("转入账户");
    targetAccountSetting.addDropdown((dropdown) => dropdown
      .addOptions(accounts)
      .setValue(this.draft.targetAccount)
      .onChange((value) => this.draft.targetAccount = value));

    function refreshTypeFields(this: TransactionModal): void {
      const isTransfer = this.draft.type === "转账";
      optionSettings.get("necessity")?.settingEl.toggleClass("bookkeeping-hidden", isTransfer);
      optionSettings.get("category")?.settingEl.toggleClass("bookkeeping-hidden", isTransfer);
      targetAccountSetting.settingEl.toggleClass("bookkeeping-hidden", !isTransfer || !transferAvailable);
      if (!isTransfer && categoryDropdown) {
        this.fillCategories(categoryDropdown, this.draft.type);
        this.draft.category = categoryDropdown.getValue();
      }
    }
    refresh = refreshTypeFields.bind(this);
    refresh();

    this.errorEl = content.createDiv({ cls: "bookkeeping-form-error" });
    const actions = content.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    new ButtonComponent(actions)
      .setButtonText(this.existing ? "保存修改" : "保存账目")
      .setCta()
      .onClick(() => { void (async () => {
        try {
          await this.submit();
          if (!this.existing && (this.forceContinuous || this.settings.mobileContinuousEntry)) {
            this.draft.title = "";
            this.draft.amount = 0;
            this.draft.expression = "";
            this.draft.note = "";
            this.draft.tags = [];
            this.draft.attachments = [];
            this.draft.customValues = {};
            this.pendingAttachments = [];
            titleInput?.setValue("");
            amountInput?.setValue("");
            if (noteInput) noteInput.value = "";
            tagInput?.setValue("");
            customClearers.forEach((clear) => clear());
            titleInput?.inputEl.focus();
          } else {
            this.close();
          }
        } catch (error) {
          this.errorEl.setText(errorMessageZh(error, "账目保存失败，请检查输入和存储目录"));
        }
      })(); });

    window.setTimeout(() => titleInput?.inputEl.focus(), 50);
  }

  onClose(): void {
    this.previewUrls.forEach((url) => URL.revokeObjectURL(url));
    this.previewUrls = [];
    this.contentEl.empty();
  }

  private async submit(): Promise<void> {
    this.errorEl.empty();
    const date = normalizeDate(this.draft.date);
    const errors: string[] = [];
    if (!date) errors.push("请选择真实存在的有效日期");
    else this.draft.date = date;
    const time = this.draft.time.match(/^(\d{2}):(\d{2})$/);
    if (!time || Number(time[1]) > 23 || Number(time[2]) > 59) errors.push("请选择有效时间");
    if (!this.draft.title) errors.push("内容不得为空");
    if (!this.settings.allowNumericTitle && /^\d+$/.test(this.draft.title)) errors.push("内容不能为纯数字");
    if (this.settings.enableAccount && !this.draft.account) errors.push("请选择账户");
    if (this.draft.type === "转账" && !canRecordTransfer(this.settings)) {
      errors.push("转账需启用账户并至少添加两个账户");
    } else if (this.draft.type === "转账" && (!this.draft.targetAccount || this.draft.targetAccount === this.draft.account)) {
      errors.push("转出账户和转入账户不能相同");
    }
    if (!this.draft.expression.trim() && this.settings.allowEmptyAmount) {
      this.draft.amount = 0;
    } else if (!this.draft.expression.trim()) errors.push("金额不得为空");
    else {
      try {
        this.draft.amount = evaluateAmount(this.draft.expression);
      } catch {
        errors.push("金额或算式无效");
      }
    }
    if (errors.length) throw new Error(errors.join("\n"));
    for (const file of this.pendingAttachments) {
      const stored = await this.store.saveAttachment(file, this.draft);
      this.draft.attachments = [...new Set([...this.draft.attachments, stored.path])];
    }
    this.pendingAttachments = [];
    if (this.existing) await this.store.update(this.existing, this.draft);
    else await this.store.create(this.draft);
    new Notice(this.existing
      ? translate("账目已更新", this.settings.language)
      : `${translate("已记录：", this.settings.language)}${this.draft.title} ${formatMoney(this.draft.amount, this.settings.currency, this.settings.numberGrouping)}`);
    await this.onSaved();
  }

  private fillCategories(dropdown: DropdownComponent, type: TransactionType): void {
    const positive = this.settings.typeEffects[type] === "positive";
    const categories = positive ? this.settings.incomeCategories : this.settings.categories;
    const configuredDefault = positive ? this.settings.defaultIncomeCategory : this.settings.defaultCategory;
    const previous = this.draft.category;
    dropdown.selectEl.empty();
    dropdown.addOptions(Object.fromEntries(categories.map((category) => [category, category])));
    const next = categories.includes(previous) ? previous : categories.includes(configuredDefault) ? configuredDefault : (categories[0] ?? "其他");
    this.draft.category = next;
    dropdown.setValue(next);
  }

  private displayPickerDate(value: string): string {
    return value.replace(/-/g, "/");
  }

  private renderAttachmentUploader(content: HTMLElement): void {
    const setting = new Setting(content).setName("附件");
    setting.settingEl.addClass("bookkeeping-attachment-setting");
    const area = setting.controlEl.createDiv({ cls: "bookkeeping-attachment-dropzone" });
    area.createSpan({ cls: "bookkeeping-attachment-dropzone-label", text: "拖动文件到此处，或点击选择文件" });
    const input = area.createEl("input", { type: "file", attr: { multiple: "true", "aria-label": "选择附件" } });
    const list = setting.controlEl.createDiv({ cls: "bookkeeping-attachment-list" });
    const addFiles = (files: FileList | File[]): void => {
      const incoming = Array.from(files);
      const keys = new Set(this.pendingAttachments.map((file) => `${file.name}|${file.size}|${file.lastModified}`));
      for (const file of incoming) {
        const key = `${file.name}|${file.size}|${file.lastModified}`;
        if (!keys.has(key)) this.pendingAttachments.push(file);
        keys.add(key);
      }
      renderList();
    };
    const renderList = (): void => {
      this.previewUrls.forEach((url) => URL.revokeObjectURL(url));
      this.previewUrls = [];
      list.empty();
      for (const path of this.draft.attachments) {
        const chip = list.createSpan({ cls: "bookkeeping-attachment-chip" });
        chip.createSpan({ text: path.split("/").pop() ?? path, attr: { title: path } });
        const remove = chip.createEl("button", { attr: { "aria-label": `移除${path}` } });
        setIcon(remove, "x");
        remove.addEventListener("click", () => {
          this.draft.attachments = this.draft.attachments.filter((item) => item !== path);
          renderList();
        });
        const vaultFile = this.app.vault.getAbstractFileByPath(path);
        if (vaultFile instanceof TFile) this.renderAttachmentPreview(list, vaultFile.name, this.app.vault.getResourcePath(vaultFile), () => void this.app.workspace.getLeaf(false).openFile(vaultFile));
      }
      this.pendingAttachments.forEach((file, index) => {
        const chip = list.createSpan({ cls: "bookkeeping-attachment-chip is-pending" });
        chip.createSpan({ text: file.name, attr: { title: `保存时上传并自动重命名：${file.name}` } });
        const remove = chip.createEl("button", { attr: { "aria-label": `移除待上传文件${file.name}` } });
        setIcon(remove, "x");
        remove.addEventListener("click", () => {
          this.pendingAttachments.splice(index, 1);
          renderList();
        });
        const url = URL.createObjectURL(file);
        this.previewUrls.push(url);
        this.renderAttachmentPreview(list, file.name, url);
      });
    };
    input.addEventListener("change", () => {
      if (input.files) addFiles(input.files);
      input.value = "";
    });
    area.addEventListener("dragover", (event) => {
      event.preventDefault();
      area.addClass("is-dragover");
    });
    area.addEventListener("dragleave", () => area.removeClass("is-dragover"));
    area.addEventListener("drop", (event) => {
      event.preventDefault();
      area.removeClass("is-dragover");
      if (event.dataTransfer?.files) addFiles(event.dataTransfer.files);
    });
    renderList();
  }

  private renderAttachmentPreview(parent: HTMLElement, name: string, source: string, onOpen?: () => void): void {
    const extension = name.split(".").pop()?.toLowerCase() ?? "";
    const card = parent.createEl("button", { cls: "bookkeeping-attachment-preview", attr: { type: "button", title: onOpen ? `打开${name}` : name } });
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(extension)) card.createEl("img", { attr: { src: source, alt: name } });
    else if (extension === "pdf") card.createEl("iframe", { attr: { src: `${source}#toolbar=0`, title: name, tabindex: "-1" } });
    else {
      const icon = card.createSpan();
      setIcon(icon, "file");
    }
    card.createSpan({ cls: "bookkeeping-attachment-preview-name", text: name });
    if (onOpen) card.addEventListener("click", onOpen);
  }

  private renderTagInput(content: HTMLElement): TextComponent | null {
    let input: TextComponent | null = null;
    new Setting(content).setName("标签").addText((text) => {
      input = text;
      text.setPlaceholder("#标签1 #标签2").setValue(this.formatTags());
      text.onChange((value) => this.draft.tags = uniqueStrings(value.split(/[\s,，]+/).map((tag) => tag.replace(/^#/, ""))));
    });
    return input;
  }

  private formatTags(): string {
    return this.draft.tags.filter((tag) => tag !== "记账").map((tag) => `#${tag}`).join(" ");
  }

  private emptyDraft(): TransactionDraft {
    const accountNames = this.settings.accounts.map((account) => account.name);
    const account = accountNames.includes(this.settings.defaultAccount) ? this.settings.defaultAccount : (accountNames[0] ?? "默认账户");
    const month = /^\d{4}-\d{2}$/.test(this.targetMonth) ? this.targetMonth : today().slice(0, 7);
    const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const day = String(Math.min(Number(today().slice(8, 10)), days)).padStart(2, "0");
    const type = usableDefaultType(this.settings);
    return {
      date: `${month}-${day}`,
      time: currentTime(),
      type,
      necessity: this.settings.defaultNecessity,
      category: this.settings.enableCategory ? (this.settings.typeEffects[type] === "positive" ? this.settings.defaultIncomeCategory : this.settings.defaultCategory) : "未分类",
      account,
      targetAccount: this.settings.enableAccount ? (accountNames.find((name) => name !== account) ?? account) : "",
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

  private copyExisting(transaction: Transaction): TransactionDraft {
    return {
      date: transaction.date,
      time: transaction.time,
      type: transaction.type,
      necessity: transaction.necessity,
      category: transaction.category,
      account: transaction.account,
      targetAccount: transaction.targetAccount,
      title: transaction.title,
      amount: transaction.amount,
      expression: transaction.expression || String(transaction.amount),
      note: transaction.note,
      tags: [...transaction.tags],
      attachments: [...transaction.attachments],
      customValues: { ...transaction.customValues },
      customProperties: Object.fromEntries(this.settings.customFields.filter((field) => field.enabled).map((field) => [field.id, field.property]))
    };
  }
}
