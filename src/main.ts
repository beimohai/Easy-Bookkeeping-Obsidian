import { App, ButtonComponent, Modal, Notice, Platform, Plugin, Setting, TFile, setIcon } from "obsidian";
import { DashboardView, DASHBOARD_VIEW_TYPE } from "./dashboard-view";
import { KeyboardEntryModal } from "./keyboard-entry-modal";
import { BookkeepingSettingTab } from "./settings-tab";
import { TransactionModal } from "./transaction-modal";
import { TransactionStore, type CsvCustomFieldConfiguration } from "./transaction-store";
import { DEFAULT_SETTINGS, customFieldKey, isCustomFieldKey, type AnnualChartConfig, type AnnualChartMetric, type BookkeepingSettings, type CalendarWeekStart, type ChartKind, type ChartMetric, type CustomFieldConfig, type DashboardChartConfig, type TableColumn, type Transaction, type TransactionType } from "./types";
import { currentMonth, errorMessageZh, formatMoney } from "./utils";
import logoUrl from "./assets/branding/logo.png";
import { I18nController, translate } from "./locales";
import { VaultFolderSuggest } from "./vault-folder-suggest";



function toSettingsLanguage(value: unknown): BookkeepingSettings["language"] | null {
  if (value === "zh-CN" || value === "zh-TW" || value === "en" || value === "fr" || value === "ru" || value === "es" || value === "ar" || value === "ja" || value === "ko" || value === "de" || value === "pt" || value === "fa") return value;
  return null;
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function isMonthString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

type StoredBookkeepingSettings = Partial<BookkeepingSettings> & {
  continuousEntry?: unknown;
};

export default class BookkeepingPlugin extends Plugin {
  settings!: BookkeepingSettings;
  store!: TransactionStore;
  private refreshTimer = 0;
  private i18n!: I18nController;
  private ribbonIconEl: HTMLElement | null = null;
  private ribbonCaptureTimer = 0;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.i18n = new I18nController(() => this.settings.language);
    this.i18n.start();
    this.store = new TransactionStore(this.app, () => this.settings);
    void this.store.cleanupPendingDeletes();
    void this.store.syncAttachmentPreviews();

    this.registerView(DASHBOARD_VIEW_TYPE, (leaf) => new DashboardView(leaf, this));
    this.ribbonIconEl = this.addRibbonIcon("wallet", this.t("打开记账仪表盘"), () => void this.openDashboard());
    this.app.workspace.onLayoutReady(() => this.restoreRibbonPosition());
    this.registerDomEvent(document, "pointerup", (event) => {
      const parent = this.ribbonIconEl?.parentElement;
      const target = event.target;
      if (!parent || !(target instanceof Node) || !parent.contains(target)) return;
      window.clearTimeout(this.ribbonCaptureTimer);
      this.ribbonCaptureTimer = window.setTimeout(() => this.captureRibbonPosition(), 0);
    });
    this.addCommand({ id: "open-dashboard", name: this.t("打开仪表盘"), callback: () => void this.openDashboard() });
    this.addCommand({ id: "add-transaction", name: this.t("开始记账"), callback: () => this.openEntry(false) });
    this.addCommand({ id: "keyboard-entry", name: this.t("桌面版全键盘连续记账"), callback: () => this.openKeyboardEntry() });
    this.addCommand({ id: "mobile-entry", name: this.t("手机端表单记账"), callback: () => this.openMobileEntry(false) });
    this.addCommand({ id: "convert-legacy-files", name: this.t("转换旧版账目为新版Properties"), callback: () => this.openLegacyConverter() });
    this.addCommand({ id: "import-csv", name: this.t("导入CSV文件"), callback: () => this.openCsvImporter() });
    this.addCommand({ id: "manage-tags", name: this.t("标签批量管理"), callback: () => this.openTagManager() });
    this.addCommand({ id: "period-statistics", name: this.t("查看年度统计"), callback: () => this.openPeriodStats(currentMonth()) });
    this.addCommand({
      id: "export-csv",
      name: this.t("导出CSV文件"),
      callback: () => this.openCsvExporter()
    });
    this.addSettingTab(new BookkeepingSettingTab(this.app, this));

    this.registerObsidianProtocolHandler("easy-bookkeeping", async (params) => {
      const type = params.type === "income" ? "收入" : params.type === "transfer" ? "转账" : "支出";
      const transaction: Transaction | null = null;
      this.openEntry(false, transaction, {
        type,
        title: params.title ?? params.note ?? "",
        expression: params.amount ?? "",
        category: params.category ?? "",
        account: params.account ?? ""
      });
    });

    const schedule = (): void => this.scheduleRefresh();
    this.registerEvent(this.app.vault.on("create", schedule));
    this.registerEvent(this.app.vault.on("modify", schedule));
    this.registerEvent(this.app.vault.on("delete", schedule));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      schedule();
      const ledgerRoot = `${this.settings.ledgerFolder}/`;
      if (!(file instanceof TFile && file.extension === "md" && (oldPath.startsWith(ledgerRoot) || file.path.startsWith(ledgerRoot)))) {
        void this.store.updateAttachmentPath(oldPath, file.path);
      }
    }));
  }

  onunload(): void {
    window.clearTimeout(this.refreshTimer);
    window.clearTimeout(this.ribbonCaptureTimer);
    this.captureRibbonPosition();
    this.i18n.stop();
  }

  t(source: string): string {
    return translate(source, this.settings.language);
  }

  notice(source: string, duration?: number): Notice {
    const notice = new Notice(this.t(source), duration);
    notice.messageEl.addClass("bookkeeping-notice");
    return notice;
  }

  applyLanguage(root?: HTMLElement): void {
    this.i18n.refresh(root);
    const label = this.t("打开记账仪表盘");
    this.ribbonIconEl?.setAttribute("aria-label", label);
    this.ribbonIconEl?.setAttribute("title", label);
  }

  private restoreRibbonPosition(): void {
    if (Platform.isMobile) return;
    const icon = this.ribbonIconEl;
    const parent = icon?.parentElement;
    const position = this.settings.ribbonPosition;
    if (!icon || !parent || !Number.isInteger(position) || position < 0) return;
    const siblings = Array.from(parent.children).filter((element): element is HTMLElement => element.instanceOf(HTMLElement) && element !== icon);
    const reference = siblings[Math.min(position, siblings.length)];
    if (reference) parent.insertBefore(icon, reference);
    else parent.appendChild(icon);
  }

  private captureRibbonPosition(): void {
    if (Platform.isMobile) return;
    const icon = this.ribbonIconEl;
    const parent = icon?.parentElement;
    if (!icon || !parent) return;
    const position = Array.from(parent.children).indexOf(icon);
    if (position < 0 || position === this.settings.ribbonPosition) return;
    this.settings.ribbonPosition = position;
    void this.saveSettingsQuietly();
  }

  openEntry(
    forceContinuous = false,
    transaction: Transaction | null = null,
    preset?: { type?: TransactionType; title?: string; expression?: string; category?: string; account?: string },
    targetMonth = currentMonth()
  ): void {
    const keyboardMode = this.settings.entryMode === "desktop" || (this.settings.entryMode === "auto" && !Platform.isMobile);
    if (!transaction && !preset && keyboardMode) {
      this.openKeyboardEntry(targetMonth);
      return;
    }
    this.openMobileEntry(forceContinuous, transaction, preset, targetMonth);
  }

  openKeyboardEntry(targetMonth = currentMonth()): void {
    new KeyboardEntryModal(this.app, this.store, this.settings, targetMonth, async () => {
      await this.refreshDashboards();
    }).open();
  }

  openMobileEntry(
    forceContinuous = false,
    transaction: Transaction | null = null,
    preset?: { type?: TransactionType; title?: string; expression?: string; category?: string; account?: string },
    targetMonth = currentMonth()
  ): void {
    const settings = preset ? {
      ...this.settings,
      defaultType: preset.type ?? this.settings.defaultType,
      defaultCategory: preset.category || this.settings.defaultCategory,
      defaultAccount: preset.account || this.settings.defaultAccount
    } : this.settings;
    const modal = new TransactionModal(this.app, this.store, settings, transaction, forceContinuous, targetMonth, async () => {
      await this.refreshDashboards();
      if (!transaction && this.settings.openDashboardAfterEntry && !forceContinuous && !this.settings.mobileContinuousEntry) await this.openDashboard();
    });
    modal.open();
    if (preset) {
      window.setTimeout(() => {
        const inputs = modal.contentEl.querySelectorAll("input");
        const titleInput = Array.from(inputs).find((input) => input.getAttribute("placeholder") === "请输入内容");
        const amountInput = Array.from(inputs).find((input) => input.getAttribute("placeholder") === "0.00");
        if (titleInput && preset.title) {
          titleInput.value = preset.title;
          titleInput.dispatchEvent(new Event("input"));
        }
        if (amountInput && preset.expression) {
          amountInput.value = preset.expression;
          amountInput.dispatchEvent(new Event("input"));
        }
      }, 0);
    }
  }

  async openDashboard(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE)[0];
    if (existing) {
      void this.app.workspace.revealLeaf(existing);
      await (existing.view as DashboardView).refresh();
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: true });
    void this.app.workspace.revealLeaf(leaf);
  }

  async refreshDashboards(): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE)) {
      await (leaf.view as DashboardView).refresh();
    }
  }

  async restartPlugin(): Promise<void> {
    const plugins = (this.app as App & { plugins?: { disablePlugin?: (id: string) => Promise<void>; enablePlugin?: (id: string) => Promise<void> } }).plugins;
    if (!plugins?.disablePlugin || !plugins.enablePlugin) {
      await this.refreshDashboards();
      this.notice("仪表盘已刷新");
      return;
    }
    const id = this.manifest.id;
    await plugins.disablePlugin(id);
    await plugins.enablePlugin(id);
  }

  openLegacyConverter(): void {
    new LegacyConverterModal(this.app, this).open();
  }

  openCsvImporter(): void {
    const input = createEl("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      void file.text().then((text) => new CsvImportModal(this.app, this, file.name, text).open());
    }, { once: true });
    input.click();
  }

  openCsvExporter(month = currentMonth(), filteredIds?: string[]): void {
    new CsvExportModal(this.app, this, month, filteredIds).open();
  }

  openPluginSettings(): void {
    const setting = (this.app as App & { setting?: { open: () => void; openTabById: (id: string) => void } }).setting;
    setting?.open();
    setting?.openTabById(this.manifest.id);
  }

  openExpressionStorageMigration(): void {
    new ExpressionStorageMigrationModal(this.app, this).open();
  }

  openTagManager(focusTag = ""): void {
    new TagManagerModal(this.app, this, focusTag).open();
  }

  openPeriodStats(month: string): void {
    new PeriodStatsModal(this.app, this, month).open();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    await this.refreshDashboards();
  }

  async saveSettingsQuietly(): Promise<void> {
    await this.saveData(this.settings);
  }

  async applyCsvCustomFieldConfiguration(configuration: CsvCustomFieldConfiguration): Promise<void> {
    const oldKeys = this.settings.customFields.map((field) => customFieldKey(field.id));
    const newFields = configuration.fields.map((field) => ({
      ...field,
      options: [...field.options],
      optionCodes: { ...field.optionCodes },
      initialOptions: [...field.initialOptions],
      initialOptionCodes: { ...field.initialOptionCodes }
    }));
    const newKeys = newFields.map((field) => customFieldKey(field.id));
    this.settings.enableAccount = configuration.builtInEnabled.account;
    this.settings.enableType = configuration.builtInEnabled.type;
    this.settings.enableNecessity = configuration.builtInEnabled.necessity;
    this.settings.enableCategory = configuration.builtInEnabled.category;
    this.settings.enableNote = configuration.builtInEnabled.note;
    this.settings.enableEntryAttachments = configuration.builtInEnabled.attachments;
    this.settings.customFields = newFields;
    this.settings.optionFieldOrder = [...configuration.optionFieldOrder];
    const nextColumns: TableColumn[] = this.settings.tableColumnOrder.filter((column) => !isCustomFieldKey(column));
    const actionIndex = nextColumns.indexOf("actions");
    nextColumns.splice(actionIndex >= 0 ? actionIndex : nextColumns.length, 0, ...newKeys);
    this.settings.tableColumnOrder = nextColumns;
    this.settings.visibleTableColumns = [...new Set([...this.settings.visibleTableColumns.filter((column) => !isCustomFieldKey(column)), ...newKeys])];
    this.settings.editableColumns = [...new Set([...this.settings.editableColumns.filter((column) => !isCustomFieldKey(column)), ...newKeys])];
    for (const key of oldKeys) {
      delete this.settings.tableColumnLabels[key];
      delete this.settings.tableColumnWidths[key];
    }
    for (const field of newFields) this.settings.tableColumnLabels[customFieldKey(field.id)] = field.name;
    this.settings.savedDashboardFilters.customFields = {};
    for (const filters of Object.values(this.settings.savedMonthlyDashboardFilters)) filters.customFields = {};
    await this.saveSettingsQuietly();
  }



  pluginLogoUrl(): string {
    return logoUrl;
  }

  applySemanticColors(element: HTMLElement): void {
    element.setCssProps({ "--bk-income": this.settings.incomeColor, "--bk-expense": this.settings.expenseColor });
  }

  semanticColor(kind: "income" | "expense"): string {
    return kind === "income" ? this.settings.incomeColor : this.settings.expenseColor;
  }


  private async loadSettings(): Promise<void> {
    const loaded = await this.loadData() as StoredBookkeepingSettings | null;
    const customFields = this.normalizeCustomFields(loaded?.customFields);
    const customKeys = customFields.map((field) => customFieldKey(field.id));
    const tableColumnOrder = this.completeOrder(loaded?.tableColumnOrder, DEFAULT_SETTINGS.tableColumnOrder, customKeys);
    const validTableColumns = new Set<TableColumn>(tableColumnOrder);
    const visibleTableColumns = (loaded?.visibleTableColumns ?? DEFAULT_SETTINGS.visibleTableColumns)
      .filter((column): column is TableColumn => validTableColumns.has(column as TableColumn));
    const editableColumns = (loaded?.editableColumns ?? DEFAULT_SETTINGS.editableColumns)
      .filter((column): column is TableColumn => validTableColumns.has(column as TableColumn));
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(loaded ?? {}),
      categories: loaded?.categories?.length ? loaded.categories : [...DEFAULT_SETTINGS.categories],
      incomeCategories: loaded?.incomeCategories?.length ? loaded.incomeCategories : [...DEFAULT_SETTINGS.incomeCategories],
      accounts: (loaded?.accounts?.length ? loaded.accounts : DEFAULT_SETTINGS.accounts).map((account, index) => ({
        ...account,
        code: String(account.code ?? "").trim() || String(index + 1)
      })),
      monthlyBudgets: loaded?.monthlyBudgets ?? {},
      monthlyOpeningBalances: loaded?.monthlyOpeningBalances ?? {},
      desktopContinuousEntry: loaded?.desktopContinuousEntry ?? true,
      mobileContinuousEntry: loaded?.mobileContinuousEntry ?? Boolean(loaded?.continuousEntry),
      customFields,
      optionFieldOrder: this.completeOrder(loaded?.optionFieldOrder, DEFAULT_SETTINGS.optionFieldOrder, customKeys),
      tableColumnOrder,
      tableColumnWidths: { ...(loaded?.tableColumnWidths ?? {}) },
      visibleTableColumns,
      editableColumns,
      attachmentFolder: loaded?.attachmentFolder || DEFAULT_SETTINGS.attachmentFolder,
      tableColumnLabels: {
        ...DEFAULT_SETTINGS.tableColumnLabels,
        ...Object.fromEntries(customFields.map((field) => [customFieldKey(field.id), field.name])),
        ...(loaded?.tableColumnLabels ?? {}),
        tags: loaded?.tableColumnLabels?.tags === "Tag" ? "标签" : (loaded?.tableColumnLabels?.tags ?? DEFAULT_SETTINGS.tableColumnLabels.tags ?? "标签")
      },
      chartConfigs: this.migrateChartConfigs(loaded?.chartConfigs, loaded?.showBudgetPanel, loaded?.showAccountPanel),
      annualChartConfigs: loaded?.annualChartConfigs?.length
        ? loaded.annualChartConfigs.map((chart) => ({ ...chart }))
        : DEFAULT_SETTINGS.annualChartConfigs.map((chart) => ({ ...chart })),
      keyboardShortcuts: { ...DEFAULT_SETTINGS.keyboardShortcuts, ...(loaded?.keyboardShortcuts ?? {}) },
      collapsedHeaderActions: loaded?.collapsedHeaderActions ?? [...DEFAULT_SETTINGS.collapsedHeaderActions],
      headerActionOrder: this.completeOrder(loaded?.headerActionOrder, DEFAULT_SETTINGS.headerActionOrder),
      calendarWeekStart: (["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as CalendarWeekStart[]).includes(loaded?.calendarWeekStart as CalendarWeekStart)
        ? loaded?.calendarWeekStart as CalendarWeekStart
        : "sunday",
      language: toSettingsLanguage(loaded?.language) ?? "zh-CN",
      incomeColor: isHexColor(loaded?.incomeColor) ? loaded.incomeColor : DEFAULT_SETTINGS.incomeColor,
      expenseColor: isHexColor(loaded?.expenseColor) ? loaded.expenseColor : DEFAULT_SETTINGS.expenseColor,
      yearMonthDisplayFormat: loaded?.yearMonthDisplayFormat ?? DEFAULT_SETTINGS.yearMonthDisplayFormat,
      filterPersistence: loaded?.filterPersistence === "current" || loaded?.filterPersistence === "monthly" || loaded?.filterPersistence === "none"
        ? loaded.filterPersistence
        : loaded?.saveFiltersOnExit === false ? "none" : "current",
      saveFiltersOnExit: loaded?.filterPersistence
        ? loaded.filterPersistence !== "none"
        : loaded?.saveFiltersOnExit ?? true,
      lastDashboardMonth: isMonthString(loaded?.lastDashboardMonth) ? loaded.lastDashboardMonth : "",
      savedDashboardAdvancedFilters: Boolean(loaded?.savedDashboardAdvancedFilters),
      savedMonthlyDashboardAdvancedFilters: { ...(loaded?.savedMonthlyDashboardAdvancedFilters ?? {}) },
      disabledLanguages: [...new Set((loaded?.disabledLanguages ?? []).filter((language): language is BookkeepingSettings["language"] => toSettingsLanguage(language) !== null && language !== "zh-CN"))],
      customTags: [...new Set((loaded?.customTags ?? []).map((tag) => String(tag).replace(/^#/, "").trim()).filter(Boolean))],
      ribbonPosition: Number.isInteger(loaded?.ribbonPosition) && Number(loaded?.ribbonPosition) >= 0 ? Number(loaded?.ribbonPosition) : -1,
      typeLabels: { ...DEFAULT_SETTINGS.typeLabels, ...(loaded?.typeLabels ?? {}) },
      necessityLabels: { ...DEFAULT_SETTINGS.necessityLabels, ...(loaded?.necessityLabels ?? {}) },
      defaultIncomeCategory: loaded?.defaultIncomeCategory || loaded?.incomeCategories?.[0] || DEFAULT_SETTINGS.defaultIncomeCategory,
      typeOrder: [...new Set((loaded?.typeOrder?.length ? loaded.typeOrder : DEFAULT_SETTINGS.typeOrder).filter(Boolean))],
      necessityOrder: [...new Set((loaded?.necessityOrder?.length ? loaded.necessityOrder : DEFAULT_SETTINGS.necessityOrder).filter(Boolean))],
      typeEffects: { ...DEFAULT_SETTINGS.typeEffects, ...(loaded?.typeEffects ?? {}) },
      savedDashboardFilters: {
        ...DEFAULT_SETTINGS.savedDashboardFilters,
        ...(loaded?.savedDashboardFilters ?? {}),
        types: [...(loaded?.savedDashboardFilters?.types ?? [])],
        necessities: [...(loaded?.savedDashboardFilters?.necessities ?? [])],
        categories: [...(loaded?.savedDashboardFilters?.categories ?? [])],
        accounts: [...(loaded?.savedDashboardFilters?.accounts ?? [])],
        customFields: Object.fromEntries(Object.entries(loaded?.savedDashboardFilters?.customFields ?? {}).map(([id, values]) => [id, Array.isArray(values) ? values.map(String) : []]))
      },
      savedMonthlyDashboardFilters: Object.fromEntries(Object.entries(loaded?.savedMonthlyDashboardFilters ?? {}).map(([month, filters]) => [month, {
        ...DEFAULT_SETTINGS.savedDashboardFilters,
        ...filters,
        types: [...(filters.types ?? [])],
        necessities: [...(filters.necessities ?? [])],
        categories: [...(filters.categories ?? [])],
        accounts: [...(filters.accounts ?? [])],
        customFields: Object.fromEntries(Object.entries(filters.customFields ?? {}).map(([id, values]) => [id, Array.isArray(values) ? values.map(String) : []]))
      }]))
    };
    this.settings.typeCodes = this.completeCodes(this.settings.typeOrder, loaded?.typeCodes, DEFAULT_SETTINGS.typeCodes);
    this.settings.necessityCodes = this.completeCodes(this.settings.necessityOrder, loaded?.necessityCodes, DEFAULT_SETTINGS.necessityCodes);
    this.settings.categoryCodes = this.completeCodes(this.settings.categories, loaded?.categoryCodes, DEFAULT_SETTINGS.categoryCodes);
    this.settings.incomeCategoryCodes = this.completeCodes(this.settings.incomeCategories, loaded?.incomeCategoryCodes, DEFAULT_SETTINGS.incomeCategoryCodes);
    const usedAccountCodes = new Set<string>();
    this.settings.accounts = this.settings.accounts.map((account, index) => {
      let code = String(account.code ?? "").trim();
      if (!code || usedAccountCodes.has(code.toLocaleLowerCase())) {
        let fallback = String(index + 1);
        while (usedAccountCodes.has(fallback.toLocaleLowerCase())) fallback = String(Number(fallback) + 1);
        code = fallback;
      }
      usedAccountCodes.add(code.toLocaleLowerCase());
      return { ...account, code };
    });
    const settingsRecord = this.settings as unknown as Record<string, unknown>;
    delete settingsRecord["desktopMonthMode"];
    delete settingsRecord["desktopFixedMonth"];
    delete settingsRecord["continuousEntry"];
    delete settingsRecord["textOverrides"];
    delete settingsRecord["sponsorQrPath"];
    delete settingsRecord["qqGroupQrPath"];
    delete (this.settings.keyboardShortcuts as unknown as Record<string, unknown>)["backKeyword"];
    if (this.settings.disabledLanguages.includes(this.settings.language)) this.settings.language = "zh-CN";
    if (!this.settings.enableAccount && this.settings.defaultType === "转账") this.settings.defaultType = "支出";
    await this.saveData(this.settings);
  }

  private completeCodes(names: string[], loaded: Record<string, string> | undefined, defaults: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    const used = new Set<string>();
    names.forEach((name, index) => {
      let code = String(loaded?.[name] ?? "").trim() || String(defaults[name] ?? "").trim() || String(index + 1);
      if (used.has(code.toLocaleLowerCase())) {
        code = String(index + 1);
        while (used.has(code.toLocaleLowerCase())) code = String(Number(code) + 1);
      }
      used.add(code.toLocaleLowerCase());
      result[name] = code;
    });
    return result;
  }

  private migrateChartConfigs(loaded: unknown[] | undefined, oldBudget?: boolean, oldAccount?: boolean): DashboardChartConfig[] {
    if (!loaded?.length) return DEFAULT_SETTINGS.chartConfigs.map((chart) => ({ ...chart }));
    const validKinds: ChartKind[] = ["trend", "pie", "tag", "calendar", "budget", "account"];
    const defaults: Record<ChartKind, ChartMetric> = { trend: "expense", pie: "expenseCategory", tag: "expense", calendar: "net", budget: "budget", account: "account" };
    const migrated: DashboardChartConfig[] = [];
    for (const value of loaded) {
      if (!value || typeof value !== "object") continue;
      const raw = value as Record<string, unknown>;
      const kind = validKinds.includes(raw["kind"] as ChartKind) ? raw["kind"] as ChartKind : "trend";
      const oldMetric = raw["metric"] ?? raw[`${kind}Metric`] ?? defaults[kind];
      if (raw["id"] === "flow-pie" || oldMetric === "incomeExpense") continue;
      migrated.push({
        id: String(raw["id"] ?? `chart-${Date.now()}-${migrated.length}`),
        title: String(raw["title"] === "Tag汇总" ? "标签汇总" : (raw["title"] ?? "自定义图表")),
        kind,
        visible: raw["visible"] !== false,
        width: raw["width"] === "full" ? "full" : "half",
        metric: oldMetric as ChartMetric,
        ...(kind === "trend" ? { chartType: raw["chartType"] === "bar" || raw["chartType"] === "area" ? raw["chartType"] : "line" } : {}),
        ...(kind === "tag" ? { tagSort: ["amountAsc", "nameAsc", "nameDesc"].includes(String(raw["tagSort"])) ? raw["tagSort"] as DashboardChartConfig["tagSort"] : "amountDesc" } : {})
      });
    }
    if (oldBudget !== false && !migrated.some((chart) => chart.kind === "budget")) migrated.push({ id: "budget", title: "预算进度", kind: "budget", visible: true, width: "half", metric: "budget" });
    if (oldAccount !== false && !migrated.some((chart) => chart.kind === "account")) migrated.push({ id: "account", title: "账户余额", kind: "account", visible: true, width: "half", metric: "account" });
    return migrated.length ? migrated : DEFAULT_SETTINGS.chartConfigs.map((chart) => ({ ...chart }));
  }

  private normalizeCustomFields(value: unknown): CustomFieldConfig[] {
    if (!Array.isArray(value)) return [];
    const fields: CustomFieldConfig[] = [];
    const ids = new Set<string>();
    const properties = new Set<string>();
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const raw = item as Record<string, unknown>;
      const id = String(raw["id"] ?? "").trim();
      const name = String(raw["name"] ?? "").trim();
      const property = String(raw["property"] ?? name).trim();
      if (!id || !name || !property || ids.has(id) || properties.has(property.toLocaleLowerCase())) continue;
      ids.add(id);
      properties.add(property.toLocaleLowerCase());
      const kind = raw["kind"] === "select" ? "select" : "text";
      const options = kind === "select"
        ? [...new Set((Array.isArray(raw["options"]) ? raw["options"] : []).map(String).map((option) => option.trim()).filter(Boolean))]
        : [];
      const rawCodes = raw["optionCodes"] && typeof raw["optionCodes"] === "object" ? raw["optionCodes"] as Record<string, unknown> : {};
      const optionCodes: Record<string, string> = {};
      const usedCodes = new Set<string>();
      options.forEach((option, index) => {
        let code = String(rawCodes[option] ?? "").trim() || String(index + 1);
        while (usedCodes.has(code.toLocaleLowerCase())) code = String(Number.isFinite(Number(code)) ? Number(code) + 1 : index + 1);
        usedCodes.add(code.toLocaleLowerCase());
        optionCodes[option] = code;
      });
      const defaultValue = options.includes(String(raw["defaultValue"] ?? "")) ? String(raw["defaultValue"]) : (options[0] ?? "");
      const loadedInitialOptions = Array.isArray(raw["initialOptions"])
        ? [...new Set(raw["initialOptions"].map(String).map((option) => option.trim()).filter(Boolean))]
        : [];
      const initialOptions = kind === "select" && loadedInitialOptions.length ? loadedInitialOptions : [...options];
      const rawInitialCodes = raw["initialOptionCodes"] && typeof raw["initialOptionCodes"] === "object" ? raw["initialOptionCodes"] as Record<string, unknown> : {};
      const initialOptionCodes = Object.fromEntries(initialOptions.map((option, index) => [option, String(rawInitialCodes[option] ?? optionCodes[option] ?? index + 1).trim() || String(index + 1)]));
      const initialDefaultValue = initialOptions.includes(String(raw["initialDefaultValue"] ?? "")) ? String(raw["initialDefaultValue"]) : (initialOptions[0] ?? "");
      fields.push({
        id,
        name,
        property,
        kind,
        options,
        optionCodes,
        defaultValue,
        initialOptions,
        initialOptionCodes,
        initialDefaultValue,
        enabled: raw["enabled"] !== false
      });
    }
    return fields;
  }

  private completeOrder<T extends string>(loaded: unknown, defaults: T[], extras: T[] = []): T[] {
    const allowed = new Set<T>([...defaults, ...extras]);
    const valid = Array.isArray(loaded)
      ? loaded.filter((item): item is T => allowed.has(item as T))
      : [];
    return [...new Set([...valid, ...defaults, ...extras])];
  }

  private scheduleRefresh(): void {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => void this.refreshDashboards(), 300);
  }

}

class LegacyConverterModal extends Modal {
  private source: "vault" | "external" = "vault";
  private vaultFolder: string;
  private externalFolder = "";
  constructor(app: App, private readonly plugin: BookkeepingPlugin) { super(app); this.vaultFolder = plugin.settings.ledgerFolder; }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    this.setTitle("转换旧版账目");
    const sourceSetting = new Setting(this.contentEl).setName("来源").addDropdown((dropdown) => dropdown
      .addOptions(Platform.isDesktopApp ? { vault: "当前Obsidian仓库", external: "电脑外部文件夹" } : { vault: "当前Obsidian仓库" }).setValue(this.source)
      .onChange((value) => { this.source = value === "external" ? "external" : "vault"; refresh(); }));
    const vaultSetting = new Setting(this.contentEl).setName("旧版账目位置").addText((text) => {
      text.setValue(this.vaultFolder).onChange((value) => this.vaultFolder = value.trim());
      new VaultFolderSuggest(this.app, text.inputEl);
    });
    const externalSetting = new Setting(this.contentEl).setName("旧版账目位置").addButton((button) => button.setButtonText("选择文件夹").setIcon("folder-open").onClick(() => { void (async () => {
      const path = await this.chooseExternalFolder();
      if (!path) return;
      this.externalFolder = path;
      externalSetting.setDesc(path);
    })(); }));
    const refresh = (): void => {
      vaultSetting.settingEl.toggleClass("bookkeeping-hidden", this.source !== "vault");
      externalSetting.settingEl.toggleClass("bookkeeping-hidden", this.source !== "external");
      sourceSetting.setDesc("");
    };
    refresh();
    this.contentEl.createEl("p", { text: "转换前建议备份！", cls: "mod-warning" });
    const error = this.contentEl.createDiv({ cls: "bookkeeping-form-error" });
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText("开始转换").setCta().onClick(() => { void (async () => {
      try {
        error.empty();
        if (this.source === "vault" && !this.vaultFolder) throw new Error("请选择仓库内旧账目录");
        if (this.source === "external" && !this.externalFolder) throw new Error("请先选择外部旧账文件夹");
        await this.run();
      } catch (convertError) { error.setText(errorMessageZh(convertError, "旧版账目转换失败")); }
    })(); });
  }

  private async run(): Promise<void> {
      this.contentEl.empty();
      this.setTitle("正在转换旧版账目");
      const status = this.contentEl.createEl("p", { text: "准备扫描…（0%）" });
      const progress = this.contentEl.createDiv({ cls: "bookkeeping-operation-progress" });
      const fill = progress.createDiv({ cls: "bookkeeping-operation-progress-fill" });
      try {
      let message = "";
      if (this.source === "vault") {
        const result = await this.plugin.store.convertLegacyFiles((done, total) => {
        status.setText(`${done}/${total}（${total ? Math.round(done / total * 100) : 100}%）`);
        fill.setCssStyles({ width: `${total ? done / total * 100 : 100}%` });
        }, this.vaultFolder);
        if (!result.total) throw new Error("所选目录没有检测到旧版账目");
        message = `已转换${result.converted}个仓库内旧版账目，跳过${result.skipped}个，失败${result.failed}个`;
        if (result.failureFolder) message += `；失败文件已复制到${result.failureFolder}`;
      } else {
        const files = await this.readExternalMarkdown(this.externalFolder);
        if (!files.length) throw new Error("所选外部文件夹中没有Markdown文件");
        const result = await this.plugin.store.importExternalLegacyMarkdown(files, (done, total) => {
          status.setText(`${done}/${total}（${total ? Math.round(done / total * 100) : 100}%）`);
          fill.setCssStyles({ width: `${total ? done / total * 100 : 100}%` });
        });
        message = `已从外部导入${result.imported}笔，跳过${result.skipped}个，失败${result.failed}个文件`;
        if (result.failureFolder) message += `；失败文件已复制到${result.failureFolder}`;
      }
      await this.plugin.refreshDashboards();
      status.setText(message);
      new ButtonComponent(this.contentEl).setButtonText("完成").setCta().onClick(() => this.close());
      } catch (convertError) {
        status.setText(errorMessageZh(convertError, "旧版账目转换失败"));
        status.addClass("mod-warning");
        fill.setCssStyles({ width: "0%" });
        new ButtonComponent(this.contentEl).setButtonText("关闭").onClick(() => this.close());
      }
  }

  private async chooseExternalFolder(): Promise<string> {
    type Dialog = { showOpenDialog(options: { title: string; properties: string[] }): Promise<{ canceled: boolean; filePaths: string[] }> };
    const requireFn = (typeof require === "function" ? require : (window as unknown as { require?: (id: string) => unknown }).require) as ((id: string) => unknown) | undefined;
    if (!requireFn) throw new Error("当前环境无法打开系统文件夹选择窗口");
    const electron = requireFn("electron") as { remote?: { dialog?: Dialog } };
    let dialog = electron.remote?.dialog;
    if (!dialog) try { dialog = (requireFn("@electron/remote") as { dialog?: Dialog }).dialog; } catch { dialog = undefined; }
    if (!dialog) throw new Error("当前Obsidian版本不支持系统文件夹选择窗口");
    const result = await dialog.showOpenDialog({ title: this.plugin.t("选择外部旧版账目文件夹"), properties: ["openDirectory"] });
    return result.canceled ? "" : (result.filePaths[0] ?? "");
  }

  private async readExternalMarkdown(root: string): Promise<Array<{ name: string; path: string; content: string }>> {
    const requireFn = (typeof require === "function" ? require : (window as unknown as { require?: (id: string) => unknown }).require) as ((id: string) => unknown) | undefined;
    if (!requireFn) throw new Error("当前环境无法读取外部文件夹");
    const fs = requireFn("fs") as { promises: { readdir(path: string, options: { withFileTypes: true }): Promise<Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>>; readFile(path: string, encoding: string): Promise<string> } };
    const pathApi = requireFn("path") as { join(...parts: string[]): string; relative(from: string, to: string): string };
    const output: Array<{ name: string; path: string; content: string }> = [];
    const walk = async (folder: string): Promise<void> => {
      for (const entry of await fs.promises.readdir(folder, { withFileTypes: true })) {
        const path = pathApi.join(folder, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if (entry.isFile() && /\.md$/i.test(entry.name)) output.push({
          name: entry.name,
          path: pathApi.relative(root, path).replace(/\\/g, "/"),
          content: await fs.promises.readFile(path, "utf8")
        });
      }
    };
    await walk(root);
    return output;
  }
}

class ExpressionStorageMigrationModal extends Modal {
  constructor(app: App, private readonly plugin: BookkeepingPlugin) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    this.setTitle("同步现有账目的算式格式？");
    this.contentEl.createEl("p", { text: this.plugin.settings.saveExpressionInNote
      ? "设置已经启用。是否把现有账目的算式同步写入备注？"
      : "设置已经关闭。是否从现有账目的备注中移除自动写入的算式行，并移除专门的算式属性？" });
    this.contentEl.createEl("p", { text: "选择“以后再说”只影响新建或再次编辑的账目。", cls: "setting-item-description" });
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("以后再说").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText("转换现有文件").setCta().onClick(() => void this.run());
  }

  private async run(): Promise<void> {
    this.contentEl.empty();
    const status = this.contentEl.createEl("p", { text: "准备转换…（0%）" });
    const progress = this.contentEl.createDiv({ cls: "bookkeeping-operation-progress" });
    const fill = progress.createDiv({ cls: "bookkeeping-operation-progress-fill" });
    const count = await this.plugin.store.rewriteExpressionStorage((done, total) => {
      status.setText(`正在处理 ${done}/${total}（${total ? Math.round(done / total * 100) : 100}%）`);
      fill.setCssStyles({ width: `${total ? done / total * 100 : 100}%` });
    });
    await this.plugin.refreshDashboards();
    status.setText(`已同步${count}个账目文件`);
    new ButtonComponent(this.contentEl).setButtonText("完成").setCta().onClick(() => this.close());
  }
}

class CsvImportModal extends Modal {
  private normalizeMetadata = false;
  private useAttachedFieldConfig = false;
  private readonly attachedFieldConfig: CsvCustomFieldConfiguration | null;
  constructor(app: App, private readonly plugin: BookkeepingPlugin, private readonly fileName: string, private readonly text: string) {
    super(app);
    this.attachedFieldConfig = plugin.store.inspectCsvCustomFieldConfiguration(text);
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    this.setTitle("导入CSV账目");
    const estimatedRows = Math.max(this.text.split(/\r?\n/).filter((line) => line.trim()).length - (this.attachedFieldConfig ? 2 : 1), 0);
    this.contentEl.createEl("p", { text: `文件：${this.fileName}` });
    this.contentEl.createEl("p", { text: `检测到约${estimatedRows}行数据。会自动识别常见中英文列名，并跳过疑似重复账目。` });
    this.contentEl.createEl("p", { text: "必须包含日期和金额。无法导入的行会生成带原因的失败报告。", cls: "setting-item-description" });
    if (this.attachedFieldConfig) {
      new Setting(this.contentEl)
        .setName("启用CSV附带的录入字段配置")
        .setDesc(`检测到完整录入字段配置及${this.attachedFieldConfig.fields.length}个自定义字段。关闭时只匹配当前配置，多余CSV字段不会写入；启用时会替换字段开关、顺序和自定义字段，并清除所有原有账目中的旧自定义属性。`)
        .addToggle((toggle) => toggle.setValue(this.useAttachedFieldConfig).onChange((value) => this.useAttachedFieldConfig = value));
    }
    const analysis = this.plugin.store.inspectCsvMetadata(this.text);
    if (analysis.hasDifferences) {
      this.normalizeMetadata = true;
      const warning = this.contentEl.createDiv({ cls: "bookkeeping-import-warning" });
      warning.createEl("strong", { text: "CSV元数据与当前仓库预设不一致" });
      warning.createEl("p", { text: analysis.differences.join("；") });
      warning.createEl("p", { text: "继续后会把未知类型、必要性、分类和账户转换为当前仪表盘的对应默认值。是否继续导入？" });
    }
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText(analysis.hasDifferences ? "转换并继续导入" : "开始导入").setCta().onClick(() => {
      if (this.useAttachedFieldConfig && this.attachedFieldConfig) {
        new ConfirmCsvFieldConfigurationModal(this.app, this.attachedFieldConfig.fields.length, () => void this.run()).open();
      } else void this.run();
    });
  }

  private async run(): Promise<void> {
    this.contentEl.empty();
    const status = this.contentEl.createEl("p", { text: "正在读取CSV…（0%）" });
    const progress = this.contentEl.createDiv({ cls: "bookkeeping-operation-progress" });
    const fill = progress.createDiv({ cls: "bookkeeping-operation-progress-fill" });
    try {
      this.plugin.store.validateCsvImportStructure(this.text);
      if (this.useAttachedFieldConfig && this.attachedFieldConfig) {
        const properties = [...new Set([
          ...this.plugin.settings.customFields.map((field) => field.property),
          ...this.attachedFieldConfig.fields.map((field) => field.property)
        ])];
        status.setText("正在清除原有账目的自定义录入字段…");
        const cleared = await this.plugin.store.clearCustomFieldProperties(properties, (done, total) => {
          status.setText(`正在清理原有账目 ${done}/${total}（${total ? Math.round(done / total * 100) : 100}%）`);
          fill.setCssStyles({ width: `${total ? done / total * 100 : 100}%` });
        });
        await this.plugin.applyCsvCustomFieldConfiguration(this.attachedFieldConfig);
        status.setText(`已清理${cleared}笔原有账目，正在导入CSV…（0%）`);
        fill.setCssStyles({ width: "0%" });
      }
      const result = await this.plugin.store.importCsv(this.text, (done, total) => {
        status.setText(`正在导入 ${done}/${total}（${total ? Math.round(done / total * 100) : 100}%）`);
        fill.setCssStyles({ width: `${total ? done / total * 100 : 100}%` });
      }, this.normalizeMetadata);
      await this.plugin.refreshDashboards();
      status.setText(`导入完成：成功${result.imported}笔，重复跳过${result.skipped}笔，失败${result.failures.length}笔。`);
      if (result.failureReport) this.contentEl.createEl("p", { text: `失败报告：${result.failureReport.path}`, cls: "setting-item-description" });
    } catch (error) {
      status.setText(errorMessageZh(error, "CSV导入失败，请检查文件格式"));
      status.addClass("mod-warning");
    }
    new ButtonComponent(this.contentEl).setButtonText("完成").setCta().onClick(() => this.close());
  }
}

class ConfirmCsvFieldConfigurationModal extends Modal {
  constructor(app: App, private readonly fieldCount: number, private readonly onConfirm: () => void) { super(app); }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    this.setTitle("启用CSV录入字段配置");
    this.contentEl.createEl("p", { text: `CSV附带完整录入字段配置及${this.fieldCount}个自定义字段。启用后将替换当前字段开关、顺序和自定义字段配置。` });
    this.contentEl.createEl("p", { text: "所有原有账目中的旧自定义属性会被永久删除；CSV中多余且不属于附带配置的字段也不会写入。", cls: "setting-item-description mod-warning" });
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    const importWithCleanup = new ButtonComponent(actions).setButtonText("清理旧字段并导入").setDestructive();
    importWithCleanup.buttonEl.addClass("bookkeeping-danger-button");
    importWithCleanup.onClick(() => {
      this.close();
      this.onConfirm();
    });
  }
}

