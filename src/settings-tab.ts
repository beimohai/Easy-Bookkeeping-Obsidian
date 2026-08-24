import { App, ButtonComponent, Modal, Platform, PluginSettingTab, Setting, setIcon } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import type BookkeepingPlugin from "./main";
import type { CustomFieldConfig, CustomFieldKind, EntryField, Language, Necessity, TableColumn, TransactionType, TypeEffect } from "./types";
import { DEFAULT_SETTINGS, ENTRY_FIELD_LABELS, TABLE_COLUMN_LABELS, customFieldId, customFieldKey, isCustomFieldKey, isReservedTransactionProperty } from "./types";
import qqGroupUrl from "./assets/community/qq-group.jpg";
import sponsorQrUrl from "./assets/community/support.png";
import { BILIBILI_URL, ISSUES_URL, PROJECT_URL, RELEASES_URL } from "./branding";
import { LANGUAGE_OPTIONS } from "./locales";
import { formatDateDisplay, formatMonthDisplay } from "./utils";
import { bindPointerSort } from "./pointer-sort";
import { VaultFolderSuggest } from "./vault-folder-suggest";

declare const __PLUGIN_VERSION__: string;

type PresetGroup = "type" | "necessity" | "category" | "account";

function toLanguage(value: string): Language {
  if (value === "zh-CN" || value === "zh-TW" || value === "en" || value === "fr" || value === "ru" || value === "es" || value === "ar" || value === "ja" || value === "ko" || value === "de" || value === "pt" || value === "fa") return value;
  return "zh-CN";
}

function toTypeEffect(value: string): TypeEffect {
  return value === "positive" || value === "negative" || value === "neutral" ? value : "neutral";
}

function optionRecord(values: readonly string[], labels?: Record<string, string>): Record<string, string> {
  const options: Record<string, string> = {};
  for (const value of values) options[value] = labels?.[value] ?? value;
  return options;
}

function typeOrder(values: string[]): TransactionType[] { return values; }
function necessityOrder(values: string[]): Necessity[] { return values; }


export class BookkeepingSettingTab extends PluginSettingTab {
  private draggedOption: EntryField | null = null;
  private draggedColumn: TableColumn | null = null;

  constructor(app: App, private readonly plugin: BookkeepingPlugin) {
    super(app, plugin);
  }

