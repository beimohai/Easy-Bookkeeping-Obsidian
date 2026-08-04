import { App, ButtonComponent, DropdownComponent, Modal, Notice, Setting, TFile, TextComponent, setIcon } from "obsidian";
import type { BookkeepingSettings, Transaction, TransactionDraft, TransactionType } from "./types";
import { currentTime, errorMessageZh, evaluateAmount, formatMoney, normalizeDate, today, uniqueStrings } from "./utils";
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

    new Setting(content).setName("日期").addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.lang = this.settings.language;
      text.setValue(this.draft.date).onChange((value) => this.draft.date = value);
    });
    new Setting(content).setName("时间").addText((text) => {
      text.inputEl.type = "time";
      text.inputEl.lang = this.settings.language;
      text.setValue(this.draft.time).onChange((value) => this.draft.time = value);
    });

    let categoryDropdown: DropdownComponent | null = null;
    const optionSettings = new Map<string, Setting>();
    let refresh = (): void => {};
    const accounts = Object.fromEntries(this.settings.accounts.map((account) => [account.name, account.name]));
    for (const field of this.settings.optionFieldOrder) {
      if (field === "account" && this.settings.enableAccount) {
        const setting = new Setting(content).setName("账户");
        setting.addDropdown((dropdown) => dropdown.addOptions(accounts).setValue(this.draft.account).onChange((value) => this.draft.account = value));
        optionSettings.set(field, setting);
      } else if (field === "type" && this.settings.enableType) {
        const setting = new Setting(content).setName("类型");
        const availableTypes = this.settings.typeOrder.filter((type) => this.settings.enableAccount || type !== "转账");
        const typeOptions = Object.fromEntries(availableTypes.map((type) => [type, this.settings.typeLabels[type] ?? type]));
        setting.addDropdown((dropdown) => dropdown
          .addOptions(typeOptions)
          .setValue(this.draft.type)
          .onChange((value) => {
            this.draft.type = value as TransactionType;
            refresh();
          }));
        optionSettings.set(field, setting);
      } else if (field === "necessity" && this.settings.enableNecessity) {
        const setting = new Setting(content).setName("必要性");
        setting.addDropdown((dropdown) => dropdown
          .addOptions(Object.fromEntries(this.settings.necessityOrder.map((value) => [value, this.settings.necessityLabels[value] ?? value])))
          .setValue(this.draft.necessity)
          .onChange((value) => this.draft.necessity = value));
        optionSettings.set(field, setting);
      } else if (field === "category" && this.settings.enableCategory) {
        const setting = new Setting(content).setName("分类");
        setting.addDropdown((dropdown) => {
          categoryDropdown = dropdown;
          this.fillCategories(dropdown, this.draft.type);
          dropdown.onChange((value) => this.draft.category = value);
        });
        optionSettings.set(field, setting);
      } else if (field === "attachments" && this.settings.enableEntryAttachments) {
        this.renderAttachmentUploader(content);
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
      targetAccountSetting.settingEl.toggleClass("bookkeeping-hidden", !isTransfer || !this.settings.enableAccount);
      if (!isTransfer && categoryDropdown) {
        this.fillCategories(categoryDropdown, this.draft.type);
        this.draft.category = categoryDropdown.getValue();
      }
    }
    refresh = refreshTypeFields.bind(this);
    refresh();

    let titleInput: TextComponent;
    new Setting(content).setName("内容").addText((text) => {
      titleInput = text.setPlaceholder("请输入内容").setValue(this.draft.title);
      text.onChange((value) => this.draft.title = value.trim());
    });

    let amountInput: TextComponent;
    const amountSetting = new Setting(content).setName("金额");
    amountSetting.addText((text) => {
      amountInput = text.setPlaceholder("0.00").setValue(this.draft.expression || (this.draft.amount ? String(this.draft.amount) : ""));
      text.inputEl.inputMode = "decimal";
      text.onChange((value) => this.draft.expression = value);
    });

    new Setting(content).setName("备注").addTextArea((text) => {
      text.setPlaceholder("可留空").setValue(this.draft.note === "无" ? "" : this.draft.note);
      text.onChange((value) => this.draft.note = value.trim());
    });
    new Setting(content).setName("标签").addText((text) => {
      text.setValue(this.draft.tags.filter((tag) => tag !== "记账").join(" "));
      text.onChange((value) => this.draft.tags = uniqueStrings(value.split(/[\s,，]+/).map((tag) => tag.replace(/^#/, ""))));
    });
    this.errorEl = content.createDiv({ cls: "bookkeeping-form-error" });
    const actions = content.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    new ButtonComponent(actions)
      .setButtonText(this.existing ? "保存修改" : "保存账目")
      .setCta()
      .onClick(async () => {
        try {
          await this.submit();
          if (!this.existing && (this.forceContinuous || this.settings.mobileContinuousEntry)) {
            this.draft.title = "";
            this.draft.amount = 0;
            this.draft.expression = "";
            this.draft.note = "";
            this.draft.tags = [];
            this.draft.attachments = [];
            this.pendingAttachments = [];
            titleInput.setValue("");
            amountInput.setValue("");
            titleInput.inputEl.focus();
          } else {
            this.close();
          }
        } catch (error) {
          this.errorEl.setText(errorMessageZh(error, "账目保存失败，请检查输入和存储目录"));
        }
      });

    window.setTimeout(() => titleInput.inputEl.focus(), 50);
  }

  onClose(): void {
    this.previewUrls.forEach((url) => URL.revokeObjectURL(url));
    this.previewUrls = [];
    this.contentEl.empty();
  }

  private async submit(): Promise<void> {
    this.errorEl.empty();
    const date = normalizeDate(this.draft.date);
    if (!date) throw new Error("请选择真实存在的有效日期");
    this.draft.date = date;
    const time = this.draft.time.match(/^(\d{2}):(\d{2})$/);
    if (!time || Number(time[1]) > 23 || Number(time[2]) > 59) throw new Error("请选择有效时间");
    if (!this.draft.title || /^\d+$/.test(this.draft.title)) throw new Error("内容不能为空或纯数字");
    if (this.settings.enableAccount && !this.draft.account) throw new Error("请选择账户");
    if (this.draft.type === "转账" && (!this.draft.targetAccount || this.draft.targetAccount === this.draft.account)) {
      throw new Error("转出账户和转入账户不能相同");
    }
    this.draft.amount = evaluateAmount(this.draft.expression);
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

  private renderAttachmentUploader(content: HTMLElement): void {
    const setting = new Setting(content).setName("附件");
    setting.settingEl.addClass("bookkeeping-attachment-setting");
    const area = setting.controlEl.createDiv({ cls: "bookkeeping-attachment-dropzone", text: "拖动文件到这里，或点击选择" });
    const input = area.createEl("input", { type: "file", attr: { multiple: "true", "aria-label": "选择小票或发票附件" } });
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

  private emptyDraft(): TransactionDraft {
    const accountNames = this.settings.accounts.map((account) => account.name);
    const account = accountNames.includes(this.settings.defaultAccount) ? this.settings.defaultAccount : (accountNames[0] ?? "默认账户");
    const month = /^\d{4}-\d{2}$/.test(this.targetMonth) ? this.targetMonth : today().slice(0, 7);
    const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const day = String(Math.min(Number(today().slice(8, 10)), days)).padStart(2, "0");
    return {
      date: `${month}-${day}`,
      time: currentTime(),
      type: this.settings.enableAccount ? this.settings.defaultType : (this.settings.defaultType === "转账" ? "支出" : this.settings.defaultType),
      necessity: this.settings.defaultNecessity,
      category: this.settings.enableCategory ? (this.settings.typeEffects[this.settings.defaultType] === "positive" ? this.settings.defaultIncomeCategory : this.settings.defaultCategory) : "未分类",
      account,
      targetAccount: this.settings.enableAccount ? (accountNames.find((name) => name !== account) ?? account) : "",
      title: "",
      amount: 0,
      expression: "",
      note: "",
      tags: [],
      attachments: []
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
      attachments: [...transaction.attachments]
    };
  }
}