class CsvExportModal extends Modal {
  private exportScope: "all" | "month" | "filtered" | "custom" = "month";
  private destination: "vault" | "computer" = "vault";
  private folder: string;
  private fileName: string;
  private dateFrom = "";
  private dateTo = "";
  private includeFieldConfig = false;

  constructor(
    app: App,
    private readonly plugin: BookkeepingPlugin,
    private readonly month: string,
    private readonly filteredIds?: string[]
  ) {
    super(app);
    this.folder = plugin.settings.exportFolder;
    this.fileName = `账目导出-${month}`;
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    this.setTitle("导出CSV文件");
    const scopeSetting = new Setting(this.contentEl).setName("导出范围");
    scopeSetting.addDropdown((dropdown) => {
      const options: Record<string, string> = { all: "全部账目", month: `${this.month}整月`, custom: "自定义日期范围" };
      if (this.filteredIds) options.filtered = `当前仪表盘筛选结果（${this.filteredIds.length}笔）`;
      dropdown.addOptions(options).setValue(this.exportScope).onChange((value) => {
        this.exportScope = value === "all" || value === "filtered" || value === "custom" ? value : "month";
        refreshRange();
      });
    });
    const fromSetting = new Setting(this.contentEl).setName("起始日期（含）").addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.lang = this.plugin.settings.language;
      text.onChange((value) => this.dateFrom = value);
    });
    const toSetting = new Setting(this.contentEl).setName("结束日期（含）").addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.lang = this.plugin.settings.language;
      text.onChange((value) => this.dateTo = value);
    });
    const refreshRange = (): void => {
      const visible = this.exportScope === "custom";
      fromSetting.settingEl.toggleClass("bookkeeping-hidden", !visible);
      toSetting.settingEl.toggleClass("bookkeeping-hidden", !visible);
    };
    refreshRange();
    new Setting(this.contentEl)
      .setName("附带录入字段配置")
      .setDesc("勾选后，CSV会包含内置字段开关、录入顺序，以及自定义字段的类型、预设选项和启用状态。")
      .addToggle((toggle) => toggle.setValue(this.includeFieldConfig).onChange((value) => this.includeFieldConfig = value));
    const destinationSetting = new Setting(this.contentEl).setName("导出位置").addDropdown((dropdown) => {
      const options: Record<string, string> = { vault: "Obsidian仓库内" };
      if (Platform.isDesktopApp) options.computer = "电脑任意位置";
      dropdown.addOptions(options).setValue(this.destination).onChange((value) => {
        this.destination = value === "computer" ? "computer" : "vault";
        refreshDestination();
      });
    });
    const folderSetting = new Setting(this.contentEl).setName("仓库内导出路径").addText((text) => {
      text.setValue(this.folder).onChange((value) => this.folder = value.trim());
      new VaultFolderSuggest(this.app, text.inputEl);
    });
    new Setting(this.contentEl).setName("文件名").addText((text) => text.setValue(this.fileName).onChange((value) => this.fileName = value.trim()));
    const refreshDestination = (): void => {
      folderSetting.settingEl.toggleClass("bookkeeping-hidden", this.destination !== "vault");
      destinationSetting.setDesc("");
    };
    refreshDestination();
    const error = this.contentEl.createDiv({ cls: "bookkeeping-form-error" });
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText("导出").setCta().onClick(() => { void (async () => {
      try {
        error.empty();
        if (this.destination === "vault" && !this.folder) throw new Error("保存目录不能为空");
        if (!this.fileName) throw new Error("文件名不能为空");
        const options: { folder: string; fileName: string; dateFrom?: string; dateTo?: string; transactionIds?: string[]; includeFieldConfig?: boolean } = {
          folder: this.folder,
          fileName: this.fileName,
          includeFieldConfig: this.includeFieldConfig
        };
        if (this.exportScope === "month") {
          const days = new Date(Number(this.month.slice(0, 4)), Number(this.month.slice(5, 7)), 0).getDate();
          options.dateFrom = `${this.month}-01`;
          options.dateTo = `${this.month}-${String(days).padStart(2, "0")}`;
        } else if (this.exportScope === "custom") {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(this.dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(this.dateTo) || this.dateFrom > this.dateTo) throw new Error("请选择有效且先后顺序正确的日期范围");
          options.dateFrom = this.dateFrom;
          options.dateTo = this.dateTo;
        } else if (this.exportScope === "filtered") options.transactionIds = this.filteredIds ?? [];
        if (this.destination === "computer") {
          const csv = await this.plugin.store.buildCsv(options);
          const path = await this.saveCsvToComputer(csv, this.fileName);
          this.plugin.notice(`CSV已导出：${path}`);
        } else {
          const file = await this.plugin.store.exportCsv(options);
          this.plugin.notice(`CSV已导出：${file.path}`);
        }
        this.close();
      } catch (exportError) {
        error.setText(errorMessageZh(exportError, "CSV导出失败，请检查保存目录"));
      }
    })(); });
  }

  private async saveCsvToComputer(csv: string, fileName: string): Promise<string> {
    type SaveDialog = { showSaveDialog(options: { title: string; defaultPath: string; filters: Array<{ name: string; extensions: string[] }> }): Promise<{ canceled: boolean; filePath?: string }> };
    type RequireLike = (id: string) => unknown;
    const requireFn: RequireLike | undefined = typeof require === "function"
      ? require as RequireLike
      : (window as unknown as { require?: RequireLike }).require;
    if (!requireFn) throw new Error("当前环境无法打开系统保存对话框");
    const electron = requireFn("electron") as { remote?: { dialog?: SaveDialog } };
    let dialog = electron.remote?.dialog;
    if (!dialog) {
      try {
        dialog = (requireFn("@electron/remote") as { dialog?: SaveDialog }).dialog;
      } catch {
        dialog = undefined;
      }
    }
    if (!dialog) throw new Error("当前Obsidian版本不支持系统保存对话框");
    const result = await dialog.showSaveDialog({
      title: this.plugin.t("导出记账CSV"),
      defaultPath: `${fileName.replace(/\.csv$/i, "") || this.plugin.t("账目导出")}.csv`,
      filters: [{ name: this.plugin.t("CSV文件"), extensions: ["csv"] }]
    });
    if (result.canceled || !result.filePath) throw new Error("已取消导出");
    const fileSystem = requireFn("fs") as { promises: { writeFile(path: string, data: string, encoding: string): Promise<void> } };
    await fileSystem.promises.writeFile(result.filePath, csv, "utf8");
    return result.filePath;
  }
}