  hide(): void {
    void this.plugin.refreshDashboards();
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("bookkeeping-settings");
    containerEl.toggleClass("is-mobile", Platform.isMobile);
    this.section("通用");
    const availableLanguages: Record<string, string> = {};
    for (const [language, label] of Object.entries(LANGUAGE_OPTIONS)) {
      const normalized = toLanguage(language);
      if (!this.plugin.settings.disabledLanguages.includes(normalized)) availableLanguages[normalized] = label;
    }
    new Setting(containerEl).setName("插件语言").addDropdown((dropdown) => dropdown
      .addOptions(availableLanguages).setValue(this.plugin.settings.language).onChange((value) => { void (async () => {
        this.plugin.settings.language = toLanguage(value);
        await this.plugin.saveSettingsQuietly();
        this.update();
      })(); }));
    new Setting(containerEl).setName("语言包管理").addButton((button) => button
      .setButtonText("管理语言包").setIcon("languages").onClick(() => new LanguagePackModal(this.app, this.plugin, () => this.update()).open()));
    new Setting(containerEl).setName("退出后是否保存界面").addDropdown((dropdown) => dropdown
      .addOptions({ none: "不保持", current: "保持当前筛选", monthly: "保持当月界面" })
      .setValue(this.plugin.settings.filterPersistence).onChange((value) => { void (async () => {
        this.plugin.settings.filterPersistence = value === "current" ? "current" : value === "monthly" ? "monthly" : "none";
        this.plugin.settings.saveFiltersOnExit = this.plugin.settings.filterPersistence !== "none";
        if (this.plugin.settings.filterPersistence === "none") {
          this.plugin.settings.savedDashboardFilters = { ...DEFAULT_SETTINGS.savedDashboardFilters, types: [], necessities: [], categories: [], accounts: [] };
          this.plugin.settings.savedMonthlyDashboardFilters = {};
          this.plugin.settings.savedDashboardAdvancedFilters = false;
          this.plugin.settings.savedMonthlyDashboardAdvancedFilters = {};
          this.plugin.settings.lastDashboardMonth = "";
        }
        await this.plugin.saveSettingsQuietly();
      })(); }));
    new Setting(containerEl).setName("返回顶部按钮").addToggle((toggle) => toggle
      .setValue(this.plugin.settings.showFloatingBackToTop).onChange((value) => { void (async () => {
        this.plugin.settings.showFloatingBackToTop = value;
        await this.plugin.saveSettingsQuietly();
      })(); }));
    this.colorSetting(containerEl, "收入颜色", "incomeColor");
    this.colorSetting(containerEl, "支出颜色", "expenseColor");
    this.renderCommunityEntries(containerEl);

    this.section("录入");
    this.heading("录入方式");
    new Setting(containerEl).setName("记账方式").setDesc("桌面版为全程键盘记账；手机版为完整表单记账。").addDropdown((dropdown) => dropdown
      .addOptions({ auto: "自动识别设备", desktop: "桌面版", mobile: "手机版" }).setValue(this.plugin.settings.entryMode).onChange((value) => { void (async () => {
        this.plugin.settings.entryMode = value === "desktop" || value === "mobile" ? value : "auto";
        await this.plugin.saveSettingsQuietly();
      })(); }));
    new Setting(containerEl).setName("桌面版连续记账").addToggle((toggle) => toggle.setValue(this.plugin.settings.desktopContinuousEntry).onChange((value) => { void (async () => {
      this.plugin.settings.desktopContinuousEntry = value;
      await this.plugin.saveSettingsQuietly();
    })(); }));
    new Setting(containerEl).setName("手机版连续记账").addToggle((toggle) => toggle.setValue(this.plugin.settings.mobileContinuousEntry).onChange((value) => { void (async () => {
      this.plugin.settings.mobileContinuousEntry = value;
      await this.plugin.saveSettingsQuietly();
    })(); }));
    new Setting(containerEl).setName("手机版保存后打开仪表盘").addToggle((toggle) => toggle.setValue(this.plugin.settings.openDashboardAfterEntry).onChange((value) => { void (async () => {
      this.plugin.settings.openDashboardAfterEntry = value;
      await this.plugin.saveSettingsQuietly();
    })(); }));
    new Setting(containerEl).setName("允许内容重复").setDesc("关闭后，新建或修改账目时不允许与同日账目使用相同内容。").addToggle((toggle) => toggle
      .setValue(this.plugin.settings.allowDuplicateContent).onChange((value) => { void (async () => {
        this.plugin.settings.allowDuplicateContent = value;
        await this.plugin.saveSettingsQuietly();
      })(); }));
    new Setting(containerEl).setName("允许内容为纯数字").setDesc("关闭后，新建或修改账目时内容不允许使用纯数字。").addToggle((toggle) => toggle
      .setValue(this.plugin.settings.allowNumericTitle).onChange((value) => { void (async () => {
        this.plugin.settings.allowNumericTitle = value;
        await this.plugin.saveSettingsQuietly();
      })(); }));
    new Setting(containerEl).setName("允许金额为空").setDesc("开启后，若金额留空则按0保存。").addToggle((toggle) => toggle
      .setValue(this.plugin.settings.allowEmptyAmount).onChange((value) => { void (async () => {
        this.plugin.settings.allowEmptyAmount = value;
        await this.plugin.saveSettingsQuietly();
      })(); }));

    this.heading("录入字段与顺序");
    new Setting(containerEl)
      .setName("新增录入字段")
      .setDesc("内容型可以自由输入；分类型从预设中选择。")
      .addButton((button) => button.setButtonText("新增字段").setIcon("plus").setCta().onClick(() => new CustomFieldModal(this.app, this.plugin, null, () => this.update()).open()));
    const fieldList = containerEl.createDiv({ cls: "bookkeeping-setting-order-list" });
    this.renderEntryFields(fieldList);

    this.heading("录入预设");
    const presetGrid = containerEl.createDiv({ cls: "bookkeeping-preset-grid" });
    this.presetCard(presetGrid, "type", "类型", "circle-dollar-sign");
    this.presetCard(presetGrid, "necessity", "必要性", "badge-check");
    this.presetCard(presetGrid, "category", "分类", "shapes");
    this.presetCard(presetGrid, "account", "账户", "landmark");
    for (const field of this.plugin.settings.customFields.filter((item) => item.kind === "select")) {
      this.customPresetCard(presetGrid, field);
    }

    this.section("账目明细");
    this.heading("明细行为");
    new Setting(containerEl).setName("恢复默认列宽").addButton((button) => button.setButtonText("恢复默认列宽").onClick(() => { void (async () => {
      this.plugin.settings.tableColumnWidths = {};
      await this.plugin.saveSettingsQuietly();
      this.plugin.notice("已恢复账目明细自动列宽");
    })(); }));
    new Setting(containerEl).setName("启用行内编辑").addToggle((toggle) => toggle.setValue(this.plugin.settings.enableInlineEditing).onChange((value) => { void (async () => {
      this.plugin.settings.enableInlineEditing = value;
      await this.plugin.saveSettingsQuietly();
    })(); }));
    new Setting(containerEl).setName("删除前二次确认").addToggle((toggle) => toggle.setValue(this.plugin.settings.confirmDelete).onChange((value) => { void (async () => {
      this.plugin.settings.confirmDelete = value;
      await this.plugin.saveSettingsQuietly();
    })(); }));
    const undoSetting = new Setting(containerEl).setName("撤销删除时间").setDesc("可设置为0-15秒，只能设置为整数。");
    undoSetting.addText((text) => {
      text.inputEl.type = "number";
      text.inputEl.min = "0";
      text.inputEl.max = "15";
      text.inputEl.step = "1";
      text.inputEl.inputMode = "numeric";
      text.inputEl.addClass("bookkeeping-small-number-input");
      text.setValue(String(this.plugin.settings.undoDeleteSeconds));
      text.inputEl.addEventListener("keydown", (event) => {
        if (["e", "E", "+", "-", ".", ","].includes(event.key)) event.preventDefault();
      });
      text.inputEl.addEventListener("input", () => {
        if (!/^\d{0,2}$/.test(text.inputEl.value) || Number(text.inputEl.value) > 15) text.setValue(String(this.plugin.settings.undoDeleteSeconds));
      });
      text.inputEl.addEventListener("change", () => { void (async () => {
        const value = Number(text.inputEl.value);
        if (!Number.isInteger(value) || value < 0 || value > 15) {
          this.plugin.notice("撤销删除时间必须是0—15秒的整数");
          text.setValue(String(this.plugin.settings.undoDeleteSeconds));
          return;
        }
        this.plugin.settings.undoDeleteSeconds = value;
        await this.plugin.saveSettingsQuietly();
      })(); });
    });
    undoSetting.controlEl.createSpan({ text: "秒", cls: "bookkeeping-setting-unit" });
    new Setting(containerEl).setName("显示编辑按钮").addToggle((toggle) => toggle.setValue(this.plugin.settings.showEditAction).onChange((value) => { void (async () => {
      this.plugin.settings.showEditAction = value; await this.plugin.saveSettingsQuietly();
    })(); }));
    new Setting(containerEl).setName("显示打开Markdown按钮").addToggle((toggle) => toggle.setValue(this.plugin.settings.showOpenAction).onChange((value) => { void (async () => {
      this.plugin.settings.showOpenAction = value; await this.plugin.saveSettingsQuietly();
    })(); }));
    new Setting(containerEl).setName("显示删除按钮").addToggle((toggle) => toggle.setValue(this.plugin.settings.showDeleteAction).onChange((value) => { void (async () => {
      this.plugin.settings.showDeleteAction = value; await this.plugin.saveSettingsQuietly();
    })(); }));

    this.heading("表头顺序");
    containerEl.createEl("p", { text: "拖动左侧滑块调整顺序；右侧眼睛控制是否显示，铅笔控制能否行内编辑。", cls: "setting-item-description" });
    const columnHeader = containerEl.createDiv({ cls: "bookkeeping-config-table-header bookkeeping-column-config-header" });
    columnHeader.createSpan({ text: "表头名称" });
    columnHeader.createSpan({ text: "显示 / 编辑" });
    const columnList = containerEl.createDiv({ cls: "bookkeeping-column-config-list" });
    this.renderColumnRows(columnList);

    this.section("界面与格式");
    this.heading("金额格式");
    new Setting(containerEl).setName("货币符号").setDesc("仅修改符号，不转换金额。").addText((text) => text.setValue(this.plugin.settings.currency).onChange((value) => { void (async () => {
      this.plugin.settings.currency = value || "¥"; await this.plugin.saveSettingsQuietly();
    })(); }));
    new Setting(containerEl).setName("金额分位方式").addDropdown((dropdown) => dropdown
      .addOptions({ wan: "中文万位分组（1,0000）", thousand: "国际千位分组（10,000）", none: "不使用分隔符（10000）" })
      .setValue(this.plugin.settings.numberGrouping).onChange((value) => { void (async () => {
        this.plugin.settings.numberGrouping = value === "thousand" ? "thousand" : value === "none" ? "none" : "wan";
        await this.plugin.saveSettingsQuietly();
      })(); }));
    this.heading("日期、时间与星期");
    const monthFormats = ["YYYY-MM", "YYYY/MM", "YYYY.MM", "YYYY年MM月", "MM/YYYY", "MM-YYYY", "MMM YYYY"] as const;
    const monthOptions: Record<string, string> = {};
    for (const format of monthFormats) monthOptions[format] = formatMonthDisplay("2026-07", format, this.plugin.settings.language);
    new Setting(containerEl).setName("年月格式").setDesc("用于仪表盘的月份选择。").addDropdown((dropdown) => dropdown.addOptions(monthOptions).setValue(this.plugin.settings.yearMonthDisplayFormat).onChange((value) => { void (async () => {
      this.plugin.settings.yearMonthDisplayFormat = value as typeof this.plugin.settings.yearMonthDisplayFormat;
      await this.plugin.saveSettingsQuietly();
    })(); }));
    const dateFormats = ["MM-DD", "MM/DD", "MM.DD", "MM月DD日", "DD-MM", "DD/MM", "DD.MM", "YYYY-MM-DD", "YYYY/MM/DD", "DD/MM/YYYY", "MM/DD/YYYY", "DD.MM.YYYY", "YYYY年MM月DD日"] as const;
    const dateOptions: Record<string, string> = {};
    for (const format of dateFormats) dateOptions[format] = formatDateDisplay("2026-07-21", format, this.plugin.settings.language);
    new Setting(containerEl).setName("账目日期格式").setDesc("用于账目明细、汇总和图表提示。").addDropdown((dropdown) => dropdown.addOptions(dateOptions).setValue(this.plugin.settings.dateDisplayFormat).onChange((value) => { void (async () => {
      this.plugin.settings.dateDisplayFormat = value as typeof this.plugin.settings.dateDisplayFormat;
      await this.plugin.saveSettingsQuietly();
    })(); }));
    new Setting(containerEl).setName("时间格式").addDropdown((dropdown) => dropdown.addOptions({ "24h": "24小时制（18:30）", "12h": "12小时制（06:30 PM）" }).setValue(this.plugin.settings.timeDisplayFormat).onChange((value) => { void (async () => {
      this.plugin.settings.timeDisplayFormat = value === "12h" ? "12h" : "24h"; await this.plugin.saveSettingsQuietly();
    })(); }));
    new Setting(containerEl).setName("每周起始日").addDropdown((dropdown) => dropdown.addOptions({
      sunday: "周日", monday: "周一", tuesday: "周二", wednesday: "周三", thursday: "周四", friday: "周五", saturday: "周六"
    }).setValue(this.plugin.settings.calendarWeekStart).onChange((value) => { void (async () => {
      this.plugin.settings.calendarWeekStart = value as typeof this.plugin.settings.calendarWeekStart; await this.plugin.saveSettingsQuietly();
    })(); }));

    this.section("数据与文件");
    this.heading("存储目录");
    this.folderSetting("账目存储目录", this.plugin.settings.ledgerFolder, async (value) => {
      const oldLedger = this.plugin.settings.ledgerFolder;
      const next = value || "记账";
      if (this.plugin.settings.attachmentFolder === `${oldLedger}/附件`) this.plugin.settings.attachmentFolder = `${next}/附件`;
      this.plugin.settings.ledgerFolder = next;
    });
    this.folderSetting("CSV导出目录", this.plugin.settings.exportFolder, async (value) => { this.plugin.settings.exportFolder = value || "记账/导出"; });
    this.folderSetting("附件存储目录", this.plugin.settings.attachmentFolder, async (value) => { this.plugin.settings.attachmentFolder = value || "记账/附件"; });
    this.heading("Markdown算式存储");
    new Setting(containerEl).setName("把算式写入备注").addToggle((toggle) => toggle.setValue(this.plugin.settings.saveExpressionInNote).onChange((value) => { void (async () => {
      this.plugin.settings.saveExpressionInNote = value;
      await this.plugin.saveSettingsQuietly();
      this.plugin.openExpressionStorageMigration();
    })(); }));

    this.section("快捷键");
    this.heading("桌面版记账快捷键");
    this.shortcutSetting("确认 / 下一步", "confirm");
    this.shortcutSetting("上一个选项", "previous");
    this.shortcutSetting("下一个选项", "next");
    this.shortcutSetting("返回上一步", "back");
    this.shortcutSetting("关闭", "close");
    this.renderWebsiteLinks(containerEl, true);
    this.renderPluginFooter(containerEl);
    this.plugin.applyLanguage(containerEl);
  }

  private section(title: string): void {
    new Setting(this.containerEl).setName(title).setHeading().settingEl.addClass("bookkeeping-settings-section-header");
  }

  private heading(title: string): void {
    new Setting(this.containerEl).setName(title).setHeading();
  }