class TagManagerModal extends Modal {
  constructor(app: App, private readonly plugin: BookkeepingPlugin, private readonly focusTag: string) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    this.setTitle("标签批量管理");
    void this.renderTags();
  }

  private async renderTags(): Promise<void> {
    this.contentEl.empty();
    const transactions = await this.plugin.store.list();
    const counts = new Map<string, number>();
    for (const item of transactions) for (const tag of item.tags) if (tag !== "记账") counts.set(tag, (counts.get(tag) ?? 0) + 1);
    for (const tag of this.plugin.settings.customTags) if (!counts.has(tag)) counts.set(tag, 0);
    const list = this.contentEl.createDiv({ cls: "bookkeeping-tag-manager-list" });
    if (!counts.size) list.createDiv({ cls: "bookkeeping-empty", text: "尚无可管理的附加标签" });
    for (const [tag, count] of [...counts].sort((a, b) => b[1] - a[1])) {
      const row = list.createDiv({ cls: `bookkeeping-tag-manager-row${tag === this.focusTag ? " is-focused" : ""}` });
      const nameWrap = row.createDiv({ cls: "bookkeeping-tag-manager-name-wrap" });
      nameWrap.createSpan({ text: `#${tag}`, cls: "bookkeeping-tag-manager-name bookkeeping-user-text" });
      row.createSpan({ text: String(count), cls: "bookkeeping-tag-manager-count" }).createSpan({ text: "笔" });
      const renameButton = new ButtonComponent(row).setButtonText("重命名");
      renameButton.buttonEl.addClass("bookkeeping-tag-rename-button");
      let isRenaming = false;
      renameButton.onClick(() => {
        if (isRenaming) return void this.renderTags();
        isRenaming = true;
        renameButton.setButtonText("取消重命名").setDestructive();
        nameWrap.empty();
        nameWrap.createSpan({ text: "#", cls: "bookkeeping-tag-prefix" });
        const input = nameWrap.createEl("input", { type: "text", value: tag, attr: { "aria-label": `重命名${tag}` } });
        input.focus(); input.select();
        const save = nameWrap.createEl("button", { cls: "clickable-icon bookkeeping-tag-save-rename", attr: { type: "button", "aria-label": "保存重命名" } });
        setIcon(save, "check");
        const submit = (): void => {
          const next = input.value.replace(/^#/, "").trim();
          if (!next || next === tag) return void this.renderTags();
          void this.runTagAction(tag, next);
        };
        save.addEventListener("click", submit);
        input.addEventListener("keydown", (event) => { if (event.key === "Enter") submit(); else if (event.key === "Escape") void this.renderTags(); });
      });
      const removeTag = new ButtonComponent(row).setIcon("trash-2").setTooltip(`删除#${tag}`).setDestructive();
      removeTag.buttonEl.addClass("bookkeeping-danger-button");
      removeTag.onClick(() => {
        new ConfirmTagDeleteModal(this.app, tag, count,
          () => void this.runTagAction(tag, null),
          () => void this.runDeleteTransactions(tag)).open();
      });
    }
    const addRow = this.contentEl.createDiv({ cls: "bookkeeping-tag-manager-add" });
    addRow.createSpan({ text: "#", cls: "bookkeeping-tag-prefix" });
    const addInput = addRow.createEl("input", { type: "text", attr: { placeholder: "新建标签", "aria-label": "新建标签" } });
    const addButton = new ButtonComponent(addRow).setButtonText("新建标签").setIcon("plus").onClick(() => void this.createCustomTag(addInput.value));
    addInput.addEventListener("keydown", (event) => { if (event.key === "Enter") void this.createCustomTag(addInput.value); });
    addButton.buttonEl.disabled = false;
  }

  private async createCustomTag(value: string): Promise<void> {
    const tag = value.replace(/^#/, "").trim();
    if (!tag || tag === "记账") return;
    if (!this.plugin.settings.customTags.includes(tag)) {
      this.plugin.settings.customTags = [...this.plugin.settings.customTags, tag].sort((a, b) => a.localeCompare(b, "zh-CN"));
      await this.plugin.saveSettingsQuietly();
    }
    await this.renderTags();
  }

  private async runTagAction(oldTag: string, newTag: string | null): Promise<void> {
    this.contentEl.empty();
    const status = this.contentEl.createEl("p", { text: "准备修改…" });
    const progress = this.contentEl.createDiv({ cls: "bookkeeping-operation-progress" });
    const fill = progress.createDiv({ cls: "bookkeeping-operation-progress-fill" });
    const count = await this.plugin.store.updateTagGlobally(oldTag, newTag, (done, total) => {
      status.setText(`正在处理 ${done}/${total}（${total ? Math.round(done / total * 100) : 100}%）`);
      fill.setCssStyles({ width: `${total ? done / total * 100 : 100}%` });
    });
    await this.plugin.refreshDashboards();
    if (newTag) {
      this.plugin.settings.customTags = [...new Set(this.plugin.settings.customTags.map((tag) => tag === oldTag ? newTag : tag))];
      await this.plugin.saveSettingsQuietly();
    } else if (count === 0) {
      this.plugin.settings.customTags = this.plugin.settings.customTags.filter((tag) => tag !== oldTag);
      await this.plugin.saveSettingsQuietly();
    }
    status.setText(newTag ? `已把 #${oldTag} 重命名为 #${newTag} ，影响${count}笔账目。` : `已从${count}笔账目删除 #${oldTag} 。`);
    new ButtonComponent(this.contentEl).setButtonText("返回标签管理").setCta().onClick(() => void this.renderTags());
  }

  private async runDeleteTransactions(tag: string): Promise<void> {
    this.contentEl.empty();
    const status = this.contentEl.createEl("p", { text: "准备删除账目…" });
    const progress = this.contentEl.createDiv({ cls: "bookkeeping-operation-progress" });
    const fill = progress.createDiv({ cls: "bookkeeping-operation-progress-fill" });
    const count = await this.plugin.store.deleteTransactionsWithTag(tag, (done, total) => {
      status.setText(`正在删除 ${done}/${total}（${total ? Math.round(done / total * 100) : 100}%）`);
      fill.setCssStyles({ width: `${total ? done / total * 100 : 100}%` });
    });
    await this.plugin.refreshDashboards();
    status.setText(`已删除${count}笔包含#${tag}的账目。文件已移入系统回收站。`);
    new ButtonComponent(this.contentEl).setButtonText("返回标签管理").setCta().onClick(() => void this.renderTags());
  }
}

class ConfirmTagDeleteModal extends Modal {
  constructor(app: App, private readonly tag: string, private readonly count: number, private readonly onRemoveTag: () => void, private readonly onDeleteTransactions: () => void) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    this.setTitle("删除标签");
    this.contentEl.createEl("p", { text: `#${this.tag}用于${this.count}笔账目。请选择是否保留这些账目。` });
    this.contentEl.createEl("p", { text: "“仅移除标签”会保留账目；“删除相关账目”会把所有包含该标签的账目移入系统回收站。", cls: "setting-item-description" });
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText("仅移除标签").onClick(() => {
      this.close();
      this.onRemoveTag();
    });
    const removeTransactions = new ButtonComponent(actions).setButtonText("删除相关账目").setDestructive();
    removeTransactions.buttonEl.addClass("bookkeeping-danger-button");
    removeTransactions.onClick(() => {
      this.close();
      this.onDeleteTransactions();
    });
  }
}

class PeriodStatsModal extends Modal {
  private year: string;
  private body!: HTMLElement;
  private transactions: Transaction[] = [];

  constructor(app: App, private readonly plugin: BookkeepingPlugin, month: string) {
    super(app);
    this.year = month.slice(0, 4);
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal", "bookkeeping-period-modal");
    this.contentEl.addClass("bookkeeping-period-content");
    this.setTitle("年度统计");
    void this.load();
  }

  private async load(): Promise<void> {
    this.transactions = await this.plugin.store.list();
    const years = [...new Set(this.transactions.map((item) => item.date.slice(0, 4)))].sort().reverse();
    const controls = this.contentEl.createDiv({ cls: "bookkeeping-period-controls" });
    const year = controls.createEl("select", { attr: { "aria-label": "统计年份" } });
    for (const value of years.length ? years : [this.year]) year.createEl("option", { text: `${value}年`, value });
    year.value = years.includes(this.year) ? this.year : (years[0] ?? this.year);
    this.year = year.value;
    year.addEventListener("change", () => { this.year = year.value; this.renderStats(); });
    new ButtonComponent(controls).setButtonText("图表管理").setIcon("panels-top-left").onClick(() => {
      new AnnualChartsManagerModal(this.app, this.plugin, () => this.renderStats()).open();
    });
    this.body = this.contentEl.createDiv({ cls: "bookkeeping-period-body" });
    this.plugin.applySemanticColors(this.body);
    this.renderStats();
  }