  private colorSetting(parent: HTMLElement, name: string, key: "incomeColor" | "expenseColor"): void {
    const defaultValue = DEFAULT_SETTINGS[key];
    let resetButton: ButtonComponent | null = null;
    let currentPicker: { setValue: (value: string) => unknown } | null = null;
    const updateReset = (): void => resetButton?.buttonEl.toggleClass("is-hidden", this.plugin.settings[key] === defaultValue);
    new Setting(parent).setName(name)
      .addColorPicker((picker) => {
        currentPicker = picker;
        picker.setValue(this.plugin.settings[key]).onChange((value) => { void (async () => {
          this.plugin.settings[key] = value;
          updateReset();
          await this.plugin.saveSettings();
        })(); });
      })
      .addButton((button) => {
        resetButton = button;
        button.setIcon("rotate-ccw").setTooltip("重置").setButtonText("还原默认").onClick(() => { void (async () => {
          this.plugin.settings[key] = defaultValue;
          currentPicker?.setValue(defaultValue);
          updateReset();
          await this.plugin.saveSettings();
        })(); });
        button.buttonEl.addClass("bookkeeping-color-reset");
        updateReset();
      });
  }

  private renderCommunityEntries(parent: HTMLElement, footer = false): void {
    const list = parent.createDiv({ cls: `bookkeeping-community-setting-list${footer ? " is-footer" : ""}` });
    const sponsor = new Setting(list).setName("赞助与支持");
    sponsor.addButton((button) => button.setButtonText("打开赞助面板").setIcon("heart").onClick(() => new CommunityPanelModal(this.app, "sponsor").open()));
    const feedback = new Setting(list).setName("问题反馈");
    feedback.addButton((button) => button.setButtonText("打开反馈面板").setIcon("message-square-warning").onClick(() => new CommunityPanelModal(this.app, "feedback").open()));
  }

  private renderWebsiteLinks(parent: HTMLElement, footer = false): void {
    const list = parent.createDiv({ cls: `bookkeeping-website-link-list${footer ? " is-footer" : ""}` });
    this.websiteLinkRow(list, "作者GitHub主页", "打开GitHub", "github", PROJECT_URL);
    this.websiteLinkRow(list, "作者B站主页", "打开B站", "external-link", BILIBILI_URL);
  }

  private renderPluginFooter(parent: HTMLElement): void {
    const footer = parent.createDiv({ cls: "bookkeeping-plugin-footer" });
    const logo = footer.createEl("a", { cls: "bookkeeping-plugin-footer-logo", attr: { href: PROJECT_URL, target: "_blank", rel: "noopener", "aria-label": "打开Easy Bookkeeping GitHub主页" } });
    logo.createEl("img", { attr: { src: this.plugin.pluginLogoUrl(), alt: "Easy Bookkeeping Logo" } });
    const details = footer.createDiv({ cls: "bookkeeping-plugin-footer-details" });
    details.createEl("a", { text: "Easy Bookkeeping", attr: { href: PROJECT_URL, target: "_blank", rel: "noopener" } });
    details.createEl("a", { text: "作者：北漠海", attr: { href: BILIBILI_URL, target: "_blank", rel: "noopener" } });
    details.createEl("a", { text: `版本号：${__PLUGIN_VERSION__}`, attr: { href: RELEASES_URL, target: "_blank", rel: "noopener" } });
    details.createEl("a", { text: "更新日期：2026-08-24", attr: { href: RELEASES_URL, target: "_blank", rel: "noopener" } });
    footer.createDiv({ text: "本项目基于 MIT License 开源", cls: "bookkeeping-plugin-footer-license" });
  }

  private websiteLinkRow(parent: HTMLElement, name: string, buttonText: string, icon: string, url: string): void {
    new Setting(parent).setName(name).addButton((button) => button.setButtonText(buttonText).setIcon(icon).onClick(() => window.open(url, "_blank")));
  }

  private presetCard(parent: HTMLElement, group: PresetGroup, title: string, iconName: string): void {
    const button = parent.createEl("button", { cls: "bookkeeping-preset-card", attr: { type: "button" } });
    const icon = button.createSpan(); setIcon(icon, iconName);
    button.createSpan({ text: title });
    const arrow = button.createSpan(); setIcon(arrow, "chevron-right");
    button.addEventListener("click", () => new PresetManagerModal(this.app, this.plugin, group).open());
  }

  private customPresetCard(parent: HTMLElement, field: CustomFieldConfig): void {
    const button = parent.createEl("button", { cls: "bookkeeping-preset-card", attr: { type: "button" } });
    const icon = button.createSpan(); setIcon(icon, "list-tree");
    button.createSpan({ text: field.name });
    const arrow = button.createSpan(); setIcon(arrow, "chevron-right");
    button.addEventListener("click", () => new CustomSelectPresetModal(this.app, this.plugin, field.id).open());
  }

  private renderEntryFields(parent: HTMLElement): void {
    parent.empty();
    for (const field of this.plugin.settings.optionFieldOrder) {
      const row = parent.createDiv({ cls: "bookkeeping-setting-order-row" });
      row.dataset.optionField = field;
      const custom = isCustomFieldKey(field)
        ? this.plugin.settings.customFields.find((item) => item.id === customFieldId(field))
        : undefined;
      if (isCustomFieldKey(field) && !custom) {
        row.remove();
        continue;
      }
      const label = custom?.name ?? ENTRY_FIELD_LABELS[field as keyof typeof ENTRY_FIELD_LABELS] ?? "自定义字段";
      const grip = row.createSpan({ cls: "bookkeeping-setting-drag", attr: { title: "拖动排序" } });
      setIcon(grip, "grip-vertical"); grip.draggable = true;
      row.createSpan({ text: label, cls: "bookkeeping-setting-order-name" });
      const fieldActions = row.createDiv({ cls: "bookkeeping-field-actions" });
      const isEnabled = (): boolean => custom ? custom.enabled
        : field === "account" ? this.plugin.settings.enableAccount
        : field === "category" ? this.plugin.settings.enableCategory
        : field === "type" ? this.plugin.settings.enableType
        : field === "necessity" ? this.plugin.settings.enableNecessity
        : field === "attachments" ? this.plugin.settings.enableEntryAttachments
        : field === "note" ? this.plugin.settings.enableNote
        : true;
      const canToggle = Boolean(custom) || field === "account" || field === "category" || field === "type" || field === "necessity" || field === "attachments" || field === "note";
      if (canToggle) {
        const eye = fieldActions.createEl("button", { cls: "clickable-icon bookkeeping-field-eye", attr: { type: "button", "aria-label": `${isEnabled() ? "关闭" : "启用"}${label}` } });
        const renderEye = (): void => {
          setIcon(eye, isEnabled() ? "eye" : "eye-off");
          eye.setAttribute("aria-label", `${isEnabled() ? "关闭" : "启用"}${label}`);
          eye.toggleClass("is-active", isEnabled());
        };
        renderEye();
        eye.addEventListener("click", () => { void (async () => {
          const next = !isEnabled();
          if (custom) custom.enabled = next;
          else if (field === "account") this.plugin.settings.enableAccount = next;
          else if (field === "category") this.plugin.settings.enableCategory = next;
          else if (field === "type") this.plugin.settings.enableType = next;
          else if (field === "necessity") this.plugin.settings.enableNecessity = next;
          else if (field === "attachments") this.plugin.settings.enableEntryAttachments = next;
          else this.plugin.settings.enableNote = next;
          renderEye();
          await this.plugin.saveSettingsQuietly();
        })(); });
      } else fieldActions.createSpan({ cls: "bookkeeping-field-required" });
      if (custom) {
        const edit = fieldActions.createEl("button", { cls: "clickable-icon", attr: { type: "button", "aria-label": `编辑${label}` } });
        setIcon(edit, "pencil");
        edit.addEventListener("click", () => new CustomFieldModal(this.app, this.plugin, custom, () => this.update()).open());
        const remove = fieldActions.createEl("button", { cls: "clickable-icon mod-warning bookkeeping-field-delete", attr: { type: "button", "aria-label": `删除${label}` } });
        setIcon(remove, "trash-2");
        remove.addEventListener("click", () => new DeleteCustomFieldModal(this.app, custom, (clearHistory) => void this.deleteCustomField(custom, clearHistory)).open());
      }
      grip.addEventListener("dragstart", () => { this.draggedOption = field; row.addClass("is-dragging"); });
      grip.addEventListener("dragend", () => { this.draggedOption = null; row.removeClass("is-dragging"); });
      row.addEventListener("dragover", (event) => event.preventDefault());
      row.addEventListener("drop", () => { void (async () => {
        if (!this.draggedOption || this.draggedOption === field) return;
        this.plugin.settings.optionFieldOrder = this.reorder(this.plugin.settings.optionFieldOrder, this.draggedOption, field);
        await this.plugin.saveSettingsQuietly();
        this.renderEntryFields(parent);
      })(); });
      bindPointerSort({
        root: parent,
        item: row,
        handle: grip,
        itemSelector: ".bookkeeping-setting-order-row",
        onCommit: async () => {
          this.plugin.settings.optionFieldOrder = Array.from(parent.querySelectorAll<HTMLElement>(".bookkeeping-setting-order-row"))
            .map((element) => element.dataset.optionField)
            .filter((value): value is EntryField => Boolean(value));
          await this.plugin.saveSettingsQuietly();
          this.renderEntryFields(parent);
        }
      });
    }
  }