  private renderStats(): void {
    this.body.empty();
    const items = this.transactions.filter((item) => item.date.startsWith(`${this.year}-`));
    const income = items.filter((item) => this.plugin.store.typeEffect(item.type) === "positive").reduce((sum, item) => sum + item.amount, 0);
    const expense = items.filter((item) => this.plugin.store.typeEffect(item.type) === "negative").reduce((sum, item) => sum + item.amount, 0);
    const cards = this.body.createDiv({ cls: "bookkeeping-period-summary" });
    [["收入", income, "is-positive"], ["支出", expense, "is-negative"], ["结余", income - expense, income - expense >= 0 ? "is-positive" : "is-negative"], ["账目", items.length, ""]].forEach(([label, value, cls]) => {
      const card = cards.createDiv({ cls: "bookkeeping-period-card" });
      card.createSpan({ text: String(label) });
      card.createEl("strong", { text: label === "账目" ? `${value}笔` : formatMoney(Number(value), this.plugin.settings.currency, this.plugin.settings.numberGrouping), cls: String(cls) });
    });
    const monthly = Array.from({ length: 12 }, (_, offset) => offset + 1).map((month) => {
      const prefix = `${this.year}-${String(month).padStart(2, "0")}`;
      const monthItems = items.filter((item) => item.date.startsWith(prefix));
      const monthIncome = monthItems.filter((item) => this.plugin.store.typeEffect(item.type) === "positive").reduce((sum, item) => sum + item.amount, 0);
      const monthExpense = monthItems.filter((item) => this.plugin.store.typeEffect(item.type) === "negative").reduce((sum, item) => sum + item.amount, 0);
      return { month, income: monthIncome, expense: monthExpense, net: monthIncome - monthExpense, count: monthItems.length };
    });
    const tableWrap = this.body.createDiv({ cls: "bookkeeping-period-table-wrap" });
    const table = tableWrap.createEl("table", { cls: "bookkeeping-period-table" });
    const head = table.createEl("thead").createEl("tr");
    ["月份", "收入", "支出", "结余", "账目数"].forEach((label) => head.createEl("th", { text: label }));
    const tbody = table.createEl("tbody");
    for (const row of monthly) {
      const tr = tbody.createEl("tr");
      tr.createEl("td", { text: `${row.month}月` });
      const incomeCell = tr.createEl("td", { text: formatMoney(row.income, this.plugin.settings.currency, this.plugin.settings.numberGrouping), cls: "is-positive" });
      const expenseCell = tr.createEl("td", { text: formatMoney(row.expense, this.plugin.settings.currency, this.plugin.settings.numberGrouping), cls: "is-negative" });
      const netCell = tr.createEl("td", { text: formatMoney(row.net, this.plugin.settings.currency, this.plugin.settings.numberGrouping), cls: row.net >= 0 ? "is-positive" : "is-negative" });
      incomeCell.dataset.compact = `${this.plugin.settings.currency}${this.compactNumber(row.income)}`;
      expenseCell.dataset.compact = `${this.plugin.settings.currency}${this.compactNumber(row.expense)}`;
      netCell.dataset.compact = `${row.net < 0 ? "−" : ""}${this.plugin.settings.currency}${this.compactNumber(Math.abs(row.net))}`;
      tr.createEl("td", { text: `${row.count}笔` });
    }
    const charts = this.body.createDiv({ cls: "bookkeeping-annual-chart-list" });
    for (const chart of this.plugin.settings.annualChartConfigs.filter((item) => item.visible)) {
      const panel = charts.createDiv({ cls: "bookkeeping-annual-chart" });
      const header = panel.createDiv({ cls: "bookkeeping-annual-chart-header" });
      header.createEl("h3", { text: chart.title });
      const menu = header.createEl("button", { cls: "clickable-icon", attr: { type: "button", "aria-label": `配置${chart.title}` } });
      setIcon(menu, "ellipsis");
      menu.addEventListener("click", () => new AnnualChartSettingsModal(this.app, this.plugin, chart, () => this.renderStats()).open());
      const chartBody = panel.createDiv({ cls: "bookkeeping-annual-chart-body" });
      this.renderAnnualChart(chartBody, chart, items, monthly);
    }
    if (!charts.childElementCount) charts.createDiv({ cls: "bookkeeping-empty-panel", text: "尚未显示年度图表，可点击上方“图表管理”添加。" });
  }

  private renderAnnualChart(parent: HTMLElement, chart: AnnualChartConfig, items: Transaction[], monthly: Array<{ month: number; income: number; expense: number; net: number; count: number }>): void {
    if (chart.metric === "monthlyNet" || chart.metric === "monthlyIncome" || chart.metric === "monthlyExpense") {
      const values = monthly.map((item) => chart.metric === "monthlyIncome" ? item.income : chart.metric === "monthlyExpense" ? item.expense : item.net);
      this.renderAnnualTrend(parent, values);
      return;
    }
    const values = new Map<string, number>();
    if (chart.metric === "accountBalance") {
      const balances = this.plugin.store.accountMonthlyBalances(this.transactions, `${this.year}-12`).closing;
      balances.forEach((value, name) => values.set(name, value));
    } else {
      for (const item of items) {
        for (const tag of item.tags.filter((value) => value !== "记账")) {
          const effect = this.plugin.store.typeEffect(item.type);
          const amount = chart.metric === "tagCount" ? 1 : chart.metric === "tagIncome" ? (effect === "positive" ? item.amount : 0)
            : chart.metric === "tagExpense" ? (effect === "negative" ? item.amount : 0)
            : effect === "positive" ? item.amount : effect === "negative" ? -item.amount : 0;
          values.set(tag, (values.get(tag) ?? 0) + amount);
        }
      }
    }
    this.renderAnnualBars(parent, values, chart.metric === "tagCount", chart.metric !== "accountBalance");
  }