  private async deleteCustomField(custom: CustomFieldConfig, clearHistory: boolean): Promise<void> {
    let cleared = 0;
    if (clearHistory) cleared = await this.plugin.store.clearCustomFieldProperties([custom.property]);
    const key = customFieldKey(custom.id);
    this.plugin.settings.customFields = this.plugin.settings.customFields.filter((item) => item.id !== custom.id);
    this.plugin.settings.optionFieldOrder = this.plugin.settings.optionFieldOrder.filter((item) => item !== key);
    this.plugin.settings.tableColumnOrder = this.plugin.settings.tableColumnOrder.filter((item) => item !== key);
    this.plugin.settings.visibleTableColumns = this.plugin.settings.visibleTableColumns.filter((item) => item !== key);
    this.plugin.settings.editableColumns = this.plugin.settings.editableColumns.filter((item) => item !== key);
    delete this.plugin.settings.tableColumnLabels[key];
    delete this.plugin.settings.tableColumnWidths[key];
    delete this.plugin.settings.savedDashboardFilters.customFields[custom.id];
    for (const filters of Object.values(this.plugin.settings.savedMonthlyDashboardFilters)) delete filters.customFields[custom.id];
    await this.plugin.saveSettingsQuietly();
    this.plugin.notice(clearHistory ? `已删除“${custom.name}”，并从${cleared}笔原有账目中清除该属性` : `已删除“${custom.name}”，原有Markdown属性已保留`);
    this.update();
  }

  private renderColumnRows(parent: HTMLElement): void {
    parent.empty();
    for (const column of this.plugin.settings.tableColumnOrder) {
      const row = parent.createDiv({ cls: "bookkeeping-column-config-row" });
      row.dataset.column = column;
      const left = row.createDiv({ cls: "bookkeeping-column-config-name" });
      const grip = left.createSpan({ cls: "bookkeeping-setting-drag", attr: { title: "拖动排序" } });
      setIcon(grip, "grip-vertical"); grip.draggable = true;
      const defaultLabel = isCustomFieldKey(column)
        ? (this.plugin.settings.customFields.find((field) => field.id === customFieldId(column))?.name ?? "自定义字段")
        : TABLE_COLUMN_LABELS[column];
      const input = left.createEl("input", { type: "text", value: this.plugin.settings.tableColumnLabels[column] || defaultLabel, attr: { "aria-label": `修改${defaultLabel}表头名称` } });
      input.addEventListener("change", () => { void (async () => {
        this.plugin.settings.tableColumnLabels[column] = input.value.trim() || defaultLabel;
        input.value = this.plugin.settings.tableColumnLabels[column];
        await this.plugin.saveSettingsQuietly();
      })(); });
      const actions = row.createDiv({ cls: "bookkeeping-column-config-actions" });
      const eye = actions.createEl("button", { cls: "clickable-icon", attr: { type: "button", "aria-label": "切换表头显示" } });
      const renderEye = (): void => setIcon(eye, this.plugin.settings.visibleTableColumns.includes(column) ? "eye" : "eye-off");
      renderEye();
      eye.addEventListener("click", () => { void (async () => {
        this.plugin.settings.visibleTableColumns = this.plugin.settings.visibleTableColumns.includes(column)
          ? this.plugin.settings.visibleTableColumns.filter((value) => value !== column)
          : [...this.plugin.settings.visibleTableColumns, column];
        renderEye(); await this.plugin.saveSettingsQuietly();
      })(); });
      const edit = actions.createEl("button", { cls: "clickable-icon", attr: { type: "button", "aria-label": "切换行内编辑" } });
      const canEdit = !["actions", "attachments"].includes(column);
      edit.disabled = !canEdit;
      const renderEdit = (): void => { setIcon(edit, "pencil"); edit.toggleClass("is-active", this.plugin.settings.editableColumns.includes(column)); };
      renderEdit();
      edit.addEventListener("click", () => { void (async () => {
        if (!canEdit) return;
        this.plugin.settings.editableColumns = this.plugin.settings.editableColumns.includes(column)
          ? this.plugin.settings.editableColumns.filter((value) => value !== column)
          : [...this.plugin.settings.editableColumns, column];
        renderEdit(); await this.plugin.saveSettingsQuietly();
      })(); });
      grip.addEventListener("dragstart", () => { this.draggedColumn = column; row.addClass("is-dragging"); });
      grip.addEventListener("dragend", () => { this.draggedColumn = null; row.removeClass("is-dragging"); });
      row.addEventListener("dragover", (event) => event.preventDefault());
      row.addEventListener("drop", () => { void (async () => {
        if (!this.draggedColumn || this.draggedColumn === column) return;
        this.plugin.settings.tableColumnOrder = this.reorder(this.plugin.settings.tableColumnOrder, this.draggedColumn, column);
        await this.plugin.saveSettingsQuietly();
        this.renderColumnRows(parent);
      })(); });
      bindPointerSort({
        root: parent,
        item: row,
        handle: grip,
        itemSelector: ".bookkeeping-column-config-row",
        onCommit: async () => {
          this.plugin.settings.tableColumnOrder = Array.from(parent.querySelectorAll<HTMLElement>(".bookkeeping-column-config-row"))
            .map((element) => element.dataset.column)
            .filter((value): value is TableColumn => Boolean(value));
          await this.plugin.saveSettingsQuietly();
          this.renderColumnRows(parent);
        }
      });
    }
  }

  private folderSetting(name: string, value: string, assign: (value: string) => Promise<void>): void {
    new Setting(this.containerEl).setName(name).addText((text) => {
      text.setValue(value).onChange((next) => { void (async () => { await assign(next.trim()); await this.plugin.saveSettingsQuietly(); })(); });
      this.attachVaultFolderSuggestions(text.inputEl);
    });
  }

  private attachVaultFolderSuggestions(input: HTMLInputElement): void {
    new VaultFolderSuggest(this.app, input);
  }

  private shortcutSetting(name: string, key: keyof typeof this.plugin.settings.keyboardShortcuts): void {
    this.shortcutCaptureSetting(name, this.plugin.settings.keyboardShortcuts[key], false, DEFAULT_SETTINGS.keyboardShortcuts[key], key === "close", async (value) => {
      this.plugin.settings.keyboardShortcuts[key] = value || DEFAULT_SETTINGS.keyboardShortcuts[key];
      await this.plugin.saveSettingsQuietly();
    });
  }

  private shortcutCaptureSetting(name: string, initial: string, allowEmpty: boolean, resetValue: string, captureEscape: boolean, save: (value: string) => Promise<void>): void {
    let value = initial;
    let recording = false;
    const setting = new Setting(this.containerEl).setName(name);
    setting.addText((text) => {
      const input = text.inputEl;
      input.readOnly = true;
      input.addClass("bookkeeping-shortcut-capture");
      text.setPlaceholder("点击后按下快捷键").setValue(this.displayShortcut(value));
      const stop = (): void => {
        recording = false;
        input.removeClass("is-recording");
        text.setValue(this.displayShortcut(value));
      };
      input.addEventListener("focus", () => {
        recording = true;
        input.addClass("is-recording");
        text.setValue("请按下快捷键…");
      });
      input.addEventListener("blur", stop);
      input.addEventListener("keydown", (event) => { void (async () => {
        if (!recording) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape" && !captureEscape) return void stop();
        if (allowEmpty && (event.key === "Backspace" || event.key === "Delete")) {
          value = "";
          stop();
          await save(value);
          return;
        }
        const captured = this.formatShortcut(event);
        if (!captured) return;
        value = captured;
        stop();
        await save(value);
      })(); });
    });
    setting.addButton((button) => button.setButtonText("还原默认").setIcon("rotate-ccw").setTooltip(allowEmpty ? "还原为未设置" : "还原默认快捷键").onClick(() => { void (async () => {
      value = resetValue;
      const input = setting.controlEl.querySelector<HTMLInputElement>("input");
      if (input) input.value = this.displayShortcut(resetValue);
      await save(resetValue);
    })(); }));
  }

  private formatShortcut(event: KeyboardEvent): string {
    if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return "";
    const parts: string[] = [];
    if (event.ctrlKey) parts.push("Ctrl");
    if (event.metaKey) parts.push("Meta");
    if (event.altKey) parts.push("Alt");
    if (event.shiftKey) parts.push("Shift");
    const aliases: Record<string, string> = { " ": "Space", Esc: "Escape" };
    const raw = aliases[event.key] ?? event.key;
    const key = raw.length === 1 ? raw.toUpperCase() : raw;
    parts.push(key);
    return parts.join("+");
  }

  private displayShortcut(value: string): string {
    const labels: Record<string, string> = {
      Escape: "Esc",
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
      Backspace: "⌫",
      Delete: "Del",
      Meta: "Cmd"
    };
    return value.split("+").map((part) => labels[part] ?? part).join("+");
  }

  private reorder<T>(items: T[], source: T, target: T): T[] {
    const result = [...items];
    const from = result.indexOf(source), to = result.indexOf(target);
    if (from < 0 || to < 0) return result;
    const [moved] = result.splice(from, 1);
    if (moved !== undefined) result.splice(to, 0, moved);
    return result;
  }
}

class CustomFieldModal extends Modal {
  private name: string;
  private kind: CustomFieldKind;
  private optionsText: string;

  constructor(
    app: App,
    private readonly plugin: BookkeepingPlugin,
    private readonly existing: CustomFieldConfig | null,
    private readonly onSaved: () => void
  ) {
    super(app);
    this.name = existing?.name ?? "";
    this.kind = existing?.kind ?? "text";
    const orderedOptions = existing?.kind === "select" && existing.defaultValue
      ? [existing.defaultValue, ...existing.options.filter((option) => option !== existing.defaultValue)]
      : (existing?.options ?? []);
    this.optionsText = orderedOptions.join("\n");
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal", "bookkeeping-custom-field-modal");
    this.setTitle(this.existing ? "编辑录入字段" : "新增录入字段");
    const nameSetting = new Setting(this.contentEl).setName("字段名称")
      .addText((text) => text.setValue(this.name).onChange((value) => this.name = value.trim()));
    nameSetting.settingEl.addClass("bookkeeping-custom-field-primary-setting");
    const typeSetting = new Setting(this.contentEl).setName("字段类型").addDropdown((dropdown) => dropdown
      .addOptions({ text: "内容型", select: "分类型" })
      .setValue(this.kind)
      .onChange((value) => {
        this.kind = value === "select" ? "select" : "text";
        optionsSetting.settingEl.toggleClass("bookkeeping-hidden", this.kind !== "select");
      }));
    typeSetting.settingEl.addClass("bookkeeping-custom-field-primary-setting");
    const optionsSetting = new Setting(this.contentEl).setName("预设选项").setDesc("每行只能填写一个选项，第一行为默认录入值。")
      .addTextArea((text) => {
        text.inputEl.rows = 6;
        text.setValue(this.optionsText).onChange((value) => this.optionsText = value);
      });
    optionsSetting.settingEl.toggleClass("bookkeeping-hidden", this.kind !== "select");
    const desc = this.contentEl.createEl("p", { cls: "setting-item-description", text: "内容型可以自由输入；分类型从预设中选择。" });
    desc.setAttribute("role", "note");
    const error = this.contentEl.createDiv({ cls: "bookkeeping-form-error" });
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText(this.existing ? "保存修改" : "新增字段").setCta().onClick(() => { void (async () => {
      error.empty();
      const name = this.name.trim();
      const options = [...new Set(this.optionsText.split(/\r?\n/).map((option) => option.trim()).filter(Boolean))];
      const duplicate = this.plugin.settings.customFields.some((field) => field !== this.existing && (field.name.toLocaleLowerCase() === name.toLocaleLowerCase() || field.property.toLocaleLowerCase() === name.toLocaleLowerCase()));
      if (!name) return void error.setText("字段名称不能为空");
      if (duplicate) return void error.setText("字段名称不能与其他自定义字段重复");
      if (isReservedTransactionProperty(name) && (!this.existing || name !== this.existing.name)) return void error.setText("字段名称不能与内置Markdown属性重复");
      if (this.kind === "select" && !options.length) return void error.setText("分类型字段至少需要一个预设选项");
      if (this.existing) {
        const oldName = this.existing.name;
        const wasSelect = this.existing.kind === "select";
        const usedCodes = new Set<string>();
        const nextCodes: Record<string, string> = {};
        options.forEach((option, index) => {
          let code = this.existing?.optionCodes[option] ?? String(index + 1);
          while (usedCodes.has(code.toLocaleLowerCase())) code = String(index + 1 + usedCodes.size);
          usedCodes.add(code.toLocaleLowerCase());
          nextCodes[option] = code;
        });
        this.existing.name = name;
        this.existing.kind = this.kind;
        this.existing.options = this.kind === "select" ? options : [];
        this.existing.optionCodes = this.kind === "select" ? nextCodes : {};
        this.existing.defaultValue = this.kind === "select" ? (options[0] ?? "") : "";
        if (this.kind === "select" && !wasSelect) {
          this.existing.initialOptions = [...options];
          this.existing.initialOptionCodes = { ...nextCodes };
          this.existing.initialDefaultValue = options[0] ?? "";
        }
        const key = customFieldKey(this.existing.id);
        if (!this.plugin.settings.tableColumnLabels[key] || this.plugin.settings.tableColumnLabels[key] === oldName) this.plugin.settings.tableColumnLabels[key] = name;
      } else {
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const optionCodes = Object.fromEntries(options.map((option, index) => [option, String(index + 1)]));
        const field: CustomFieldConfig = {
          id,
          name,
          property: name,
          kind: this.kind,
          options: this.kind === "select" ? options : [],
          optionCodes: this.kind === "select" ? optionCodes : {},
          defaultValue: this.kind === "select" ? (options[0] ?? "") : "",
          initialOptions: this.kind === "select" ? [...options] : [],
          initialOptionCodes: this.kind === "select" ? { ...optionCodes } : {},
          initialDefaultValue: this.kind === "select" ? (options[0] ?? "") : "",
          enabled: true
        };
        const key = customFieldKey(id);
        this.plugin.settings.customFields.push(field);
        const attachmentIndex = this.plugin.settings.optionFieldOrder.indexOf("attachments");
        this.plugin.settings.optionFieldOrder.splice(attachmentIndex >= 0 ? attachmentIndex : this.plugin.settings.optionFieldOrder.length, 0, key);
        const actionIndex = this.plugin.settings.tableColumnOrder.indexOf("actions");
        this.plugin.settings.tableColumnOrder.splice(actionIndex >= 0 ? actionIndex : this.plugin.settings.tableColumnOrder.length, 0, key);
        this.plugin.settings.visibleTableColumns.push(key);
        this.plugin.settings.editableColumns.push(key);
        this.plugin.settings.tableColumnLabels[key] = name;
      }
      await this.plugin.saveSettingsQuietly();
      this.close();
      this.onSaved();
    })(); });
    window.setTimeout(() => nameSetting.controlEl.querySelector<HTMLInputElement>("input")?.focus(), 50);
    void typeSetting;
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class CommunityPanelModal extends Modal {
  constructor(
    app: App,
    private readonly kind: "sponsor" | "feedback"
  ) { super(app); }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal", "bookkeeping-community-modal");
    this.modalEl.toggleClass("is-mobile", Platform.isMobile);
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    const sponsor = this.kind === "sponsor";
    this.setTitle(sponsor ? "赞助与支持" : "问题反馈");
    const cards = this.contentEl.createDiv({ cls: `bookkeeping-community-cards${sponsor ? " is-sponsor" : ""}` });
    const resources = sponsor
      ? [{ alt: "微信与支付宝收款码", url: sponsorQrUrl }]
      : [{ alt: "QQ群588526922二维码", url: qqGroupUrl }];
    for (const resource of resources) {
      const card = cards.createDiv({ cls: "bookkeeping-community-card" });
      const frame = card.createDiv({ cls: "bookkeeping-community-qr" });
      frame.createEl("img", { attr: { src: resource.url, alt: resource.alt } });
    }
    const links = this.contentEl.createDiv({ cls: "bookkeeping-community-links" });
    new Setting(links).setName("作者GitHub主页").addButton((button) => button.setButtonText("打开GitHub").setIcon("github").onClick(() => window.open(PROJECT_URL, "_blank")));
    new Setting(links).setName("作者B站主页").addButton((button) => button.setButtonText("打开B站").setIcon("external-link").onClick(() => window.open(BILIBILI_URL, "_blank")));
    if (!sponsor) new Setting(links).setName("问题反馈").addButton((button) => button.setButtonText("打开GitHub Issues").setIcon("message-square-warning").onClick(() => window.open(ISSUES_URL, "_blank")));
  }

}

class LanguagePackModal extends Modal {
  constructor(
    app: App,
    private readonly plugin: BookkeepingPlugin,
    private readonly onChanged: () => void
  ) { super(app); }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal", "bookkeeping-language-pack-modal");
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    this.setTitle("语言包管理");
    for (const [languageKey, name] of Object.entries(LANGUAGE_OPTIONS)) {
      const language = toLanguage(languageKey);
      const builtIn = language === "zh-CN";
      const removed = this.plugin.settings.disabledLanguages.includes(language);
      new Setting(this.contentEl).setName(name).addButton((button) => {
        if (builtIn) {
          button.setButtonText("内置").setDisabled(true);
          return;
        }
        button.setButtonText(removed ? "恢复" : "删除");
        if (!removed) {
          button.setDestructive();
          button.buttonEl.addClass("bookkeeping-danger-button");
        }
        button.onClick(() => { void (async () => {
          this.plugin.settings.disabledLanguages = removed
            ? this.plugin.settings.disabledLanguages.filter((value) => value !== language)
            : [...new Set([...this.plugin.settings.disabledLanguages, language])];
          if (!removed && this.plugin.settings.language === language) this.plugin.settings.language = "zh-CN";
          await this.plugin.saveSettingsQuietly();
          this.plugin.applyLanguage();
          this.onChanged();
          this.render();
        })(); });
      });
    }
    this.plugin.applyLanguage(this.modalEl);
  }
}

class DeleteCustomFieldModal extends Modal {
  constructor(app: App, private readonly field: CustomFieldConfig, private readonly onConfirm: (clearHistory: boolean) => void) { super(app); }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    this.setTitle("删除录入字段");
    this.contentEl.createEl("p", { text: `确定删除录入字段“${this.field.name}”吗？` });
    this.contentEl.createEl("p", {
      text: `“仅删除配置”会保留原有Markdown中的“${this.field.property}”属性；“删除并清理历史账目”会从所有原有账目中永久移除该属性。`,
      cls: "setting-item-description"
    });
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    const removeConfig = new ButtonComponent(actions).setButtonText("仅删除配置");
    removeConfig.buttonEl.addClass("bookkeeping-danger-button");
    removeConfig.onClick(() => {
      this.close();
      this.onConfirm(false);
    });
    const removeHistory = new ButtonComponent(actions).setButtonText("删除并清理历史账目").setDestructive();
    removeHistory.buttonEl.addClass("bookkeeping-danger-button");
    removeHistory.onClick(() => {
      this.close();
      this.onConfirm(true);
    });
  }
}