  private renderAnnualTrend(parent: HTMLElement, values: number[]): void {
    const width = 760, height = 270, left = 62, right = 18, top = 18, bottom = 36;
    let min = Math.min(0, ...values), max = Math.max(0, ...values);
    if (min === max) { min -= 1; max += 1; }
    const span = Math.max(max - min, 1);
    const svg = createSvg("svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.classList.add("bookkeeping-annual-trend-svg");
    const point = (index: number, value: number): [number, number] => [left + index * (width - left - right) / 11, top + (max - value) / span * (height - top - bottom)];
    for (let tick = 0; tick < 6; tick++) {
      const value = max - span * tick / 5;
      const y = top + (height - top - bottom) * tick / 5;
      const line = svg.createSvg("line");
      line.setAttribute("x1", String(left)); line.setAttribute("x2", String(width - right)); line.setAttribute("y1", String(y)); line.setAttribute("y2", String(y));
      line.setAttribute("class", Math.abs(value) < span / 100 ? "bookkeeping-annual-zero" : "bookkeeping-annual-grid");
      svg.appendChild(line);
      const label = svg.createSvg("text");
      label.setAttribute("x", String(left - 8)); label.setAttribute("y", String(y + 4)); label.setAttribute("text-anchor", "end");
      label.textContent = this.compactNumber(value); svg.appendChild(label);
    }
    const path = svg.createSvg("polyline");
    path.setAttribute("points", values.map((value, index) => point(index, value).join(",")).join(" "));
    path.setAttribute("class", "bookkeeping-annual-line"); svg.appendChild(path);
    values.forEach((value, index) => {
      const [x, y] = point(index, value);
      const dot = svg.createSvg("circle"); dot.setAttribute("cx", String(x)); dot.setAttribute("cy", String(y)); dot.setAttribute("r", "3"); dot.setAttribute("class", "bookkeeping-annual-dot"); svg.appendChild(dot);
      const label = svg.createSvg("text"); label.setAttribute("x", String(x)); label.setAttribute("y", String(height - 10)); label.setAttribute("text-anchor", "middle"); label.textContent = `${index + 1}月`; svg.appendChild(label);
    });
    parent.appendChild(svg);
  }

  private renderAnnualBars(parent: HTMLElement, values: Map<string, number>, count: boolean, tagPrefix: boolean): void {
    const entries = [...values].sort((a, b) => b[1] - a[1]);
    if (!entries.length) return void parent.createDiv({ cls: "bookkeeping-empty-panel", text: "没有符合条件的账目" });
    const list = parent.createDiv({ cls: "bookkeeping-annual-bars" });
    const max = Math.max(...entries.map(([, value]) => Math.abs(value)), 1);
    for (const [name, value] of entries) {
      const row = list.createDiv({ cls: "bookkeeping-annual-bar-row" });
      const label = row.createDiv({ cls: "bookkeeping-bar-label" });
      label.createSpan({ text: tagPrefix && !name.startsWith("#") ? `#${name}` : name, cls: tagPrefix ? "bookkeeping-user-text" : "" });
      label.createSpan({ text: count ? `${value}笔` : formatMoney(value, this.plugin.settings.currency, this.plugin.settings.numberGrouping) });
      const track = row.createDiv({ cls: "bookkeeping-progress" });
      track.createDiv({ cls: `bookkeeping-progress-fill${value < 0 ? " is-negative" : ""}`, attr: { style: `width:${Math.abs(value) / max * 100}%` } });
    }
  }

  private compactNumber(value: number): string {
    if (this.plugin.settings.language !== "zh-CN" && this.plugin.settings.language !== "zh-TW") {
      if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
      return Number(value.toFixed(2)).toString();
    }
    if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`;
    if (Math.abs(value) >= 1000) return String(Math.round(value));
    return Number(value.toFixed(2)).toString();
  }
}

const ANNUAL_METRICS: Record<AnnualChartMetric, string> = {
  monthlyNet: "月份结余趋势", monthlyIncome: "月份收入趋势", monthlyExpense: "月份支出趋势",
  tagExpense: "标签支出汇总", tagIncome: "标签收入汇总", tagNet: "标签结余汇总",
  tagCount: "标签账目数量", accountBalance: "账户余额"
};

class AnnualChartsManagerModal extends Modal {
  constructor(app: App, private readonly plugin: BookkeepingPlugin, private readonly onSaved: () => void) { super(app); }
  onOpen(): void { this.modalEl.addClass("bookkeeping-modal"); this.render(); }
  private render(): void {
    this.contentEl.empty(); this.setTitle("年度图表管理");
    const list = this.contentEl.createDiv({ cls: "bookkeeping-chart-manager" });
    for (const chart of this.plugin.settings.annualChartConfigs) {
      const row = list.createDiv({ cls: "bookkeeping-chart-manager-row bookkeeping-annual-manager-row" });
      row.createSpan({ cls: "bookkeeping-chart-manager-name", text: chart.title });
      const controls = row.createDiv({ cls: "bookkeeping-annual-manager-actions" });
      const eye = controls.createEl("button", { cls: "clickable-icon", attr: { type: "button", "aria-label": chart.visible ? "隐藏图表" : "显示图表" } });
      setIcon(eye, chart.visible ? "eye" : "eye-off");
      eye.addEventListener("click", () => { void (async () => { chart.visible = !chart.visible; await this.plugin.saveSettingsQuietly(); this.render(); })(); });
      new ButtonComponent(controls).setIcon("settings-2").setTooltip("配置").onClick(() => new AnnualChartSettingsModal(this.app, this.plugin, chart, () => { this.onSaved(); this.render(); }).open());
    }
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("添加图表").setIcon("plus").onClick(() => { void (async () => {
      this.plugin.settings.annualChartConfigs.push({ id: `annual-${Date.now()}`, title: "月份结余趋势", metric: "monthlyNet", visible: true });
      await this.plugin.saveSettingsQuietly(); this.onSaved(); this.render();
    })(); });
    new ButtonComponent(actions).setButtonText("完成").setCta().onClick(() => { this.onSaved(); this.close(); });
  }
}

class AnnualChartSettingsModal extends Modal {
  private metric: AnnualChartMetric;
  constructor(app: App, private readonly plugin: BookkeepingPlugin, private readonly chart: AnnualChartConfig, private readonly onSaved: () => void) { super(app); this.metric = chart.metric; }
  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal"); this.setTitle("配置年度图表");
    new Setting(this.contentEl).setName("图表内容").addDropdown((dropdown) => dropdown.addOptions(ANNUAL_METRICS).setValue(this.metric).onChange((value) => this.metric = value as AnnualChartMetric));
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText("隐藏图表").setIcon("eye-off").onClick(() => { void (async () => { this.chart.visible = false; await this.plugin.saveSettingsQuietly(); this.onSaved(); this.close(); })(); });
    const removeChart = new ButtonComponent(actions).setButtonText("删除图表").setDestructive();
    removeChart.buttonEl.addClass("bookkeeping-danger-button");
    removeChart.onClick(() => { void (async () => { this.plugin.settings.annualChartConfigs = this.plugin.settings.annualChartConfigs.filter((item) => item.id !== this.chart.id); await this.plugin.saveSettingsQuietly(); this.onSaved(); this.close(); })(); });
    new ButtonComponent(actions).setButtonText("保存").setCta().onClick(() => { void (async () => { this.chart.metric = this.metric; this.chart.title = ANNUAL_METRICS[this.metric]; await this.plugin.saveSettingsQuietly(); this.onSaved(); this.close(); })(); });
  }
}