class CustomSelectPresetModal extends Modal {
  private draggedOption = "";

  constructor(app: App, private readonly plugin: BookkeepingPlugin, private readonly fieldId: string) { super(app); }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal", "bookkeeping-preset-manager-modal", "bookkeeping-custom-preset-modal");
    this.modalEl.toggleClass("is-mobile", Platform.isMobile);
    this.render();
  }

  private field(): CustomFieldConfig | undefined {
    return this.plugin.settings.customFields.find((field) => field.id === this.fieldId && field.kind === "select");
  }

  private render(): void {
    const scroll = this.contentEl.scrollTop;
    this.contentEl.empty();
    const field = this.field();
    if (!field) {
      this.setTitle("预设不存在");
      this.contentEl.createEl("p", { text: "该分类型字段已被删除或改为内容型。" });
      return;
    }
    this.setTitle(`${field.name}预设`);
    new Setting(this.contentEl).setName("默认录入值").addDropdown((dropdown) => dropdown
      .addOptions(optionRecord(field.options))
      .setValue(field.defaultValue)
      .onChange((value) => { void (async () => {
        field.defaultValue = value;
        await this.plugin.saveSettingsQuietly();
      })(); }));
    const header = this.contentEl.createDiv({ cls: "bookkeeping-config-table-header" });
    header.createSpan({ text: "名称" });
    header.createSpan({ text: "编号" });
    header.createSpan({ text: "删除" });
    const list = this.contentEl.createDiv({ cls: "bookkeeping-preset-manager-list" });
    for (const option of field.options) this.renderOptionRow(list, field, option);

    const addRow = this.contentEl.createDiv({ cls: "bookkeeping-preset-add-row" });
    addRow.createSpan({ cls: "bookkeeping-preset-add-spacer" });
    const input = addRow.createEl("input", { type: "text", attr: { placeholder: "新预设名称", "aria-label": "新预设名称" } });
    const codeInput = addRow.createEl("input", { type: "text", attr: { placeholder: "编号", "aria-label": "录入编号" } });
    const add = addRow.createEl("button", { cls: "mod-cta", text: "添加", attr: { type: "button" } });
    const commit = async (): Promise<void> => {
      const value = input.value.trim();
      const code = codeInput.value.trim();
      if (!value || !code) return void this.plugin.notice("名称和编号不能为空");
      if (field.options.includes(value)) return void this.plugin.notice("预设名称不能重复");
      if (Object.values(field.optionCodes).some((item) => item.toLocaleLowerCase() === code.toLocaleLowerCase())) return void this.plugin.notice("同一组选项的编号不能重复");
      field.options.push(value);
      field.optionCodes[value] = code;
      await this.plugin.saveSettingsQuietly();
      this.render();
    };
    add.addEventListener("click", () => void commit());
    [input, codeInput].forEach((element) => element.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); void commit(); }
    }));
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-preset-finish-row" });
    new ButtonComponent(actions).setButtonText("恢复默认").onClick(() => { void (async () => {
      field.options = [...field.initialOptions];
      field.optionCodes = { ...field.initialOptionCodes };
      field.defaultValue = field.initialOptions.includes(field.initialDefaultValue) ? field.initialDefaultValue : (field.initialOptions[0] ?? "");
      await this.plugin.saveSettingsQuietly();
      this.render();
    })(); });
    new ButtonComponent(actions).setButtonText("完成").setCta().onClick(() => this.close());
    this.contentEl.scrollTop = scroll;
    this.plugin.applyLanguage(this.modalEl);
  }

  private renderOptionRow(list: HTMLElement, field: CustomFieldConfig, option: string): void {
    const row = list.createDiv({ cls: "bookkeeping-preset-manager-row" });
    row.dataset.key = option;
    const grip = row.createSpan({ cls: "bookkeeping-setting-drag", attr: { title: "拖动排序" } });
    setIcon(grip, "grip-vertical");
    grip.draggable = true;
    const input = row.createEl("input", { type: "text", value: option, attr: { "aria-label": "预设名称" } });
    input.addEventListener("change", () => { void (async () => {
      const value = input.value.trim();
      if (!value || field.options.some((item) => item !== option && item === value)) {
        this.plugin.notice(value ? "预设名称不能重复" : "预设名称不能为空");
        input.value = option;
        return;
      }
      const index = field.options.indexOf(option);
      if (index >= 0) field.options[index] = value;
      field.optionCodes[value] = field.optionCodes[option] ?? String(index + 1);
      delete field.optionCodes[option];
      if (field.defaultValue === option) field.defaultValue = value;
      await this.plugin.store.renameCustomFieldValueGlobally(field.property, option, value);
      await this.plugin.saveSettingsQuietly();
      this.render();
    })(); });
    const code = row.createEl("input", { type: "text", value: field.optionCodes[option] ?? "", attr: { "aria-label": "录入编号" } });
    code.addEventListener("change", () => { void (async () => {
      const next = code.value.trim();
      if (!next || field.options.some((item) => item !== option && field.optionCodes[item]?.toLocaleLowerCase() === next.toLocaleLowerCase())) {
        this.plugin.notice(!next ? "编号不能为空" : "同一组选项的编号不能重复");
        code.value = field.optionCodes[option] ?? "";
        return;
      }
      field.optionCodes[option] = next;
      await this.plugin.saveSettingsQuietly();
    })(); });
    const remove = row.createEl("button", { cls: "clickable-icon mod-warning", attr: { type: "button", "aria-label": `删除${option}` } });
    setIcon(remove, "trash-2");
    remove.disabled = field.options.length <= 1;
    remove.addEventListener("click", () => { void (async () => {
      field.options = field.options.filter((item) => item !== option);
      delete field.optionCodes[option];
      if (field.defaultValue === option) field.defaultValue = field.options[0] ?? "";
      await this.plugin.saveSettingsQuietly();
      this.render();
    })(); });
    grip.addEventListener("dragstart", () => { this.draggedOption = option; row.addClass("is-dragging"); });
    grip.addEventListener("dragend", () => { this.draggedOption = ""; row.removeClass("is-dragging"); });
    row.addEventListener("dragover", (event) => event.preventDefault());
    row.addEventListener("drop", () => { void (async () => {
      if (!this.draggedOption || this.draggedOption === option) return;
      const from = field.options.indexOf(this.draggedOption);
      const to = field.options.indexOf(option);
      if (from < 0 || to < 0) return;
      const [moved] = field.options.splice(from, 1);
      if (moved !== undefined) field.options.splice(to, 0, moved);
      await this.plugin.saveSettingsQuietly();
      this.render();
    })(); });
    bindPointerSort({
      root: list,
      item: row,
      handle: grip,
      itemSelector: ".bookkeeping-preset-manager-row",
      onCommit: async () => {
        field.options = Array.from(list.querySelectorAll<HTMLElement>(".bookkeeping-preset-manager-row"))
          .map((element) => element.dataset.key)
          .filter((value): value is string => Boolean(value));
        await this.plugin.saveSettingsQuietly();
        this.render();
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class PresetManagerModal extends Modal {
  private categoryIncome = false;
  private draggedKey = "";

  constructor(app: App, private readonly plugin: BookkeepingPlugin, private readonly group: PresetGroup) { super(app); }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal", "bookkeeping-preset-manager-modal");
    this.modalEl.toggleClass("is-mobile", Platform.isMobile);
    this.render();
  }

  private render(): void {
    const scroll = this.contentEl.scrollTop;
    this.contentEl.empty();
    const title = ({ type: "类型", necessity: "必要性", category: "分类", account: "账户" } as Record<PresetGroup, string>)[this.group];
    this.setTitle(`${title}预设`);
    if (this.group === "category") {
      const categorySwitch = new Setting(this.contentEl).setName("分类板块").addDropdown((dropdown) => dropdown.addOptions({ expense: "支出分类", income: "收入分类" }).setValue(this.categoryIncome ? "income" : "expense").onChange((value) => { this.categoryIncome = value === "income"; this.render(); }));
      categorySwitch.settingEl.addClass("bookkeeping-category-switch");
    }
    this.renderDefaultSetting();
    const header = this.contentEl.createDiv({ cls: `bookkeeping-config-table-header${this.group === "type" ? " has-effect" : ""}` });
    header.createSpan({ text: "名称" });
    header.createSpan({ text: "编号" });
    if (this.group === "type") header.createSpan({ text: "计入方式" });
    header.createSpan({ text: "删除" });
    const list = this.contentEl.createDiv({ cls: "bookkeeping-preset-manager-list" });
    if (this.group === "type") this.renderTypeRows(list);
    else if (this.group === "necessity") this.renderNecessityRows(list);
    else if (this.group === "category") this.renderCategoryRows(list);
    else this.renderAccountRows(list);
    this.renderAddRow();
    const actions = this.contentEl.createDiv({ cls: `bookkeeping-preset-finish-row${this.group === "type" ? " has-effect" : ""}` });
    new ButtonComponent(actions).setButtonText("恢复默认").onClick(() => void this.resetPresetGroup());
    new ButtonComponent(actions).setButtonText("完成").setCta().onClick(() => this.close());
    window.requestAnimationFrame(() => this.contentEl.scrollTop = scroll);
  }

  private renderDefaultSetting(): void {
    if (this.group === "type") new Setting(this.contentEl).setName("默认录入值").addDropdown((dropdown) => dropdown.addOptions(optionRecord(this.plugin.settings.typeOrder, this.plugin.settings.typeLabels)).setValue(this.plugin.settings.defaultType).onChange((value) => { void (async () => {
      this.plugin.settings.defaultType = value; await this.plugin.saveSettingsQuietly();
    })(); }));
    else if (this.group === "necessity") new Setting(this.contentEl).setName("默认录入值").addDropdown((dropdown) => dropdown.addOptions(optionRecord(this.plugin.settings.necessityOrder, this.plugin.settings.necessityLabels)).setValue(this.plugin.settings.defaultNecessity).onChange((value) => { void (async () => {
      this.plugin.settings.defaultNecessity = value; await this.plugin.saveSettingsQuietly();
    })(); }));
    else if (this.group === "category") {
      const names = this.categoryIncome ? this.plugin.settings.incomeCategories : this.plugin.settings.categories;
      new Setting(this.contentEl).setName("默认录入值").addDropdown((dropdown) => dropdown.addOptions(optionRecord(names)).setValue(this.categoryIncome ? this.plugin.settings.defaultIncomeCategory : this.plugin.settings.defaultCategory).onChange((value) => { void (async () => {
        if (!this.categoryIncome) this.plugin.settings.defaultCategory = value;
        else this.plugin.settings.defaultIncomeCategory = value;
        await this.plugin.saveSettingsQuietly();
      })(); }));
    } else new Setting(this.contentEl).setName("默认录入值").addDropdown((dropdown) => dropdown.addOptions(optionRecord(this.plugin.settings.accounts.map((account) => account.name))).setValue(this.plugin.settings.defaultAccount).onChange((value) => { void (async () => {
      this.plugin.settings.defaultAccount = value; await this.plugin.saveSettingsQuietly();
    })(); }));
  }

  private async resetPresetGroup(): Promise<void> {
    if (this.group === "type") {
      this.plugin.settings.typeOrder = [...DEFAULT_SETTINGS.typeOrder];
      this.plugin.settings.typeLabels = { ...DEFAULT_SETTINGS.typeLabels };
      this.plugin.settings.typeCodes = { ...DEFAULT_SETTINGS.typeCodes };
      this.plugin.settings.typeEffects = { ...DEFAULT_SETTINGS.typeEffects };
      this.plugin.settings.defaultType = DEFAULT_SETTINGS.defaultType;
    } else if (this.group === "necessity") {
      this.plugin.settings.necessityOrder = [...DEFAULT_SETTINGS.necessityOrder];
      this.plugin.settings.necessityLabels = { ...DEFAULT_SETTINGS.necessityLabels };
      this.plugin.settings.necessityCodes = { ...DEFAULT_SETTINGS.necessityCodes };
      this.plugin.settings.defaultNecessity = DEFAULT_SETTINGS.defaultNecessity;
    } else if (this.group === "category") {
      if (this.categoryIncome) {
        this.plugin.settings.incomeCategories = [...DEFAULT_SETTINGS.incomeCategories];
        this.plugin.settings.incomeCategoryCodes = { ...DEFAULT_SETTINGS.incomeCategoryCodes };
        this.plugin.settings.defaultIncomeCategory = DEFAULT_SETTINGS.defaultIncomeCategory;
      } else {
        this.plugin.settings.categories = [...DEFAULT_SETTINGS.categories];
        this.plugin.settings.categoryCodes = { ...DEFAULT_SETTINGS.categoryCodes };
        this.plugin.settings.defaultCategory = DEFAULT_SETTINGS.defaultCategory;
      }
    } else {
      this.plugin.settings.accounts = DEFAULT_SETTINGS.accounts.map((account) => ({ ...account }));
      this.plugin.settings.defaultAccount = DEFAULT_SETTINGS.defaultAccount;
    }
    await this.plugin.saveSettingsQuietly();
    this.render();
  }

  private renderTypeRows(list: HTMLElement): void {
    for (const type of this.plugin.settings.typeOrder) {
      const row = this.row(list, type, true);
      const name = row.createEl("input", { type: "text", value: this.plugin.settings.typeLabels[type] ?? type, attr: { "aria-label": "类型名称" } });
      name.addEventListener("change", () => { void (async () => {
        const next = name.value.trim();
        if (!next || this.plugin.settings.typeOrder.some((value) => value !== type && this.plugin.settings.typeLabels[value] === next)) {
          this.plugin.notice(next ? "类型名称不能重复" : "类型名称不能为空"); name.value = this.plugin.settings.typeLabels[type] ?? type; return;
        }
        this.plugin.settings.typeLabels[type] = next; await this.plugin.saveSettingsQuietly();
      })(); });
      this.codeInput(row, this.plugin.settings.typeCodes[type] ?? "", Object.entries(this.plugin.settings.typeCodes).filter(([key]) => key !== type).map(([, code]) => code), async (value) => { this.plugin.settings.typeCodes[type] = value; });
      const effect = row.createEl("select", { attr: { "aria-label": "计入方式" } });
      [["positive", "+收入"], ["negative", "−支出"], ["neutral", "不计入"]].forEach(([value, label]) => effect.createEl("option", { value, text: label }));
      effect.value = this.plugin.settings.typeEffects[type] ?? "neutral";
      effect.addEventListener("change", () => { void (async () => { this.plugin.settings.typeEffects[type] = toTypeEffect(effect.value); await this.plugin.saveSettingsQuietly(); })(); });
      const remove = row.createEl("button", { cls: "clickable-icon mod-warning", attr: { type: "button", "aria-label": "删除类型" } }); setIcon(remove, "trash-2");
      remove.disabled = this.plugin.settings.typeOrder.length <= 1;
      remove.addEventListener("click", () => { void (async () => {
        this.plugin.settings.typeOrder = this.plugin.settings.typeOrder.filter((value) => value !== type);
        delete this.plugin.settings.typeCodes[type];
        if (this.plugin.settings.defaultType === type) this.plugin.settings.defaultType = this.plugin.settings.typeOrder[0] ?? "支出";
        await this.plugin.saveSettingsQuietly(); this.render();
      })(); });
      this.makePresetDraggable(row, type, () => this.plugin.settings.typeOrder, (values) => this.plugin.settings.typeOrder = typeOrder(values));
    }
  }

  private renderNecessityRows(list: HTMLElement): void {
    for (const value of this.plugin.settings.necessityOrder) {
      const row = this.row(list, value);
      const name = row.createEl("input", { type: "text", value: this.plugin.settings.necessityLabels[value] ?? value, attr: { "aria-label": "必要性名称" } });
      name.addEventListener("change", () => { void (async () => {
        const next = name.value.trim();
        if (!next || this.plugin.settings.necessityOrder.some((item) => item !== value && this.plugin.settings.necessityLabels[item] === next)) {
          this.plugin.notice(next ? "必要性名称不能重复" : "必要性名称不能为空"); name.value = this.plugin.settings.necessityLabels[value] ?? value; return;
        }
        this.plugin.settings.necessityLabels[value] = next; await this.plugin.saveSettingsQuietly();
      })(); });
      this.codeInput(row, this.plugin.settings.necessityCodes[value] ?? "", Object.entries(this.plugin.settings.necessityCodes).filter(([key]) => key !== value).map(([, code]) => code), async (code) => { this.plugin.settings.necessityCodes[value] = code; });
      const remove = row.createEl("button", { cls: "clickable-icon mod-warning", attr: { type: "button", "aria-label": "删除必要性" } }); setIcon(remove, "trash-2");
      remove.disabled = this.plugin.settings.necessityOrder.length <= 1;
      remove.addEventListener("click", () => { void (async () => {
        this.plugin.settings.necessityOrder = this.plugin.settings.necessityOrder.filter((item) => item !== value);
        delete this.plugin.settings.necessityCodes[value];
        if (this.plugin.settings.defaultNecessity === value) this.plugin.settings.defaultNecessity = this.plugin.settings.necessityOrder[0] ?? "必需";
        await this.plugin.saveSettingsQuietly(); this.render();
      })(); });
      this.makePresetDraggable(row, value, () => this.plugin.settings.necessityOrder, (values) => this.plugin.settings.necessityOrder = necessityOrder(values));
    }
  }

  private renderCategoryRows(list: HTMLElement): void {
    const names = this.categoryIncome ? this.plugin.settings.incomeCategories : this.plugin.settings.categories;
    const codes = this.categoryIncome ? this.plugin.settings.incomeCategoryCodes : this.plugin.settings.categoryCodes;
    for (const original of names) {
      const row = this.row(list, original);
      const name = row.createEl("input", { type: "text", value: original, attr: { "aria-label": "分类名称" } });
      name.addEventListener("change", () => { void (async () => {
        const next = name.value.trim();
        if (!next || names.some((value) => value !== original && value === next)) return void this.plugin.notice(next ? "分类名称不能重复" : "分类名称不能为空");
        const index = names.indexOf(original); names[index] = next; codes[next] = codes[original] ?? ""; delete codes[original];
        if (!this.categoryIncome && this.plugin.settings.defaultCategory === original) this.plugin.settings.defaultCategory = next;
        if (this.categoryIncome && this.plugin.settings.defaultIncomeCategory === original) this.plugin.settings.defaultIncomeCategory = next;
        await this.plugin.store.renameCategoryGlobally(original, next); await this.plugin.saveSettingsQuietly(); this.render();
      })(); });
      this.codeInput(row, codes[original] ?? "", names.filter((value) => value !== original).map((value) => codes[value]), async (code) => { codes[original] = code; });
      const remove = row.createEl("button", { cls: "clickable-icon mod-warning", attr: { type: "button", "aria-label": "删除分类" } }); setIcon(remove, "trash-2");
      remove.disabled = names.length <= 1;
      remove.addEventListener("click", () => { void (async () => { names.splice(names.indexOf(original), 1); delete codes[original]; if (!this.categoryIncome && this.plugin.settings.defaultCategory === original) this.plugin.settings.defaultCategory = names[0] ?? "未分类"; if (this.categoryIncome && this.plugin.settings.defaultIncomeCategory === original) this.plugin.settings.defaultIncomeCategory = names[0] ?? "未分类"; await this.plugin.saveSettingsQuietly(); this.render(); })(); });
      this.makePresetDraggable(row, original, () => names, (values) => { if (this.categoryIncome) this.plugin.settings.incomeCategories = values; else this.plugin.settings.categories = values; });
    }
  }

  private renderAccountRows(list: HTMLElement): void {
    for (const account of this.plugin.settings.accounts) {
      const row = this.row(list, account.name);
      const name = row.createEl("input", { type: "text", value: account.name, attr: { "aria-label": "账户名称" } });
      name.addEventListener("change", () => { void (async () => {
        const old = account.name, next = name.value.trim();
        if (!next || this.plugin.settings.accounts.some((value) => value !== account && value.name === next)) return void this.plugin.notice(next ? "账户名称不能重复" : "账户名称不能为空");
        account.name = next; if (this.plugin.settings.defaultAccount === old) this.plugin.settings.defaultAccount = next;
        for (const balances of Object.values(this.plugin.settings.monthlyOpeningBalances)) if (old in balances) { balances[next] = balances[old] ?? 0; delete balances[old]; }
        await this.plugin.store.renameAccountGlobally(old, next); await this.plugin.saveSettingsQuietly(); this.render();
      })(); });
      this.codeInput(row, account.code, this.plugin.settings.accounts.filter((value) => value !== account).map((value) => value.code), async (code) => { account.code = code; });
      const remove = row.createEl("button", { cls: "clickable-icon mod-warning", attr: { type: "button", "aria-label": "删除账户" } }); setIcon(remove, "trash-2");
      remove.disabled = this.plugin.settings.accounts.length <= 1;
      remove.addEventListener("click", () => { void (async () => { this.plugin.settings.accounts = this.plugin.settings.accounts.filter((value) => value !== account); if (this.plugin.settings.defaultAccount === account.name) this.plugin.settings.defaultAccount = this.plugin.settings.accounts[0]?.name ?? "默认账户"; await this.plugin.saveSettingsQuietly(); this.render(); })(); });
      this.makePresetDraggable(row, account.name, () => this.plugin.settings.accounts.map((value) => value.name), (values) => this.plugin.settings.accounts = values.map((value) => this.plugin.settings.accounts.find((accountValue) => accountValue.name === value)!).filter(Boolean));
    }
  }

  private row(parent: HTMLElement, key: string, effect = false): HTMLElement {
    const row = parent.createDiv({ cls: `bookkeeping-preset-manager-row${effect ? " has-effect" : ""}` });
    row.dataset.key = key;
    const grip = row.createSpan({ cls: "bookkeeping-setting-drag", attr: { title: "拖动排序" } }); setIcon(grip, "grip-vertical"); grip.draggable = true;
    return row;
  }

  private codeInput(parent: HTMLElement, value: string, others: Array<string | undefined>, assign: (value: string) => Promise<void>): void {
    const input = parent.createEl("input", { type: "text", value, attr: { "aria-label": "录入编号" } });
    input.addEventListener("change", () => { void (async () => {
      const next = input.value.trim();
      if (!next || others.some((code) => code?.toLocaleLowerCase() === next.toLocaleLowerCase())) {
        this.plugin.notice(!next ? "编号不能为空" : "同一组选项的编号不能重复");
        input.value = value; return;
      }
      await assign(next); await this.plugin.saveSettingsQuietly();
    })(); });
  }

  private makePresetDraggable(row: HTMLElement, key: string, values: () => string[], assign: (values: string[]) => void): void {
    const grip = row.querySelector<HTMLElement>(".bookkeeping-setting-drag");
    grip?.addEventListener("dragstart", () => { this.draggedKey = key; row.addClass("is-dragging"); });
    grip?.addEventListener("dragend", () => { this.draggedKey = ""; row.removeClass("is-dragging"); });
    row.addEventListener("dragover", (event) => event.preventDefault());
    row.addEventListener("drop", () => { void (async () => {
      if (!this.draggedKey || this.draggedKey === key) return;
      const result = [...values()]; const from = result.indexOf(this.draggedKey), to = result.indexOf(key);
      if (from < 0 || to < 0) return;
      const [moved] = result.splice(from, 1); if (moved !== undefined) result.splice(to, 0, moved);
      assign(result); await this.plugin.saveSettingsQuietly(); this.render();
    })(); });
    const root = row.parentElement;
    if (grip && root) bindPointerSort({
      root,
      item: row,
      handle: grip,
      itemSelector: ".bookkeeping-preset-manager-row",
      onCommit: async () => {
        const ordered = Array.from(root.querySelectorAll<HTMLElement>(".bookkeeping-preset-manager-row"))
          .map((element) => element.dataset.key)
          .filter((value): value is string => Boolean(value));
        assign(ordered);
        await this.plugin.saveSettingsQuietly();
        this.render();
      }
    });
  }

  private renderAddRow(): void {
    let name = "", code = "", effect: TypeEffect = "neutral";
    const row = this.contentEl.createDiv({ cls: `bookkeeping-preset-add-row${this.group === "type" ? " has-effect" : ""}` });
    row.createSpan({ cls: "bookkeeping-preset-add-spacer" });
    const placeholder = ({ type: "新类型名称", necessity: "新必要性名称", category: "新分类名称", account: "新账户名称" } as Record<PresetGroup, string>)[this.group];
    const nameInput = row.createEl("input", { type: "text", attr: { placeholder } });
    const codeInput = row.createEl("input", { type: "text", attr: { placeholder: "编号" } });
    nameInput.addEventListener("input", () => name = nameInput.value.trim()); codeInput.addEventListener("input", () => code = codeInput.value.trim());
    if (this.group === "type") {
      const effectInput = row.createEl("select", { attr: { "aria-label": "计入方式" } });
      [["positive", "+收入"], ["negative", "−支出"], ["neutral", "不计入"]].forEach(([value, label]) => effectInput.createEl("option", { value, text: label }));
      effectInput.value = effect;
      effectInput.addEventListener("change", () => effect = toTypeEffect(effectInput.value));
    }
    const add = row.createEl("button", { cls: "mod-cta", text: "添加", attr: { type: "button" } });
    add.addEventListener("click", () => { void (async () => {
      if (!name || !code) return void this.plugin.notice("名称和编号不能为空");
      if (this.group === "type") {
        if (this.plugin.settings.typeOrder.some((value) => value === name || this.plugin.settings.typeLabels[value] === name) || Object.values(this.plugin.settings.typeCodes).some((value) => value.toLocaleLowerCase() === code.toLocaleLowerCase())) return void this.plugin.notice("类型名称或编号不能重复");
        this.plugin.settings.typeOrder.push(name); this.plugin.settings.typeLabels[name] = name; this.plugin.settings.typeCodes[name] = code; this.plugin.settings.typeEffects[name] = effect;
      } else if (this.group === "necessity") {
        if (this.plugin.settings.necessityOrder.some((value) => value === name || this.plugin.settings.necessityLabels[value] === name) || Object.values(this.plugin.settings.necessityCodes).some((value) => value.toLocaleLowerCase() === code.toLocaleLowerCase())) return void this.plugin.notice("必要性名称或编号不能重复");
        this.plugin.settings.necessityOrder.push(name); this.plugin.settings.necessityLabels[name] = name; this.plugin.settings.necessityCodes[name] = code;
      } else if (this.group === "account") {
        if (this.plugin.settings.accounts.some((value) => value.name === name || value.code.toLocaleLowerCase() === code.toLocaleLowerCase())) return void this.plugin.notice("账户名称或编号不能重复");
        this.plugin.settings.accounts.push({ name, code, initialBalance: 0 });
      } else {
        const names = this.categoryIncome ? this.plugin.settings.incomeCategories : this.plugin.settings.categories;
        const codes = this.categoryIncome ? this.plugin.settings.incomeCategoryCodes : this.plugin.settings.categoryCodes;
        if (names.includes(name) || Object.values(codes).some((value) => value.toLocaleLowerCase() === code.toLocaleLowerCase())) return void this.plugin.notice("分类名称或编号不能重复");
        names.push(name); codes[name] = code;
      }
      await this.plugin.saveSettingsQuietly(); this.render();
    })(); });
  }
}
