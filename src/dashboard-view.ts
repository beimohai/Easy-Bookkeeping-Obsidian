import { App, ButtonComponent, ItemView, Menu, Modal, Platform, Setting, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import type BookkeepingPlugin from "./main";
import type { AccountConfig, BookkeepingSettings, CalendarMetric, ChartKind, ChartType, DashboardChartConfig, DashboardFilterState, HeaderAction, Necessity, PieMetric, TableColumn, TagMetric, TagSort, Transaction, TransactionDraft, TransactionType, TrendMetric } from "./types";
import { currentMonth, errorMessageZh, evaluateAmount, formatDateDisplay, formatMoney, formatMonthDisplay, formatWeekdayLabels, monthOf, normalizeDate, roundMoney } from "./utils";
import { bindPointerSort } from "./pointer-sort";

export const DASHBOARD_VIEW_TYPE = "bookkeeping-dashboard";

type DashboardFilters = DashboardFilterState;

const emptyDashboardFilters = (): DashboardFilters => ({
  types: [], necessities: [], categories: [], accounts: [], keyword: "",
  amountMin: "", amountMax: "", dateFrom: "", dateTo: "", tags: "", crossMonth: false, calendarDate: ""
});

const cloneDashboardFilters = (filters: DashboardFilters): DashboardFilters => ({
  ...filters,
  calendarDate: filters.calendarDate ?? "",
  types: [...filters.types],
  necessities: [...filters.necessities],
  categories: [...filters.categories],
  accounts: [...filters.accounts]
});

function normalizeTypedDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function completeTypedDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length !== 8) return raw;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

type SortDirection = "asc" | "desc";

interface BulkEditChanges {
  date?: string;
  type?: TransactionType;
  necessity?: Necessity;
  account?: string;
  targetAccount?: string;
  category?: string;
  tagMode?: "add" | "remove" | "replace";
  tags?: string[];
}

const AUXILIARY_CHART_COLORS = ["#E2A23A", "#8A63D2", "#1F9D8A", "#D76A9B", "#53657D", "#B5793E"];

export class DashboardView extends ItemView {
  private month = currentMonth();
  private filters: DashboardFilters;
  private sortColumn: TableColumn | null = "title";
  private sortDirection: SortDirection = "asc";
  private dateSortLocked = true;
  private dateSortDirection: SortDirection = "desc";
  private renderVersion = 0;
  private draggedChartId = "";
  private showAdvancedFilters = false;
  private selectedIds = new Set<string>();
  private deletingIds = new Set<string>();
  private exportIds: string[] = [];
  private preferredScrollAnchor = "";
  private scrollElement: HTMLElement | Window = window;
  private trendCache = new Map<string, number[]>();
  private tableResizeObserver: ResizeObserver | null = null;
  private openMultiFilter: "types" | "necessities" | "categories" | "accounts" | "tags" | null = null;
  private readonly multiFilterSearch: Record<"types" | "necessities" | "categories" | "accounts" | "tags", string> = { types: "", necessities: "", categories: "", accounts: "", tags: "" };

  constructor(leaf: WorkspaceLeaf, private readonly plugin: BookkeepingPlugin) {
    super(leaf);
    if ((plugin.settings.filterPersistence === "current" || plugin.settings.filterPersistence === "monthly") && /^\d{4}-\d{2}$/.test(plugin.settings.lastDashboardMonth)) {
      this.month = plugin.settings.lastDashboardMonth;
    }
    this.filters = plugin.settings.filterPersistence === "current"
      ? cloneDashboardFilters(plugin.settings.savedDashboardFilters)
      : plugin.settings.filterPersistence === "monthly" && plugin.settings.savedMonthlyDashboardFilters[this.month]
        ? cloneDashboardFilters(plugin.settings.savedMonthlyDashboardFilters[this.month] as DashboardFilters)
        : emptyDashboardFilters();
    this.showAdvancedFilters = plugin.settings.filterPersistence === "current"
      ? plugin.settings.savedDashboardAdvancedFilters
      : plugin.settings.filterPersistence === "monthly"
        ? Boolean(plugin.settings.savedMonthlyDashboardAdvancedFilters[this.month])
        : false;
  }

  getViewType(): string {
    return DASHBOARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.plugin.t("记账仪表盘");
  }

  getIcon(): string {
    return "wallet";
  }

  async onOpen(): Promise<void> {
    this.containerEl.addClass("bookkeeping-view-container");
    this.scrollElement = Platform.isMobile ? this.resolveMobileScrollElement() : this.contentEl;
    if (this.scrollElement instanceof Window) this.registerDomEvent(window, "scroll", () => this.updateFloatingBackToTop(), { passive: true });
    else this.registerDomEvent(this.scrollElement, "scroll", () => this.updateFloatingBackToTop());
    this.registerDomEvent(document, "pointerdown", (event) => {
      const opened = this.contentEl.querySelector<HTMLDetailsElement>(".bookkeeping-multi-filter[open]");
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (opened && !opened.contains(target)) {
        opened.removeAttribute("open");
        this.openMultiFilter = null;
      }
    }, true);
    await this.render();
  }

  async onClose(): Promise<void> {
    this.tableResizeObserver?.disconnect();
    this.tableResizeObserver = null;
    this.persistFiltersForCurrentMonth();
    await this.plugin.saveSettingsQuietly();
  }

  private persistFiltersForCurrentMonth(): void {
    if (this.plugin.settings.filterPersistence === "current") {
      this.plugin.settings.savedDashboardFilters = cloneDashboardFilters(this.filters);
      this.plugin.settings.savedDashboardAdvancedFilters = this.showAdvancedFilters;
      this.plugin.settings.lastDashboardMonth = this.month;
    } else if (this.plugin.settings.filterPersistence === "monthly") {
      this.plugin.settings.savedMonthlyDashboardFilters[this.month] = cloneDashboardFilters(this.filters);
      this.plugin.settings.savedMonthlyDashboardAdvancedFilters[this.month] = this.showAdvancedFilters;
      this.plugin.settings.lastDashboardMonth = this.month;
    } else {
      this.plugin.settings.savedDashboardFilters = emptyDashboardFilters();
      this.plugin.settings.savedMonthlyDashboardFilters = {};
      this.plugin.settings.savedDashboardAdvancedFilters = false;
      this.plugin.settings.savedMonthlyDashboardAdvancedFilters = {};
      this.plugin.settings.lastDashboardMonth = "";
    }
  }

  private async switchMonth(month: string): Promise<void> {
    if (month === this.month) return;
    if (this.plugin.settings.filterPersistence === "monthly") {
      this.plugin.settings.savedMonthlyDashboardFilters[this.month] = cloneDashboardFilters(this.filters);
      this.plugin.settings.savedMonthlyDashboardAdvancedFilters[this.month] = this.showAdvancedFilters;
    }
    this.month = month;
    if (this.plugin.settings.filterPersistence === "monthly") {
      const saved = this.plugin.settings.savedMonthlyDashboardFilters[month];
      this.filters = saved ? cloneDashboardFilters(saved) : emptyDashboardFilters();
      this.showAdvancedFilters = Boolean(this.plugin.settings.savedMonthlyDashboardAdvancedFilters[month]);
      this.plugin.settings.lastDashboardMonth = month;
      await this.plugin.saveSettingsQuietly();
    } else if (this.plugin.settings.filterPersistence === "current") {
      this.plugin.settings.lastDashboardMonth = month;
      await this.plugin.saveSettingsQuietly();
    }
    await this.render();
  }

  async refresh(): Promise<void> {
    await this.render();
  }

  private async render(): Promise<void> {
    this.tableResizeObserver?.disconnect();
    this.tableResizeObserver = null;
    const version = ++this.renderVersion;
    const activeSearch = document.activeElement instanceof HTMLInputElement && document.activeElement.matches(".bookkeeping-search-input")
      ? document.activeElement
      : null;
    const searchCaret = activeSearch?.selectionStart ?? null;
    const scrollTop = this.getScrollTop();
    const tableScrollLeft = this.contentEl.querySelector<HTMLElement>(".bookkeeping-table-wrapper")?.scrollLeft ?? 0;
    const contentTop = this.contentEl.getBoundingClientRect().top;
    const preferredSelector = this.preferredScrollAnchor;
    this.preferredScrollAnchor = "";
    const preferredElement = preferredSelector ? this.contentEl.querySelector<HTMLElement>(preferredSelector) : null;
    const preferredOffset = preferredElement ? preferredElement.getBoundingClientRect().top - contentTop : null;
    const scrollAnchors = Array.from(this.contentEl.querySelectorAll<HTMLElement>("tr[data-transaction-id]"))
      .filter((row) => row.getBoundingClientRect().bottom > contentTop)
      .slice(0, 3)
      .map((row) => ({ id: row.dataset.transactionId ?? "", offset: row.getBoundingClientRect().top - contentTop }));
    this.trendCache.clear();
    const all = await this.plugin.store.list();
    if (version !== this.renderVersion) return;
    const content = this.contentEl;
    content.empty();
    this.containerEl.querySelector(".bookkeeping-floating-back-to-top")?.remove();
    content.addClass("bookkeeping-dashboard");
    content.toggleClass("is-mobile", Platform.isMobile);
    content.toggleClass("is-phone", Platform.isMobile && window.matchMedia("(max-width: 700px)").matches);
    content.toggleClass("is-tablet", Platform.isMobile && window.matchMedia("(min-width: 701px)").matches);
    this.plugin.applySemanticColors(content);
    const dashboard = content.createDiv({ cls: "bookkeeping-dashboard-inner" });

    const monthItems = all.filter((item) => monthOf(item.date) === this.month);
    const useAllMonths = this.filters.crossMonth;
    const tableScope = useAllMonths ? all : monthItems;
    const filteredItems = this.applyFilters(tableScope);
    const chartItems = this.applyFilters(monthItems);
    const tags = this.collectTags(monthItems);
    this.exportIds = filteredItems.map((item) => item.id);
    this.renderHeader(dashboard);
    if (!all.length) {
      this.renderEmptyGuide(dashboard);
      this.restoreScroll(scrollTop, tableScrollLeft, scrollAnchors, preferredSelector, preferredOffset, version);
      return;
    }
    const summary = this.summarizeFiltered(filteredItems);
    this.renderSummary(dashboard, summary.income, summary.expense, summary.balance, filteredItems.length, this.hasActiveFilters() ? "筛选" : "本月");
    this.renderDashboardGrid(dashboard, chartItems, all);
    this.renderFilters(dashboard, tableScope, tags);
    const visibleItems = this.sortItems(filteredItems);
    const visibleIds = new Set(visibleItems.map((item) => item.id));
    this.selectedIds = new Set([...this.selectedIds].filter((id) => visibleIds.has(id)));
    this.renderBatchToolbar(dashboard, visibleItems);
    this.renderTable(dashboard, visibleItems);
    this.renderFloatingBackToTop();
    this.restoreScroll(scrollTop, tableScrollLeft, scrollAnchors, preferredSelector, preferredOffset, version);
    if (activeSearch) window.requestAnimationFrame(() => {
      if (version !== this.renderVersion) return;
      const nextSearch = this.contentEl.querySelector<HTMLInputElement>(".bookkeeping-search-input");
      nextSearch?.focus({ preventScroll: true });
      if (nextSearch && searchCaret !== null) nextSearch.setSelectionRange(searchCaret, searchCaret);
    });
  }

  private renderFloatingBackToTop(): void {
    if (!this.plugin.settings.showFloatingBackToTop) return;
    const button = this.containerEl.createEl("button", { cls: "bookkeeping-floating-back-to-top", attr: { type: "button", "aria-label": "返回仪表盘顶部" } });
    const icon = button.createSpan();
    setIcon(icon, "arrow-up-to-line");
    button.createSpan({ text: "返回顶部" });
    button.addEventListener("click", () => this.scrollToTop());
    this.updateFloatingBackToTop();
  }

  private updateFloatingBackToTop(): void {
    const button = this.containerEl.querySelector<HTMLElement>(".bookkeeping-floating-back-to-top");
    button?.toggleClass("is-visible", this.getScrollTop() > 4);
  }

  private getScrollTop(): number {
    return this.scrollElement instanceof Window
      ? window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
      : this.scrollElement.scrollTop;
  }

  private resolveMobileScrollElement(): HTMLElement | Window {
    const viewScroller = this.contentEl.closest<HTMLElement>(".view-content, .workspace-leaf-content");
    if (viewScroller) return viewScroller;
    for (let element = this.contentEl.parentElement; element; element = element.parentElement) {
      const style = window.getComputedStyle(element);
      if (!/(auto|scroll|overlay)/.test(style.overflowY)) continue;
      if (element.scrollHeight <= element.clientHeight + 1) continue;
      return element;
    }
    return window;
  }

  private setScrollTop(value: number): void {
    if (this.scrollElement instanceof Window) window.scrollTo({ top: value, left: window.scrollX });
    else this.scrollElement.scrollTop = value;
  }

  private scrollBy(delta: number): void {
    if (this.scrollElement instanceof Window) window.scrollBy({ top: delta, left: 0 });
    else this.scrollElement.scrollTop += delta;
  }

  private scrollToTop(): void {
    if (this.scrollElement instanceof Window) window.scrollTo({ top: 0, behavior: "smooth" });
    else this.scrollElement.scrollTo({ top: 0, behavior: "smooth" });
  }

  private renderHeader(content: HTMLElement): void {
    const header = content.createDiv({ cls: "bookkeeping-dashboard-header" });
    const title = header.createDiv({ cls: "bookkeeping-dashboard-title" });
    title.createEl("h2", { text: "记账仪表盘" });
    const monthSlot = header.createDiv({ cls: "bookkeeping-month-slot" });
    const actions = header.createDiv({ cls: "bookkeeping-header-actions" });
    const isPhone = Platform.isMobile && window.matchMedia("(max-width: 700px)").matches;
    const actionGroup = actions.createDiv({ cls: `bookkeeping-header-action-buttons${isPhone ? " is-phone-split" : ""}` });
    const monthInput = actionGroup.createEl("input", { cls: "bookkeeping-month-input", type: "month", value: this.month, attr: { "aria-label": "选择仪表盘月份", lang: this.plugin.settings.language } });
    monthInput.addEventListener("change", () => {
      if (!/^\d{4}-\d{2}$/.test(monthInput.value)) return;
      void this.switchMonth(monthInput.value);
    });
    const displayMonth = formatMonthDisplay(this.month, this.plugin.settings.yearMonthDisplayFormat, this.plugin.settings.language);
    const visibleHeaderActions = this.plugin.settings.headerActionOrder.filter((action) => !this.plugin.settings.collapsedHeaderActions.includes(action));
    const renderPrimaryAction = (parent: HTMLElement): void => {
      new ButtonComponent(parent).setIcon("plus").setTooltip(`在${displayMonth}新建账目`).setCta().onClick(() => this.plugin.openEntry(false, null, undefined, this.month));
    };
    const renderChartAction = (parent: HTMLElement): void => {
      new ButtonComponent(parent).setIcon("panels-top-left").setTooltip("配置仪表盘图表").onClick(() => new DashboardChartsModal(this.app, this.plugin, () => this.render()).open());
    };
    let phonePrimaryActionRow: HTMLElement | null = null;
    if (isPhone) {
      const topRow = actionGroup.createDiv({ cls: "bookkeeping-header-action-row-primary" });
      phonePrimaryActionRow = topRow;
      const renderers: Array<(parent: HTMLElement) => void> = [renderPrimaryAction, renderChartAction, ...visibleHeaderActions.map((action) => (parent: HTMLElement) => this.renderHeaderAction(parent, action))];
      renderers.forEach((render) => render(topRow));
    } else {
      renderPrimaryAction(actionGroup);
      renderChartAction(actionGroup);
      for (const action of visibleHeaderActions) this.renderHeaderAction(actionGroup, action);
    }
    const menuButton = actions.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "更多仪表盘操作" } });
    setIcon(menuButton, "ellipsis");
    menuButton.addEventListener("click", (event) => this.openDashboardMenu(event));
    if (isPhone) {
      monthSlot.appendChild(monthInput);
      phonePrimaryActionRow?.appendChild(menuButton);
    }
  }

  private renderEmptyGuide(content: HTMLElement): void {
    const guide = content.createDiv({ cls: "bookkeeping-empty-guide" });
    const icon = guide.createSpan({ cls: "bookkeeping-empty-guide-icon" });
    icon.createEl("img", { attr: { src: this.plugin.pluginLogoUrl(), alt: "Easy Bookkeeping Logo" } });
    guide.createEl("h3", { text: "开始建立你的第一笔账目" });
    const actions = guide.createDiv({ cls: "bookkeeping-empty-guide-actions" });
    new ButtonComponent(actions).setButtonText("记第一笔").setCta().onClick(() => this.plugin.openEntry(false, null, undefined, this.month));
    new ButtonComponent(actions).setButtonText("导入CSV文件").onClick(() => this.plugin.openCsvImporter());
  }

  private currentFilteredIds(): string[] {
    return [...this.exportIds];
  }

  private restoreScroll(scrollTop: number, tableScrollLeft: number, anchors: Array<{ id: string; offset: number }>, preferredSelector: string, preferredOffset: number | null, version: number): void {
    window.requestAnimationFrame(() => {
      if (version !== this.renderVersion) return;
      this.setScrollTop(scrollTop);
      const wrapper = this.contentEl.querySelector<HTMLElement>(".bookkeeping-table-wrapper");
      if (wrapper) wrapper.scrollLeft = tableScrollLeft;
      const contentTop = this.contentEl.getBoundingClientRect().top;
      const preferred = preferredSelector ? this.contentEl.querySelector<HTMLElement>(preferredSelector) : null;
      if (preferred && preferredOffset !== null) {
        this.scrollBy(preferred.getBoundingClientRect().top - contentTop - preferredOffset);
        this.updateFloatingBackToTop();
        return;
      }
      for (const anchor of anchors) {
        const row = Array.from(this.contentEl.querySelectorAll<HTMLElement>("tr[data-transaction-id]")).find((candidate) => candidate.dataset.transactionId === anchor.id);
        if (!row) continue;
        this.scrollBy(row.getBoundingClientRect().top - contentTop - anchor.offset);
        break;
      }
      this.updateFloatingBackToTop();
    });
  }

  private openDashboardMenu(event: MouseEvent): void {
    const menu = new Menu();
    for (const action of this.plugin.settings.headerActionOrder.filter((item) => this.plugin.settings.collapsedHeaderActions.includes(item))) {
      const meta = this.headerActionMeta(action);
      menu.addItem((item) => item.setTitle(this.plugin.t(meta.label)).setIcon(meta.icon).onClick(meta.run));
    }
    if (this.plugin.settings.collapsedHeaderActions.length) menu.addSeparator();
    menu.addItem((item) => item.setTitle(this.plugin.t("配置顶部按钮")).setIcon("sliders-horizontal").onClick(() => new HeaderActionsModal(this.app, this.plugin, () => this.render()).open()));
    menu.addItem((item) => item.setTitle(this.plugin.t("转换旧版账目")).setIcon("replace").onClick(() => this.plugin.openLegacyConverter()));
    menu.showAtMouseEvent(event);
  }

  private renderHeaderAction(parent: HTMLElement, action: HeaderAction): void {
    const meta = this.headerActionMeta(action);
    new ButtonComponent(parent).setIcon(meta.icon).setTooltip(meta.label).onClick(meta.run);
  }

  private headerActionMeta(action: HeaderAction): { label: string; icon: string; run: () => void } {
    if (action === "export") return { label: "导出CSV文件", icon: "download", run: () => this.plugin.openCsvExporter(this.month, this.currentFilteredIds()) };
    if (action === "import") return { label: "导入CSV文件", icon: "upload", run: () => this.plugin.openCsvImporter() };
    if (action === "period") return { label: "年度统计", icon: "chart-no-axes-combined", run: () => this.plugin.openPeriodStats(this.month) };
    if (action === "refresh") return { label: "重新扫描", icon: "refresh-cw", run: () => void this.plugin.restartPlugin() };
    if (action === "tags") return { label: "标签批量管理", icon: "tags", run: () => this.plugin.openTagManager() };
    return { label: "插件设置", icon: "settings", run: () => this.plugin.openPluginSettings() };
  }

  private renderSummary(content: HTMLElement, income: number, expense: number, balance: number, count: number, prefix: string): void {
    const cards = content.createDiv({ cls: "bookkeeping-summary-cards" });
    this.summaryCard(cards, `${prefix}收入`, this.money(income), "trending-up", "income");
    this.summaryCard(cards, `${prefix}支出`, this.money(expense), "trending-down", "expense");
    this.summaryCard(cards, `${prefix}结余`, this.money(balance), "scale", balance >= 0 ? "income" : "expense");
    this.summaryCard(cards, "账目数量", `${count}笔`, "list", "neutral");
  }

  private summarizeFiltered(items: Transaction[]): { income: number; expense: number; balance: number } {
    const income = roundMoney(items.filter((item) => this.typeEffect(item) === "positive").reduce((sum, item) => sum + item.amount, 0));
    const expense = roundMoney(items.filter((item) => this.typeEffect(item) === "negative").reduce((sum, item) => sum + item.amount, 0));
    return { income, expense, balance: roundMoney(income - expense) };
  }

  private summaryCard(parent: HTMLElement, label: string, value: string, icon: string, tone: string): void {
    const card = parent.createDiv({ cls: `bookkeeping-summary-card bookkeeping-${tone}`, attr: { title: `${label}：${value}` } });
    const iconEl = card.createSpan({ cls: "bookkeeping-card-icon" });
    setIcon(iconEl, icon);
    const body = card.createDiv({ cls: "bookkeeping-card-body" });
    body.createDiv({ cls: "bookkeeping-card-label", text: label });
    body.createDiv({ cls: "bookkeeping-card-value", text: value });
  }

  private renderDashboardGrid(content: HTMLElement, monthItems: Transaction[], all: Transaction[]): void {
    const grid = content.createDiv({ cls: "bookkeeping-main-grid" });
    for (const chart of this.plugin.settings.chartConfigs.filter((item) => item.visible)) {
      const panel = this.chartPanel(grid, chart);
      if (chart.kind === "trend") this.renderTrend(panel, chart, monthItems, all);
      else if (chart.kind === "pie") this.renderPie(panel, chart.metric as PieMetric, monthItems, all);
      else if (chart.kind === "tag") this.renderTagSummary(panel, chart, monthItems);
      else if (chart.kind === "calendar") this.renderCalendar(panel, chart.metric as CalendarMetric, monthItems);
      else if (chart.kind === "budget") {
        const summary = this.plugin.store.summarize(monthItems, this.month);
        this.renderBudgets(panel, summary.byCategory, summary.expense);
      } else this.renderAccounts(panel, all);
    }
    if (!grid.childElementCount) grid.remove();
  }

  private chartPanel(parent: HTMLElement, chart: DashboardChartConfig): HTMLElement {
    const panel = parent.createDiv({ cls: `bookkeeping-panel bookkeeping-chart-panel bookkeeping-chart-kind-${chart.kind}${chart.width === "full" ? " is-full" : ""}` });
    panel.dataset.chartId = chart.id;
    panel.addEventListener("dragstart", () => {
      this.draggedChartId = chart.id;
      panel.addClass("is-dragging");
    });
    panel.addEventListener("dragend", () => {
      this.draggedChartId = "";
      panel.removeClass("is-dragging");
      this.contentEl.querySelectorAll(".is-drop-target").forEach((element) => element.classList.remove("is-drop-target"));
    });
    panel.addEventListener("dragover", (event) => event.preventDefault());
    panel.addEventListener("dragenter", () => {
      if (this.draggedChartId && this.draggedChartId !== chart.id) panel.addClass("is-drop-target");
    });
    panel.addEventListener("dragleave", (event) => {
      if (!panel.contains(event.relatedTarget as Node | null)) panel.removeClass("is-drop-target");
    });
    panel.addEventListener("drop", (event) => {
      event.preventDefault();
      panel.removeClass("is-drop-target");
      if (this.draggedChartId && this.draggedChartId !== chart.id) void this.moveChart(this.draggedChartId, chart.id);
    });
    const heading = panel.createDiv({ cls: "bookkeeping-panel-heading" });
    const drag = heading.createSpan({ cls: "bookkeeping-chart-drag", attr: { title: "拖动排序" } });
    drag.draggable = true;
    setIcon(drag, "grip-vertical");
    bindPointerSort({
      root: parent,
      item: panel,
      handle: drag,
      itemSelector: ".bookkeeping-chart-panel",
      onCommit: (_source, target) => {
        const targetId = target?.dataset.chartId;
        if (targetId && targetId !== chart.id) void this.moveChart(chart.id, targetId);
      }
    });
    const titleWrap = heading.createDiv({ cls: "bookkeeping-panel-title" });
    const iconEl = titleWrap.createSpan();
    setIcon(iconEl, chart.kind === "trend" ? "chart-no-axes-combined" : chart.kind === "pie" ? "pie-chart" : chart.kind === "calendar" ? "calendar-days" : chart.kind === "budget" ? "gauge" : chart.kind === "account" ? "landmark" : "tags");
    titleWrap.createEl("h3", { text: chart.title, attr: { title: chart.title } });
    if (chart.kind === "budget" || chart.kind === "account") {
      const quick = heading.createEl("button", { cls: "clickable-icon bookkeeping-panel-quick-action", attr: { "aria-label": chart.kind === "budget" ? "修改预算" : "管理账户与月初余额" } });
      setIcon(quick, "pencil");
      quick.addEventListener("click", () => {
        if (chart.kind === "budget") new BudgetEditorModal(this.app, this.plugin, () => this.render()).open();
        else void this.plugin.store.list().then((all) => new OpeningBalanceModal(this.app, this.plugin, this.month, all, async () => this.render()).open());
      });
    }
    const button = heading.createEl("button", { cls: "clickable-icon bookkeeping-panel-menu", attr: { "aria-label": `配置${chart.title}` } });
    setIcon(button, "ellipsis");
    button.addEventListener("click", (event) => this.openChartMenu(event, chart));
    return panel.createDiv({ cls: "bookkeeping-panel-body" });
  }

  private openChartMenu(event: MouseEvent, chart: DashboardChartConfig): void {
    const menu = new Menu();
    menu.addItem((item) => item.setTitle(this.plugin.t("配置图表")).setIcon("settings-2").onClick(() => {
      new ChartSettingsModal(this.app, this.plugin, chart, async () => this.render()).open();
    }));
    menu.addItem((item) => item.setTitle(this.plugin.t("复制图表")).setIcon("copy").onClick(() => { void (async () => {
      const index = this.plugin.settings.chartConfigs.findIndex((item) => item.id === chart.id);
      const copy: DashboardChartConfig = { ...chart, id: `chart-${Date.now()}`, title: `${chart.title}副本` };
      this.plugin.settings.chartConfigs.splice(index + 1, 0, copy);
      await this.plugin.saveSettings();
    })(); }));
    menu.addItem((item) => item.setTitle(this.plugin.t(chart.width === "full" ? "改为半宽" : "改为通栏")).setIcon("columns-2").onClick(() => { void (async () => {
      chart.width = chart.width === "full" ? "half" : "full";
      await this.plugin.saveSettings();
    })(); }));
    menu.addSeparator();
    menu.addItem((item) => item.setTitle(this.plugin.t("隐藏图表")).setIcon("eye-off").onClick(() => { void (async () => {
      chart.visible = false;
      await this.plugin.saveSettings();
      this.plugin.notice(`已隐藏“${chart.title}”`);
    })(); }));
    menu.addItem((item) => item.setTitle(this.plugin.t("删除图表")).setIcon("trash-2").onClick(() => { void (async () => {
      this.plugin.settings.chartConfigs = this.plugin.settings.chartConfigs.filter((item) => item.id !== chart.id);
      await this.plugin.saveSettings();
      this.plugin.notice(`已删除图表“${chart.title}”`);
    })(); }));
    menu.showAtMouseEvent(event);
  }

  private async moveChart(sourceId: string, targetId: string): Promise<void> {
    const charts = [...this.plugin.settings.chartConfigs];
    const source = charts.findIndex((item) => item.id === sourceId);
    const target = charts.findIndex((item) => item.id === targetId);
    if (source < 0 || target < 0) return;
    const [moved] = charts.splice(source, 1);
    if (!moved) return;
    charts.splice(target, 0, moved);
    this.plugin.settings.chartConfigs = charts;
    await this.plugin.saveSettings();
  }

  private renderTrend(parent: HTMLElement, config: DashboardChartConfig, monthItems: Transaction[], all: Transaction[]): void {
    const metric = config.metric as TrendMetric;
    const values = this.trendValues(metric, monthItems, all);
    if (!values.some((value) => value !== 0)) {
      parent.createDiv({ cls: "bookkeeping-empty", text: "没有符合条件的账目" });
      return;
    }
    const width = 600;
    const height = 250;
    const paddingLeft = 64;
    const paddingRight = 12;
    const paddingTop = 6;
    const paddingBottom = 6;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const baselineValue = 0;
    let step: number;
    let axisMin: number;
    let axisMax: number;
    if (metric === "expense" || metric === "income") {
      step = this.positiveTrendStep(Math.max(max, 1));
      axisMin = 0;
      axisMax = step * 5;
    } else {
      const scaleMin = Math.min(min, 0);
      const scaleMax = Math.max(max, 0);
      step = this.niceAxisStep(Math.max(scaleMax - scaleMin, 1) / 5);
      let lower = 0;
      let upper = 0;
      for (let attempt = 0; attempt < 12; attempt++) {
        lower = Math.ceil(scaleMax / step - 5);
        upper = Math.floor(scaleMin / step);
        if (lower <= upper) break;
        step = this.nextNiceAxisStep(step);
      }
      const idealStart = (scaleMin + scaleMax) / 2 / step - 2.5;
      const startIndex = Math.max(lower, Math.min(upper, Math.round(idealStart)));
      axisMin = startIndex * step;
      axisMax = axisMin + step * 5;
    }
    const span = Math.max(axisMax - axisMin, step);
    const y = (value: number): number => paddingTop + (axisMax - value) / span * (height - paddingTop - paddingBottom);
    const x = (index: number): number => paddingLeft + index / Math.max(values.length - 1, 1) * (width - paddingLeft - paddingRight);
    const zeroY = y(baselineValue);
    const svg = createSvg("svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("class", "bookkeeping-trend-svg");

    const axisUsesWan = Math.max(Math.abs(axisMin), Math.abs(axisMax)) >= 10000;
    for (let index = 0; index < 6; index++) {
      const value = roundMoney(axisMax - step * index);
      const tickY = y(value);
      const gridLine = svg.createSvg("line");
      gridLine.setAttribute("x1", String(paddingLeft));
      gridLine.setAttribute("x2", String(width - paddingRight));
      gridLine.setAttribute("y1", String(tickY));
      gridLine.setAttribute("y2", String(tickY));
      gridLine.setAttribute("class", "bookkeeping-chart-gridline");
      svg.appendChild(gridLine);
      const label = svg.createSvg("text");
      label.setAttribute("x", String(paddingLeft - 7));
      label.setAttribute("y", String(tickY + 3));
      label.setAttribute("text-anchor", "end");
      label.setAttribute("class", "bookkeeping-chart-y-label");
      label.textContent = this.formatCompactMoney(value, axisUsesWan);
      svg.appendChild(label);
    }
    const baseline = svg.createSvg("line");
    baseline.setAttribute("x1", String(paddingLeft));
    baseline.setAttribute("x2", String(width - paddingRight));
    baseline.setAttribute("y1", String(zeroY));
    baseline.setAttribute("y2", String(zeroY));
    baseline.setAttribute("class", "bookkeeping-chart-zero-axis");
    svg.appendChild(baseline);
    if (config.chartType === "bar") {
      const barWidth = Math.max((width - paddingLeft - paddingRight) / values.length * 0.62, 2);
      values.forEach((value, index) => {
        const rect = svg.createSvg("rect");
        const valueY = y(value);
        rect.setAttribute("x", String(x(index) - barWidth / 2));
        rect.setAttribute("y", String(Math.min(valueY, zeroY)));
        rect.setAttribute("width", String(barWidth));
        rect.setAttribute("height", String(Math.max(Math.abs(zeroY - valueY), 1)));
        rect.setAttribute("class", `bookkeeping-chart-bar ${this.trendTone(metric, value)}`);
        const title = svg.createSvg("title");
        title.textContent = `${this.displayDate(`${this.month}-${String(index + 1).padStart(2, "0")}`)}：${this.money(value)}`;
        rect.appendChild(title);
        svg.appendChild(rect);
      });
    } else {
      const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
      if (config.chartType === "area") {
        const area = svg.createSvg("polygon");
        area.setAttribute("points", `${x(0)},${zeroY} ${points} ${x(values.length - 1)},${zeroY}`);
        area.setAttribute("class", `bookkeeping-trend-area ${this.seriesTone(metric)}`);
        svg.appendChild(area);
      }
      const line = svg.createSvg("polyline");
      line.setAttribute("points", points);
      line.setAttribute("class", `bookkeeping-trend-line ${this.seriesTone(metric)}`);
      svg.appendChild(line);
      values.forEach((value, index) => {
        const point = svg.createSvg("circle");
        point.setAttribute("cx", String(x(index)));
        point.setAttribute("cy", String(y(value)));
        point.setAttribute("r", "2.4");
        point.setAttribute("class", `bookkeeping-trend-point ${this.trendTone(metric, value)}`);
        const title = svg.createSvg("title");
        title.textContent = `${this.displayDate(`${this.month}-${String(index + 1).padStart(2, "0")}`)}：${this.money(value)}`;
        point.appendChild(title);
        svg.appendChild(point);
      });
    }
    parent.appendChild(svg);
    const axis = parent.createDiv({ cls: "bookkeeping-trend-axis bookkeeping-trend-dates" });
    [1, 8, 15, 22, 29].filter((day) => day <= values.length).forEach((day) => {
      const label = axis.createSpan({ text: `${this.month.slice(5)}-${String(day).padStart(2, "0")}` });
      label.setCssStyles({ left: `${x(day - 1) / width * 100}%` });
    });
    parent.createDiv({ cls: "bookkeeping-trend-range", text: `${this.trendMetricLabel(metric)}范围：${this.money(min)}～${this.money(max)}`, attr: { title: `${min}～${max}` } });
  }

  private trendValues(metric: TrendMetric, monthItems: Transaction[], all: Transaction[]): number[] {
    const cacheKey = `${this.month}|${metric}|${monthItems.map((item) => item.id).join(",")}|${metric === "balance" ? all.length : 0}`;
    const cached = this.trendCache.get(cacheKey);
    if (cached) return [...cached];
    const [yearText = "2000", monthText = "01"] = this.month.split("-");
    const days = new Date(Number(yearText), Number(monthText), 0).getDate();
    const daily = Array.from({ length: days }, () => ({ income: 0, expense: 0 }));
    for (const item of monthItems) {
      const index = Number(item.date.slice(8, 10)) - 1;
      const bucket = daily[index];
      if (!bucket) continue;
      if (this.typeEffect(item) === "positive") bucket.income += item.amount;
      else if (this.typeEffect(item) === "negative") bucket.expense += item.amount;
    }
    if (metric === "expense") return this.cacheTrend(cacheKey, daily.map((item) => roundMoney(item.expense)));
    if (metric === "income") return this.cacheTrend(cacheKey, daily.map((item) => roundMoney(item.income)));
    if (metric === "net") return this.cacheTrend(cacheKey, daily.map((item) => roundMoney(item.income - item.expense)));

    let balance = this.balanceOpening(all);
    return this.cacheTrend(cacheKey, daily.map((item) => {
      balance += item.income - item.expense;
      return roundMoney(balance);
    }));
  }

  private cacheTrend(key: string, values: number[]): number[] {
    this.trendCache.set(key, values);
    return [...values];
  }

  private balanceOpening(all: Transaction[]): number {
    if (this.plugin.settings.enableAccount) {
      const opening = this.plugin.store.accountMonthlyBalances(all, this.month).opening;
      const selected = new Set(this.filters.accounts);
      return roundMoney([...opening].filter(([name]) => !selected.size || selected.has(name)).reduce((sum, [, value]) => sum + value, 0));
    }
    return roundMoney(all.filter((item) => item.date < `${this.month}-01` && this.typeEffect(item) !== "neutral")
      .reduce((sum, item) => sum + this.signedAmount(item), 0));
  }

  private positiveTrendStep(maximum: number): number {
    const raw = maximum / 4.5;
    const exponent = Math.floor(Math.log10(Math.max(raw, Number.EPSILON)));
    const base = 10 ** exponent;
    const candidates = [1, 1.2, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((value) => value * base);
    return candidates.filter((value) => maximum > value * 4 && maximum < value * 5)
      .sort((a, b) => Math.abs(maximum / a - 4.5) - Math.abs(maximum / b - 4.5))[0] ?? raw;
  }

  private renderCalendar(parent: HTMLElement, metric: CalendarMetric, items: Transaction[]): void {
    const values = this.trendValues(metric, items, []);
    const daysWithData = new Set(items.filter((item) => this.typeEffect(item) !== "neutral").map((item) => Number(item.date.slice(8, 10))));
    const [yearText = "2000", monthText = "01"] = this.month.split("-");
    const weekStarts = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
    const startIndex = Math.max(0, weekStarts.indexOf(this.plugin.settings.calendarWeekStart));
    const nativeWeekday = new Date(Number(yearText), Number(monthText) - 1, 1).getDay();
    const firstWeekday = (nativeWeekday - startIndex + 7) % 7;
    const naturalWeeks = Math.ceil((firstWeekday + values.length) / 7);
    const calendar = parent.createDiv({ cls: `bookkeeping-calendar bookkeeping-calendar-weeks-${naturalWeeks}` });
    const weekdays = formatWeekdayLabels(this.plugin.settings.language);
    for (let offset = 0; offset < 7; offset++) calendar.createDiv({ cls: "bookkeeping-calendar-weekday", text: weekdays[(startIndex + offset) % 7] });
    const visibleWeeks = naturalWeeks === 6 ? 5 : naturalWeeks;
    const cells = new Array<number | null>(visibleWeeks * 7).fill(null);
    for (let day = 1; day <= values.length; day++) {
      let position = firstWeekday + day - 1;
      if (naturalWeeks === 6 && position >= 35) position -= 35;
      cells[position] = day;
    }
    for (const day of cells) {
      if (day === null) {
        calendar.createDiv({ cls: "bookkeeping-calendar-empty" });
        continue;
      }
      const rawValue = values[day - 1] ?? 0;
      const value = metric === "expense" ? -rawValue : rawValue;
      const hasData = daysWithData.has(day);
      const state = value > 0 ? " is-positive" : value < 0 ? " is-negative" : hasData ? " is-zero-with-data" : " is-no-data";
      const cell = calendar.createDiv({ cls: `bookkeeping-calendar-day${state}` });
      const isoDate = `${this.month}-${String(day).padStart(2, "0")}`;
      cell.setAttribute("role", "button");
      cell.setAttribute("tabindex", "0");
      cell.setAttribute("aria-label", `${this.displayDate(isoDate)}账目筛选`);
      cell.addEventListener("click", () => this.toggleCalendarDateFilter(isoDate));
      cell.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        this.toggleCalendarDateFilter(isoDate);
      });
      cell.createSpan({ cls: "bookkeeping-calendar-date", text: String(day) });
      const formatted = this.formatCalendarAmount(value);
      if (formatted.hasUnit) cell.addClass("has-unit");
      cell.createSpan({ cls: "bookkeeping-calendar-value", text: value === 0 ? (hasData ? "0" : "—") : formatted.text });
      cell.setAttribute("title", `${this.displayDate(isoDate)}：${this.money(value)}`);
    }
    const legend = parent.createDiv({ cls: "bookkeeping-calendar-legend" });
    legend.createSpan({ text: "支出", cls: "is-negative" });
    const monthIncome = items.filter((item) => this.typeEffect(item) === "positive").reduce((sum, item) => sum + item.amount, 0);
    const monthExpense = items.filter((item) => this.typeEffect(item) === "negative").reduce((sum, item) => sum + item.amount, 0);
    const monthBalance = roundMoney(monthIncome - monthExpense);
    const summary = legend.createSpan({ cls: "bookkeeping-calendar-month-balance" });
    summary.createSpan({ text: `${Number(this.month.slice(5))}月结余：` });
    summary.createEl("strong", { text: this.money(monthBalance), cls: monthBalance > 0 ? "is-positive" : monthBalance < 0 ? "is-negative" : "is-zero" });
    legend.createSpan({ text: "收入", cls: "is-positive" });
  }

  private renderPie(parent: HTMLElement, metric: PieMetric, items: Transaction[], all: Transaction[]): void {
    const entries = this.pieEntries(metric, items, all).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    if (!entries.length || total <= 0) {
      parent.createDiv({ cls: "bookkeeping-empty", text: "没有符合条件的账目" });
      return;
    }
    const layout = parent.createDiv({ cls: "bookkeeping-pie-layout" });
    const donut = layout.createDiv({ cls: "bookkeeping-donut" });
    let cursor = 0;
    const slices = entries.map(([name, value], index) => {
      const start = cursor;
      cursor += value / total * 100;
      return `${this.pieColor(metric, name, index)} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
    donut.setCssStyles({ background: `conic-gradient(${slices.join(",")})` });
    const center = donut.createDiv({ cls: "bookkeeping-donut-center" });
    center.createSpan({ text: "合计" });
    center.createEl("strong", { text: this.money(total), attr: { title: String(total) } });
    const legend = layout.createDiv({ cls: "bookkeeping-pie-legend" });
    entries.forEach(([name, value], index) => {
      const percent = value / total * 100;
      const fullText = `${name}：${this.money(value)} ${percent.toFixed(1)}%`;
      const row = legend.createDiv({ cls: "bookkeeping-legend-row", attr: { title: fullText } });
      const label = row.createDiv({ cls: "bookkeeping-legend-label" });
      const dot = label.createSpan({ cls: "bookkeeping-legend-dot" });
      dot.setCssStyles({ backgroundColor: this.pieColor(metric, name, index) });
      label.createSpan({ text: `${name}：${this.money(value)}` });
      row.createSpan({ text: `${percent.toFixed(1)}%`, cls: "bookkeeping-legend-percent" });
    });
  }

  private pieEntries(metric: PieMetric, items: Transaction[], all: Transaction[]): Array<[string, number]> {
    if (metric === "accountBalance") {
      const selected = new Set(this.filters.accounts);
      return [...this.plugin.store.accountMonthlyBalances(all, this.month).closing]
        .filter(([account]) => !selected.size || selected.has(account));
    }
    const grouped = new Map<string, number>();
    const desiredEffect = metric === "incomeCategory" || metric === "accountIncome" ? "positive" : "negative";
    for (const item of items) {
      if (this.typeEffect(item) !== desiredEffect) continue;
      const key = metric === "necessityExpense" ? (this.plugin.settings.necessityLabels[item.necessity] ?? item.necessity)
        : metric === "accountExpense" || metric === "accountIncome" ? (item.account || "未设置账户")
        : (item.category || "未分类");
      grouped.set(key, roundMoney((grouped.get(key) ?? 0) + item.amount));
    }
    return [...grouped];
  }

  private renderTagSummary(parent: HTMLElement, config: DashboardChartConfig, items: Transaction[]): void {
    const metric = config.metric as TagMetric;
    const grouped = new Map<string, number>();
    for (const item of items) {
      const tags = this.customTags(item);
      for (const tag of tags) if (!grouped.has(tag)) grouped.set(tag, 0);
      if ((metric === "expense" && this.typeEffect(item) !== "negative") || (metric === "income" && this.typeEffect(item) !== "positive") || (metric === "net" && this.typeEffect(item) === "neutral")) continue;
      for (const tag of tags) {
        const value = metric === "count" ? 1 : metric === "net" ? this.signedAmount(item) : item.amount;
        grouped.set(tag, roundMoney((grouped.get(tag) ?? 0) + value));
      }
    }
    const tagSort = config.tagSort ?? "amountDesc";
    const entries = [...grouped].sort((a, b) => {
      if (tagSort === "nameAsc" || tagSort === "nameDesc") return a[0].localeCompare(b[0], "zh-CN-u-co-pinyin", { numeric: true }) * (tagSort === "nameAsc" ? 1 : -1);
      const result = (metric === "net" ? Math.abs(a[1]) - Math.abs(b[1]) : a[1] - b[1]);
      return result * (tagSort === "amountAsc" ? 1 : -1);
    });
    if (!entries.length) {
      parent.createDiv({ cls: "bookkeeping-empty", text: "没有符合条件的账目" });
      return;
    }
    const max = Math.max(...entries.map(([, value]) => Math.abs(value)), 1);
    const list = parent.createDiv({ cls: "bookkeeping-tag-summary-list" });
    for (const [tag, value] of entries) {
      const row = list.createEl("button", { cls: "bookkeeping-tag-summary-row", attr: { title: `筛选#${tag}` } });
      const label = row.createDiv({ cls: "bookkeeping-bar-label" });
      label.createSpan({ text: `#${tag}`, cls: "bookkeeping-user-text" });
      label.createSpan({
        text: metric === "count" ? `${value}笔` : this.money(value),
        cls: metric === "net" ? (value >= 0 ? "is-positive" : "is-negative") : metric === "income" ? "is-positive" : metric === "expense" ? "is-negative" : ""
      });
      const track = row.createDiv({ cls: "bookkeeping-progress" });
      const tone = metric === "income" || (metric === "net" && value >= 0) ? " is-positive" : metric === "expense" || (metric === "net" && value < 0) ? " is-negative" : "";
      const fill = track.createDiv({ cls: `bookkeeping-progress-fill${tone}` });
      fill.toggleClass("is-zero", Math.abs(value) < 0.005);
      fill.setCssStyles({ width: `${Math.abs(value) / max * 100}%` });
      row.dataset.tagSummary = tag;
      row.addEventListener("click", () => {
        this.preferredScrollAnchor = `[data-tag-summary="${CSS.escape(tag)}"]`;
        this.toggleTagFilter(tag);
        void this.render();
      });
    }
  }

  private renderBudgets(parent: HTMLElement, byCategory: Map<string, number>, total: number): void {
    const budgets = Object.entries(this.plugin.settings.monthlyBudgets).filter(([, amount]) => amount > 0);
    if (!budgets.length) {
      parent.createDiv({ cls: "bookkeeping-empty", text: "尚未设置预算" });
      return;
    }
    for (const [category, budget] of budgets) {
      const spent = category === "总预算" ? total : (byCategory.get(category) ?? 0);
      const percent = spent / budget * 100;
      const row = parent.createDiv({ cls: "bookkeeping-budget-row", attr: { title: `${category}：${spent}/${budget}` } });
      const label = row.createDiv({ cls: "bookkeeping-bar-label" });
      label.createSpan({ text: category });
      label.createSpan({ text: `${this.money(spent)}/${this.money(budget)}` });
      const track = row.createDiv({ cls: "bookkeeping-progress" });
      const fill = track.createDiv({ cls: `bookkeeping-progress-fill${percent > 100 ? " is-over" : ""}` });
      fill.setCssStyles({ width: `${Math.min(percent, 100)}%` });
      row.createDiv({ cls: `bookkeeping-budget-hint${percent > 100 ? " is-over" : ""}`, text: percent > 100 ? `超支${this.money(spent - budget)}` : `已用${percent.toFixed(0)}%` });
    }
  }

  private renderAccounts(parent: HTMLElement, all: Transaction[]): void {
    const { opening, closing } = this.plugin.store.accountMonthlyBalances(all, this.month);
    const selected = new Set(this.filters.accounts);
    for (const [account, balance] of [...closing].filter(([name]) => !selected.size || selected.has(name))) {
      const start = opening.get(account) ?? 0;
      const row = parent.createEl("button", { cls: "bookkeeping-account-row", attr: { type: "button", title: `筛选账户“${account}”` } });
      row.createSpan({ text: account });
      const values = row.createDiv({ cls: "bookkeeping-account-values" });
      values.createSpan({ text: `月初${this.money(start)}` });
      values.createEl("strong", { text: `月末${this.money(balance)}`, cls: balance < 0 ? "is-negative" : "" });
      row.addEventListener("click", () => {
        this.toggleAccountFilter(account);
        void this.render();
      });
    }
    if (![...closing.keys()].some((name) => !selected.size || selected.has(name))) parent.createDiv({ cls: "bookkeeping-empty", text: "没有符合条件的账目" });
  }

  private renderFilters(content: HTMLElement, monthItems: Transaction[], tags: string[]): void {
    const section = content.createDiv({ cls: "bookkeeping-transactions-heading" });
    const title = section.createDiv({ cls: "bookkeeping-transactions-title" });
    title.createEl("h3", { text: "账目明细" });
    const secondaryLabel = this.sortColumn ? `${this.plugin.settings.tableColumnLabels[this.sortColumn]}${this.sortDirection === "asc" ? "正序" : "倒序"}` : `时间${this.dateSortDirection === "asc" ? "正序" : "倒序"}`;
    const primaryLabel = this.dateSortLocked
      ? `日期${this.dateSortDirection === "asc" ? "正序" : "倒序"}已锁定`
      : `时刻${this.dateSortDirection === "asc" ? "正序" : "倒序"}已解锁`;
    const sortText = `${primaryLabel}${this.sortColumn ? `；${secondaryLabel}` : ""}`;
    title.createDiv({ cls: "bookkeeping-table-sort-hint", text: sortText });
    const filters = section.createDiv({ cls: "bookkeeping-filters" });
    const search = filters.createEl("input", { cls: "bookkeeping-search-input", type: "search", placeholder: "搜索内容、备注或标签", value: this.filters.keyword });
    search.addEventListener("input", () => {
      this.filters.keyword = search.value;
      window.clearTimeout(Number(search.dataset.timer ?? 0));
      search.dataset.timer = String(window.setTimeout(() => { void this.render(); }, 180));
    });
    const hasFilters = this.hasActiveFilters();
    if (hasFilters) {
      const clear = filters.createEl("button", { cls: "bookkeeping-filter-clear mod-warning", text: "清空筛选", attr: { type: "button" } });
      clear.addEventListener("click", () => {
        this.filters = emptyDashboardFilters();
        void this.render();
      });
    }
    const advanced = filters.createEl("button", { cls: `bookkeeping-filter-toggle${hasFilters ? " is-active" : ""}`, attr: { title: "筛选账目", "aria-label": "筛选账目" } });
    const filterIcon = advanced.createSpan();
    setIcon(filterIcon, "list-filter");
    advanced.createSpan({ text: "筛选" });
    advanced.addEventListener("click", () => {
      this.preferredScrollAnchor = ".bookkeeping-filter-toggle";
      this.showAdvancedFilters = !this.showAdvancedFilters;
      void this.render();
    });
    if (this.showAdvancedFilters) {
      const panel = section.createDiv({ cls: "bookkeeping-advanced-filters" });
      const basics = panel.createDiv({ cls: "bookkeeping-filter-group" });
      basics.createEl("h4", { text: "基础筛选" });
      const basicGrid = basics.createDiv({ cls: "bookkeeping-filter-grid" });
      const typeOptions = [...new Set(this.applyFilters(monthItems, "types").map((item) => item.type))];
      const necessityOptions = [...new Set(this.applyFilters(monthItems, "necessities").filter((item) => item.type !== "转账").map((item) => item.necessity))];
      const categoryOptions = [...new Set(this.applyFilters(monthItems, "categories").filter((item) => item.type !== "转账").map((item) => item.category || "未分类"))];
      const accountOptions = [...new Set(this.applyFilters(monthItems, "accounts").flatMap((item) => [item.account, item.targetAccount]).filter(Boolean))];
      const tagOptions = this.collectTags(this.applyFilters(monthItems, "tags"));
      this.renderMultiFilter(basicGrid, "types", "类型", typeOptions, this.filters.types, (values) => this.filters.types = values, (value) => this.plugin.settings.typeLabels[value] ?? value);
      this.renderMultiFilter(basicGrid, "necessities", "必要性", necessityOptions, this.filters.necessities, (values) => this.filters.necessities = values, (value) => this.plugin.settings.necessityLabels[value] ?? value);
      if (this.isTableColumnVisible("category")) this.renderMultiFilter(basicGrid, "categories", "分类", categoryOptions, this.filters.categories, (values) => this.filters.categories = values);
      if (this.isTableColumnVisible("account")) this.renderMultiFilter(basicGrid, "accounts", "账户", accountOptions, this.filters.accounts, (values) => this.filters.accounts = values);
      this.renderMultiFilter(basicGrid, "tags", "标签", tagOptions.length ? tagOptions : tags, this.selectedFilterTags(), (values) => this.filters.tags = values.join(" "));
      const crossMonth = basics.createDiv({
        cls: "bookkeeping-cross-month-filter bookkeeping-cross-month-filter-main",
        attr: { role: "checkbox", tabindex: "0", "aria-checked": String(this.filters.crossMonth) }
      });
      const crossMonthCheckbox = crossMonth.createEl("input", { type: "checkbox" });
      crossMonthCheckbox.checked = this.filters.crossMonth;
      crossMonthCheckbox.tabIndex = -1;
      crossMonth.createSpan({ text: "跨月筛选全部账目" });
      const toggleCrossMonth = (): void => {
        this.filters.crossMonth = !this.filters.crossMonth;
        void this.render();
      };
      crossMonth.addEventListener("click", (event) => {
        event.preventDefault();
        toggleCrossMonth();
      });
      crossMonth.addEventListener("keydown", (event) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        toggleCrossMonth();
      });

      const ranges = panel.createDiv({ cls: "bookkeeping-filter-group" });
      ranges.createEl("h4", { text: "范围筛选" });
      const rangeGrid = ranges.createDiv({ cls: "bookkeeping-filter-grid bookkeeping-filter-range-grid" });
      const amountPair = rangeGrid.createDiv({ cls: "bookkeeping-filter-pair" });
      amountPair.createSpan({ text: "金额范围" });
      const amountInputs = amountPair.createDiv();
      this.filterAmountInput(amountInputs, "最小金额（含）", this.filters.amountMin, "min");
      amountInputs.createSpan({ cls: "bookkeeping-filter-range-separator", attr: { "aria-hidden": "true" } });
      this.filterAmountInput(amountInputs, "最大金额（含）", this.filters.amountMax, "max");
      const datePair = rangeGrid.createDiv({ cls: "bookkeeping-filter-pair" });
      datePair.createSpan({ text: "日期范围" });
      const dateInputs = datePair.createDiv();
      this.filterDateInput(dateInputs, "起始日期（含）", this.filters.dateFrom, "from");
      dateInputs.createSpan({ cls: "bookkeeping-filter-range-separator", attr: { "aria-hidden": "true" } });
      this.filterDateInput(dateInputs, "结束日期（含）", this.filters.dateTo, "to");
    }
  }

  private renderMultiFilter(parent: HTMLElement, key: "types" | "necessities" | "categories" | "accounts" | "tags", label: string, rawOptions: string[], selected: string[], onChange: (values: string[]) => void, displayOption: (value: string) => string = (value) => value): void {
    const field = parent.createDiv({ cls: "bookkeeping-filter-field bookkeeping-value-filter-field" });
    field.createSpan({ text: label });
    const details = field.createEl("details", { cls: "bookkeeping-multi-filter" });
    details.open = this.openMultiFilter === key;
    const summary = details.createEl("summary");
    const summaryValue = summary.createSpan({ cls: "bookkeeping-multi-filter-summary", attr: key === "tags" ? {} : { title: selected.map(displayOption).join("、") } });
    const renderSummaryValue = (compact = false): void => {
      summaryValue.empty();
      if (key !== "tags" || !selected.length) {
        summaryValue.setText(compact ? `${displayOption(selected[0] ?? "")}…[共${selected.length}项]` : this.multiFilterSummary(label, selected.map(displayOption)));
        return;
      }
      const values = compact ? selected.slice(0, 1) : selected;
      values.forEach((value, index) => {
        if (index) summaryValue.createSpan({ text: "、" });
        summaryValue.createSpan({ text: displayOption(value), cls: "bookkeeping-user-text" });
      });
      if (compact) summaryValue.createSpan({ text: `…[共${selected.length}项]` });
    };
    renderSummaryValue();
    if (selected.length > 1) window.requestAnimationFrame(() => {
      if (summaryValue.scrollWidth > summaryValue.clientWidth) renderSummaryValue(true);
    });
    const body = details.createDiv({ cls: "bookkeeping-multi-filter-panel" });
    const searchWrap = body.createDiv({ cls: "bookkeeping-filter-search-wrap" });
    const searchIcon = searchWrap.createSpan();
    setIcon(searchIcon, "search");
    const search = searchWrap.createEl("input", { type: "search", value: this.multiFilterSearch[key], attr: { placeholder: "可使用空格分隔多个关键词", "aria-label": `搜索${label}` } });
    const choices = body.createDiv({ cls: "bookkeeping-multi-filter-choices" });
    const options = [...new Set(rawOptions)].sort((a, b) => a.localeCompare(b, "zh-CN-u-co-pinyin", { numeric: true }));
    const draft = new Set(selected.length ? selected.filter((item) => options.includes(item)) : options);
    const rows: HTMLElement[] = [];
    const allRow = choices.createEl("label", { cls: "bookkeeping-multi-filter-option bookkeeping-filter-select-all" });
    const allCheckbox = allRow.createEl("input", { type: "checkbox" });
    allRow.createSpan({ text: "全选" });
    const checkboxes = new Map<string, HTMLInputElement>();
    for (const option of options) {
      const row = choices.createEl("label", { cls: "bookkeeping-multi-filter-option", attr: { title: option } });
      row.dataset.search = `${option} ${displayOption(option)}`.toLocaleLowerCase("zh-CN");
      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = draft.has(option);
      row.createSpan({ text: key === "tags" ? `#${option}` : displayOption(option), cls: key === "tags" ? "bookkeeping-user-text" : "" });
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) draft.add(option);
        else draft.delete(option);
        refreshAll();
      });
      checkboxes.set(option, checkbox);
      rows.push(row);
    }
    if (!options.length) choices.createSpan({ text: `当前月份没有可选${label}`, cls: "bookkeeping-empty-value" });
    const refreshAll = (): void => {
      allCheckbox.checked = options.length > 0 && draft.size === options.length;
      allCheckbox.indeterminate = draft.size > 0 && draft.size < options.length;
    };
    allCheckbox.addEventListener("change", () => {
      draft.clear();
      if (allCheckbox.checked) options.forEach((option) => draft.add(option));
      checkboxes.forEach((checkbox, option) => checkbox.checked = draft.has(option));
      refreshAll();
    });
    refreshAll();
    const applySearch = (): void => {
      const terms = search.value.trim().toLocaleLowerCase("zh-CN").split(/\s+/).filter(Boolean);
      rows.forEach((row) => row.toggleClass("is-filtered-out", Boolean(terms.length && !terms.some((term) => row.dataset.search?.includes(term)))));
    };
    search.addEventListener("input", () => { this.multiFilterSearch[key] = search.value; applySearch(); });
    search.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const terms = search.value.split(/\s+/).map((term) => term.replace(/^#/, "").trim()).filter(Boolean);
      const matches = options.filter((option) => terms.some((term) => option.toLocaleLowerCase("zh-CN") === term.toLocaleLowerCase("zh-CN")));
      if (!matches.length) return;
      event.preventDefault();
      matches.forEach((match) => draft.add(match));
      checkboxes.forEach((checkbox, option) => checkbox.checked = draft.has(option));
      refreshAll();
    });
    applySearch();
    const actions = body.createDiv({ cls: "bookkeeping-filter-panel-actions" });
    const clear = actions.createEl("button", { text: "清除筛选", cls: "mod-warning", attr: { type: "button" } });
    clear.addEventListener("click", () => {
      draft.clear();
      options.forEach((option) => draft.add(option));
      checkboxes.forEach((checkbox) => checkbox.checked = true);
      refreshAll();
    });
    const cancel = actions.createEl("button", { text: "取消", attr: { type: "button" } });
    cancel.addEventListener("click", () => { details.open = false; });
    const confirm = actions.createEl("button", { text: "确认", cls: "mod-cta", attr: { type: "button" } });
    confirm.addEventListener("click", () => {
      if (options.length && !draft.size) {
        this.plugin.notice(`请至少选择一个${label}，或点击“清除筛选”`);
        return;
      }
      onChange(draft.size === options.length ? [] : [...draft]);
      this.openMultiFilter = null;
      void this.render();
    });
    details.addEventListener("toggle", () => {
      if (details.open) {
        field.closest(".bookkeeping-filter-grid")?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((other) => {
          if (other !== details) other.removeAttribute("open");
        });
        this.openMultiFilter = key;
      } else if (this.openMultiFilter === key) {
        this.openMultiFilter = null;
      }
    });
  }

  private multiFilterSummary(label: string, selected: string[]): string {
    if (!selected.length) return `全部${label}`;
    return selected.join("、");
  }

  private filterAmountInput(parent: HTMLElement, placeholder: string, value: string, edge: "min" | "max"): void {
    const control = parent.createDiv({ cls: "bookkeeping-range-control" });
    control.createSpan({ text: placeholder, cls: "bookkeeping-range-control-label" });
    const wrap = control.createDiv({ cls: "bookkeeping-money-filter-input bookkeeping-range-input-wrap" });
    wrap.createSpan({ text: this.plugin.settings.currency, cls: "bookkeeping-money-prefix" });
    const input = wrap.createEl("input", { type: "text", value, attr: { "aria-label": placeholder, inputmode: "decimal" } });
    const clear = wrap.createEl("button", { cls: "clickable-icon bookkeeping-range-clear", attr: { type: "button", "aria-label": `清空${placeholder}`, title: `清空${placeholder}` } });
    setIcon(clear, "delete");
    clear.addEventListener("click", () => {
      if (edge === "min") this.filters.amountMin = "";
      else this.filters.amountMax = "";
      void this.render();
    });
    input.addEventListener("change", () => {
      const next = input.value.trim();
      if (next && !/^\d+(?:\.\d{1,2})?$/.test(next)) {
        input.value = value;
        this.plugin.notice("金额只能输入非负数字，且最多保留两位小数");
        return;
      }
      const other = edge === "min" ? this.filters.amountMax : this.filters.amountMin;
      if (next && other && (edge === "min" ? Number(next) > Number(other) : Number(next) < Number(other))) {
        input.value = value;
        this.plugin.notice("最大金额必须大于或等于最小金额");
        return;
      }
      if (edge === "min") this.filters.amountMin = next;
      else this.filters.amountMax = next;
      void this.render();
    });
  }

  private filterDateInput(parent: HTMLElement, placeholder: string, value: string, edge: "from" | "to"): void {
    const control = parent.createDiv({ cls: "bookkeeping-range-control" });
    control.createSpan({ text: placeholder, cls: "bookkeeping-range-control-label" });
    const wrap = control.createDiv({ cls: "bookkeeping-range-input-wrap" });
    const input = wrap.createEl("input", { type: "text", value, placeholder: "YYYY-MM-DD", attr: { "aria-label": placeholder, inputmode: "numeric", autocomplete: "off" } });
    const clear = wrap.createEl("button", { cls: "clickable-icon bookkeeping-range-clear", attr: { type: "button", "aria-label": `清空${placeholder}`, title: `清空${placeholder}` } });
    setIcon(clear, "delete");
    input.addEventListener("beforeinput", (event) => {
      if (!event.data || !/^\d+$/.test(event.data)) return;
      if (input.value.includes("-") && input.value.length === 10 && input.selectionStart === input.selectionEnd) input.value = "";
    });
    input.addEventListener("input", () => {
      if (!/^\d[\d-]*$/.test(input.value)) return;
      const next = normalizeTypedDateInput(input.value);
      if (next === input.value) return;
      input.value = next;
      input.setSelectionRange(next.length, next.length);
    });
    clear.addEventListener("click", () => {
      if (edge === "from") this.filters.dateFrom = "";
      else this.filters.dateTo = "";
      void this.render();
    });
    input.addEventListener("change", () => {
      input.value = completeTypedDateInput(input.value);
      const normalizedDate = input.value ? normalizeDate(input.value) : null;
      if (input.value && !normalizedDate) {
        input.value = value;
        this.plugin.notice("请输入有效日期，例如 2026-08-16");
        return;
      }
      const normalized = normalizedDate ?? "";
      input.value = normalized;
      const other = edge === "from" ? this.filters.dateTo : this.filters.dateFrom;
      if (normalized && other && (edge === "from" ? normalized > other : normalized < other)) {
        input.value = value;
        this.plugin.notice("结束日期必须大于或等于开始日期");
        return;
      }
      if (edge === "from") this.filters.dateFrom = normalized;
      else this.filters.dateTo = normalized;
      void this.render();
    });
  }

  private hasActiveFilters(): boolean {
    return this.filters.types.length > 0 || this.filters.necessities.length > 0 || this.filters.categories.length > 0 || this.filters.accounts.length > 0
      || this.filters.crossMonth || Boolean(this.filters.keyword || this.filters.amountMin || this.filters.amountMax || this.filters.dateFrom || this.filters.dateTo || this.filters.tags || this.filters.calendarDate);
  }

  private toggleCalendarDateFilter(date: string): void {
    this.filters.calendarDate = this.filters.calendarDate === date ? "" : date;
    void this.render();
  }

  private selectedFilterTags(): string[] {
    return this.filters.tags.split(/[\s,，]+/).map((tag) => tag.replace(/^#/, "")).filter(Boolean);
  }

  private toggleTagFilter(tag: string): void {
    const selected = new Set(this.selectedFilterTags());
    if (selected.has(tag)) selected.delete(tag);
    else selected.add(tag);
    this.filters.tags = [...selected].join(" ");
  }

  private toggleAccountFilter(account: string): void {
    const selected = new Set(this.filters.accounts);
    if (selected.has(account)) selected.delete(account);
    else selected.add(account);
    this.filters.accounts = [...selected];
  }

  private applyFilters(items: Transaction[], excluded?: "types" | "necessities" | "categories" | "accounts" | "tags"): Transaction[] {
    const keyword = this.filters.keyword.trim().toLocaleLowerCase("zh-CN");
    const minAmount = this.filters.amountMin === "" ? null : Number(this.filters.amountMin);
    const maxAmount = this.filters.amountMax === "" ? null : Number(this.filters.amountMax);
    const requiredTags = this.selectedFilterTags();
    return items.filter((item) => {
      if (excluded !== "types" && this.filters.types.length && !this.filters.types.includes(item.type)) return false;
      if (excluded !== "necessities" && this.filters.necessities.length && !this.filters.necessities.includes(item.necessity)) return false;
      if (excluded !== "categories" && this.isTableColumnVisible("category") && this.filters.categories.length && !this.filters.categories.includes(item.category || "未分类")) return false;
      if (excluded !== "accounts" && this.isTableColumnVisible("account") && this.filters.accounts.length && !this.filters.accounts.includes(item.account) && !this.filters.accounts.includes(item.targetAccount)) return false;
      if (minAmount !== null && Number.isFinite(minAmount) && item.amount < minAmount) return false;
      if (maxAmount !== null && Number.isFinite(maxAmount) && item.amount > maxAmount) return false;
      if (this.filters.calendarDate && item.date !== this.filters.calendarDate) return false;
      if (this.filters.dateFrom && item.date < this.filters.dateFrom) return false;
      if (this.filters.dateTo && item.date > this.filters.dateTo) return false;
      if (excluded !== "tags" && requiredTags.length) {
        const itemTags = this.customTags(item);
        if (!requiredTags.every((tag) => itemTags.includes(tag))) return false;
      }
      if (keyword && !`${item.title} ${item.note} ${item.expression} ${item.category} ${item.account} ${item.tags.join(" ")} ${item.attachments.join(" ")}`.toLocaleLowerCase("zh-CN").includes(keyword)) return false;
      return true;
    });
  }

  private sortItems(items: Transaction[]): Transaction[] {
    return [...items].sort((a, b) => {
      if (!this.sortColumn) return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) * (this.dateSortDirection === "asc" ? 1 : -1);
      if (this.dateSortLocked) {
        const dateResult = a.date.localeCompare(b.date);
        if (dateResult !== 0) return dateResult * (this.dateSortDirection === "asc" ? 1 : -1);
      }
      const column = this.sortColumn;
      const result = this.compareColumn(a, b, column);
      const direction = this.sortDirection;
      if (result !== 0) return result * (direction === "asc" ? 1 : -1);
      if (column !== "title") return a.title.localeCompare(b.title, "zh-CN-u-co-pinyin", { numeric: true });
      return 0;
    });
  }

  private compareColumn(a: Transaction, b: Transaction, column: TableColumn): number {
    if (column === "date") return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
    if (column === "amount") return this.signedAmount(a) - this.signedAmount(b);
    if (column === "title") return a.title.localeCompare(b.title, "zh-CN-u-co-pinyin", { numeric: true });
    if (column === "type") return a.type.localeCompare(b.type, "zh-CN");
    if (column === "necessity") return a.necessity.localeCompare(b.necessity, "zh-CN");
    if (column === "category") return a.category.localeCompare(b.category, "zh-CN");
    if (column === "account") return a.account.localeCompare(b.account, "zh-CN");
    if (column === "note") return a.note.localeCompare(b.note, "zh-CN");
    if (column === "tags") return this.customTags(a).join(" ").localeCompare(this.customTags(b).join(" "), "zh-CN");
    if (column === "attachments") return a.attachments.join(" ").localeCompare(b.attachments.join(" "), "zh-CN");
    return 0;
  }

  private signedAmount(item: Transaction): number {
    return this.typeEffect(item) === "positive" ? item.amount : this.typeEffect(item) === "negative" ? -item.amount : 0;
  }

  private typeEffect(item: Transaction): "positive" | "negative" | "neutral" {
    return this.plugin.store.typeEffect(item.type);
  }

  private isTableColumnVisible(column: TableColumn): boolean {
    return this.plugin.settings.visibleTableColumns.includes(column);
  }

  private canInlineEdit(column: TableColumn): boolean {
    return this.plugin.settings.enableInlineEditing && this.plugin.settings.editableColumns.includes(column);
  }

  private renderBatchToolbar(content: HTMLElement, items: Transaction[]): void {
    const selected = items.filter((item) => this.selectedIds.has(item.id));
    if (!selected.length) return;
    const toolbar = content.createDiv({ cls: "bookkeeping-batch-toolbar" });
    toolbar.createSpan({ text: `已选择${selected.length}笔` });
    const modify = toolbar.createEl("button", { text: "批量修改" });
    modify.addEventListener("click", () => new BulkEditModal(this.app, this.plugin.settings, selected.length, (changes) => void this.batchModify(selected, changes)).open());
    const remove = toolbar.createEl("button", { text: "批量删除", cls: "mod-warning" });
    remove.addEventListener("click", () => {
      if (this.plugin.settings.confirmDelete) new ConfirmBatchDeleteModal(this.app, selected.length, () => void this.deleteBatch(selected)).open();
      else void this.deleteBatch(selected);
    });
    const cancel = toolbar.createEl("button", { text: "取消选择" });
    cancel.addEventListener("click", () => { this.selectedIds.clear(); void this.render(); });
  }

  private async batchModify(items: Transaction[], changes: BulkEditChanges): Promise<void> {
    try {
      await this.batchModifyInternal(items, changes);
    } catch (error) {
      this.plugin.notice(errorMessageZh(error, "批量修改失败，请重新扫描后再试"));
    }
  }

  private async batchModifyInternal(items: Transaction[], changes: BulkEditChanges): Promise<void> {
    for (const item of items) {
      const draft = this.toDraft(item);
      if (changes.date) draft.date = changes.date;
      if (changes.type) draft.type = changes.type;
      if (changes.necessity && draft.type !== "转账") draft.necessity = changes.necessity;
      if (changes.account) draft.account = changes.account;
      if (changes.category && draft.type !== "转账") draft.category = changes.category;
      if (draft.type === "转账") {
        const accountNames = this.plugin.settings.accounts.map((account) => account.name);
        draft.targetAccount = changes.targetAccount && changes.targetAccount !== draft.account
          ? changes.targetAccount
          : accountNames.find((account) => account !== draft.account) ?? "";
      } else draft.targetAccount = "";
      if (changes.tagMode && changes.tags) {
        if (changes.tagMode === "replace") draft.tags = [...changes.tags];
        else if (changes.tagMode === "add") draft.tags = [...new Set([...draft.tags, ...changes.tags])];
        else {
          draft.tags = draft.tags.filter((tag) => !changes.tags?.includes(tag));
          for (const tag of changes.tags) draft.note = this.replaceNoteTag(draft.note, tag, null);
        }
      }
      await this.plugin.store.update(item, draft);
    }
    this.selectedIds.clear();
    await this.render();
    this.plugin.notice(`已批量修改${items.length}笔账目`);
  }

  private async deleteBatch(items: Transaction[]): Promise<void> {
    try {
      await this.deleteBatchInternal(items);
    } catch (error) {
      this.plugin.notice(errorMessageZh(error, "批量删除失败，请重新扫描后再试"));
    }
  }

  private async deleteBatchInternal(items: Transaction[]): Promise<void> {
    const seconds = this.plugin.settings.undoDeleteSeconds;
    if (seconds <= 0) {
      for (const item of items) await this.plugin.store.remove(item);
      this.selectedIds.clear();
      await this.render();
      this.plugin.notice(`已删除${items.length}笔账目`);
      return;
    }
    const pending: Array<{ file: TFile; originalPath: string }> = [];
    try {
      for (const item of items) pending.push(await this.plugin.store.stageRemove(item));
    } catch (error) {
      for (const item of pending.reverse()) {
        try {
          await this.plugin.store.undoRemove(item);
        } catch {
          // Best-effort rollback: continue restoring other pending files.
        }
      }
      throw error;
    }
    this.selectedIds.clear();
    await this.render();
    const notice = this.plugin.notice("", seconds * 1000);
    notice.messageEl.empty();
    const wrapper = notice.messageEl.createDiv({ cls: "bookkeeping-undo-notice" });
    wrapper.createSpan({ text: this.plugin.t(`已删除${items.length}笔账目`) });
    const undo = wrapper.createEl("button", { text: this.plugin.t("撤销") });
    let finished = false;
    const timer = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      void Promise.all(pending.map((item) => this.plugin.store.finalizeRemove(item)));
    }, seconds * 1000);
    undo.addEventListener("click", () => { void (async () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      for (const item of pending) await this.plugin.store.undoRemove(item);
      notice.hide();
      await this.render();
      this.plugin.notice(`已恢复${items.length}笔账目`);
    })(); });
  }

  private renderTable(content: HTMLElement, items: Transaction[]): void {
    const columns = this.plugin.settings.tableColumnOrder.filter((column) => this.plugin.settings.visibleTableColumns.includes(column));
    const createScrollbar = (position: "top" | "bottom"): { track: HTMLDivElement; thumb: HTMLDivElement } => {
      const track = content.createDiv({
        cls: `bookkeeping-table-scrollbar is-${position}`,
        attr: {
          role: "scrollbar",
          tabindex: "0",
          "aria-label": position === "top" ? "账目明细上方横向滚动条" : "账目明细下方横向滚动条",
          "aria-orientation": "horizontal",
          "aria-valuemin": "0",
          "aria-valuemax": "0",
          "aria-valuenow": "0"
        }
      });
      return { track, thumb: track.createDiv({ cls: "bookkeeping-table-scrollbar-thumb" }) };
    };
    const topScroll = createScrollbar("top");
    const wrapper = content.createDiv({ cls: "bookkeeping-table-wrapper" });
    const bottomScroll = createScrollbar("bottom");
    if (!columns.length) {
      topScroll.track.remove();
      bottomScroll.track.remove();
      wrapper.createDiv({ cls: "bookkeeping-empty bookkeeping-empty-large", text: "未启用任何账目明细列，请在插件设置中选择。" });
      return;
    }
    const table = wrapper.createEl("table", { cls: "bookkeeping-table" });
    const colgroup = table.createEl("colgroup");
    const selectCol = colgroup.createEl("col", { cls: "bookkeeping-select-column-col" });
    const selectColumnWidth = 24;
    selectCol.setCssStyles({ width: `${selectColumnWidth}px`, minWidth: `${selectColumnWidth}px`, maxWidth: `${selectColumnWidth}px` });
    for (const column of columns) {
      const col = colgroup.createEl("col");
      col.dataset.column = column;
      this.applyStoredColumnWidth(col, column);
    }
    colgroup.createEl("col", { cls: "bookkeeping-table-fill-column-col" });
    const fixedWidth = selectColumnWidth + columns.reduce((sum, column) => sum + this.effectiveColumnWidth(column), 0);
    table.setCssStyles({ width: `max(100%, ${fixedWidth}px)`, minWidth: `${fixedWidth}px`, maxWidth: "none", tableLayout: "fixed" });
    const head = table.createEl("thead").createEl("tr");
    const selectAllCell = head.createEl("th", { cls: "bookkeeping-select-column" });
    const selectAll = selectAllCell.createEl("input", { type: "checkbox", attr: { "aria-label": "选择全部可见账目" } });
    selectAll.checked = items.length > 0 && items.every((item) => this.selectedIds.has(item.id));
    selectAll.disabled = items.length === 0;
    selectAll.addEventListener("change", () => {
      if (selectAll.checked) items.forEach((item) => this.selectedIds.add(item.id));
      else items.forEach((item) => this.selectedIds.delete(item.id));
      body.querySelectorAll<HTMLTableRowElement>("tr[data-transaction-id]").forEach((row) => {
        const id = row.dataset.transactionId ?? "";
        row.toggleClass("is-selected", this.selectedIds.has(id));
        const rowCheckbox = row.querySelector<HTMLInputElement>(".bookkeeping-select-column input[type='checkbox']");
        if (rowCheckbox) rowCheckbox.checked = this.selectedIds.has(id);
      });
    });
    for (const column of columns) this.renderTableHeader(head, column);
    head.createEl("th", { cls: "bookkeeping-table-fill-cell", attr: { "aria-hidden": "true" } });
    const body = table.createEl("tbody");
    if (!items.length) {
      const emptyRow = body.createEl("tr", { cls: "bookkeeping-table-empty-row" });
      const emptyCell = emptyRow.createEl("td", { cls: "bookkeeping-table-empty-cell", attr: { colspan: String(columns.length + 2) } });
      emptyCell.createDiv({ cls: "bookkeeping-table-empty-message", text: "没有符合条件的账目" });
    }
    for (const item of items) {
      const row = body.createEl("tr");
      row.dataset.transactionId = item.id;
      row.toggleClass("is-selected", this.selectedIds.has(item.id));
      const selection = row.createEl("td", { cls: "bookkeeping-select-column" });
      const checkbox = selection.createEl("input", { type: "checkbox", attr: { "aria-label": `选择${item.title}` } });
      checkbox.checked = this.selectedIds.has(item.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.selectedIds.add(item.id);
        else this.selectedIds.delete(item.id);
        row.toggleClass("is-selected", checkbox.checked);
        selectAll.checked = items.length > 0 && items.every((visibleItem) => this.selectedIds.has(visibleItem.id));
      });
      for (const column of columns) this.renderTableCell(row, column, item);
      row.createEl("td", { cls: "bookkeeping-table-fill-cell", attr: { "aria-hidden": "true" } });
    }
    const scrollbars = [topScroll, bottomScroll];
    let maximum = 0;
    const syncScrollbarPositions = (): void => {
      const value = Math.min(maximum, Math.max(0, wrapper.scrollLeft));
      for (const { track, thumb } of scrollbars) {
        const inset = 2;
        const innerWidth = Math.max(0, track.clientWidth - inset * 2);
        const visibleRatio = table.scrollWidth > 0 ? Math.min(1, wrapper.clientWidth / table.scrollWidth) : 1;
        const thumbWidth = maximum > 0 ? Math.min(innerWidth, Math.max(30, innerWidth * visibleRatio)) : innerWidth;
        const travel = Math.max(0, innerWidth - thumbWidth);
        const offset = maximum > 0 ? value / maximum * travel : 0;
        thumb.setCssStyles({ width: `${thumbWidth}px`, transform: `translate3d(${offset}px, 0, 0)` });
        track.toggleClass("is-static", maximum <= 0);
        track.setAttribute("aria-disabled", String(maximum <= 0));
        track.setAttribute("aria-valuemax", String(Math.round(maximum)));
        track.setAttribute("aria-valuenow", String(Math.round(value)));
      }
    };
    const setScrollFromPointer = (track: HTMLDivElement, thumb: HTMLDivElement, clientX: number, grabOffset: number): void => {
      if (maximum <= 0) return;
      const rect = track.getBoundingClientRect();
      const inset = 2;
      const innerWidth = Math.max(0, track.clientWidth - inset * 2);
      const travel = Math.max(0, innerWidth - thumb.offsetWidth);
      if (travel <= 0) return;
      const thumbOffset = Math.min(travel, Math.max(0, clientX - rect.left - inset - grabOffset));
      wrapper.scrollLeft = thumbOffset / travel * maximum;
    };
    const bindScrollbar = ({ track, thumb }: { track: HTMLDivElement; thumb: HTMLDivElement }): void => {
      track.addEventListener("touchstart", (event) => event.stopPropagation(), { passive: true });
      track.addEventListener("pointerdown", (event) => {
        if (maximum <= 0) return;
        event.preventDefault();
        event.stopPropagation();
        const targetIsThumb = event.target instanceof Node && thumb.contains(event.target);
        const thumbRect = thumb.getBoundingClientRect();
        const grabOffset = targetIsThumb ? event.clientX - thumbRect.left : thumbRect.width / 2;
        if (!targetIsThumb) setScrollFromPointer(track, thumb, event.clientX, grabOffset);
        track.addClass("is-dragging");
        track.setPointerCapture(event.pointerId);
        const move = (moveEvent: PointerEvent): void => {
          if (moveEvent.pointerId !== event.pointerId) return;
          moveEvent.preventDefault();
          setScrollFromPointer(track, thumb, moveEvent.clientX, grabOffset);
        };
        const finish = (endEvent: PointerEvent): void => {
          if (endEvent.pointerId !== event.pointerId) return;
          track.removeClass("is-dragging");
          track.removeEventListener("pointermove", move);
          track.removeEventListener("pointerup", finish);
          track.removeEventListener("pointercancel", finish);
          if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
        };
        track.addEventListener("pointermove", move);
        track.addEventListener("pointerup", finish);
        track.addEventListener("pointercancel", finish);
      });
      track.addEventListener("keydown", (event) => {
        const step = Math.max(36, wrapper.clientWidth * 0.12);
        if (event.key === "ArrowLeft") wrapper.scrollLeft -= step;
        else if (event.key === "ArrowRight") wrapper.scrollLeft += step;
        else if (event.key === "PageUp") wrapper.scrollLeft -= wrapper.clientWidth * 0.8;
        else if (event.key === "PageDown") wrapper.scrollLeft += wrapper.clientWidth * 0.8;
        else if (event.key === "Home") wrapper.scrollLeft = 0;
        else if (event.key === "End") wrapper.scrollLeft = maximum;
        else return;
        event.preventDefault();
      });
    };
    scrollbars.forEach(bindScrollbar);
    wrapper.addEventListener("scroll", syncScrollbarPositions);
    const syncScrollbars = (): void => {
      maximum = Math.max(0, table.scrollWidth - wrapper.clientWidth);
      wrapper.setCssProps({ "--bookkeeping-table-viewport-width": `${wrapper.clientWidth}px` });
      syncScrollbarPositions();
      wrapper.setCssProps({ "--bookkeeping-table-header-height": `${head.getBoundingClientRect().height}px` });
    };
    this.tableResizeObserver = new ResizeObserver(syncScrollbars);
    this.tableResizeObserver.observe(wrapper);
    this.tableResizeObserver.observe(table);
    window.requestAnimationFrame(syncScrollbars);
  }

  private renderTableHeader(row: HTMLTableRowElement, column: TableColumn): void {
    const cell = row.createEl("th");
    cell.dataset.column = column;
    this.applyStoredColumnWidth(cell, column);
    const label = this.plugin.settings.tableColumnLabels[column];
    if (column === "actions") {
      cell.setText(label);
      this.renderColumnResizer(cell, column);
      return;
    }
    const header = cell.createDiv({ cls: "bookkeeping-table-header-content" });
    const button = header.createEl("button", { cls: "bookkeeping-sort-button", attr: { title: `按${label}排序` } });
    button.createSpan({ text: label });
    if (column === "date" || this.sortColumn === column) {
      const icon = button.createSpan();
      setIcon(icon, column === "date" ? (this.dateSortDirection === "asc" ? "arrow-up" : "arrow-down") : (this.sortDirection === "asc" ? "arrow-up" : "arrow-down"));
    }
    button.addEventListener("click", () => {
      this.preferredScrollAnchor = `th[data-column="${column}"]`;
      if (column === "date") {
        this.dateSortDirection = this.dateSortDirection === "asc" ? "desc" : "asc";
      } else if (this.sortColumn === column && this.sortDirection === "asc") this.sortDirection = "desc";
      else if (this.sortColumn === column) this.sortColumn = null;
      else {
        this.sortColumn = column;
        this.sortDirection = "asc";
      }
      void this.render();
    });
    if (column === "date") {
      const lock = header.createEl("button", { cls: `bookkeeping-date-lock clickable-icon${this.dateSortLocked ? " is-locked" : " is-unlocked"}`, attr: { title: this.dateSortLocked ? "解除日期主排序锁" : "锁定日期为主排序" } });
      setIcon(lock, this.dateSortLocked ? "lock-keyhole" : "lock-open");
      lock.addEventListener("click", () => {
        this.preferredScrollAnchor = 'th[data-column="date"]';
        this.dateSortLocked = !this.dateSortLocked;
        void this.render();
      });
    }
    this.renderColumnResizer(cell, column);
  }

  private renderTableCell(row: HTMLTableRowElement, column: TableColumn, item: Transaction): void {
    const cell = row.createEl("td");
    cell.dataset.column = column;
    this.applyStoredColumnWidth(cell, column);
    if (column === "date") {
      if (this.canInlineEdit("date")) this.renderInlineDate(cell, item);
      else {
        const value = cell.createDiv({ cls: "bookkeeping-date-cell", attr: { title: this.displayDate(item.date) } });
        value.createSpan({ text: this.displayDate(item.date) });
      }
    }
    else if (column === "title") {
      if (this.canInlineEdit("title")) this.renderInlineText(cell, item, "title", item.title);
      else cell.createSpan({ text: item.title, attr: { title: item.title }, cls: "bookkeeping-cell-ellipsis bookkeeping-user-text" });
    } else if (column === "type") {
      const typeOptions = this.plugin.settings.typeOrder.filter((type) => this.plugin.settings.enableAccount && this.plugin.settings.accounts.length > 1 || type !== "转账");
      if (this.canInlineEdit("type")) this.renderInlineChoice(cell, item, "type", typeOptions, item.type, `bookkeeping-type bookkeeping-type-${item.type}`, (value) => this.plugin.settings.typeLabels[value] ?? value);
      else cell.createSpan({ text: this.plugin.settings.typeLabels[item.type], cls: `bookkeeping-type bookkeeping-type-${item.type}` });
    } else if (column === "necessity") {
      const value = item.type === "转账" ? "—" : item.necessity;
      if (this.canInlineEdit("necessity") && item.type !== "转账") this.renderInlineChoice(cell, item, "necessity", this.plugin.settings.necessityOrder, value, `bookkeeping-necessity bookkeeping-necessity-${item.necessity}`, (option) => option === "—" ? option : this.plugin.settings.necessityLabels[option] ?? option);
      else cell.createSpan({ text: value === "—" ? value : this.plugin.settings.necessityLabels[item.necessity], cls: `bookkeeping-necessity bookkeeping-necessity-${item.necessity}` });
    } else if (column === "category") {
      const value = item.type === "转账" ? "—" : (item.category || "未分类");
      if (this.canInlineEdit("category") && this.plugin.settings.enableCategory && item.type !== "转账") {
        const categories = this.typeEffect(item) === "positive" ? this.plugin.settings.incomeCategories : this.plugin.settings.categories;
        this.renderInlineChoice(cell, item, "category", [...new Set(["未分类", ...categories])], value);
      } else cell.setText(value);
    } else if (column === "account") {
      const value = item.type === "转账" ? `${item.account}→${item.targetAccount}` : (item.account || this.plugin.settings.defaultAccount);
      if (this.canInlineEdit("account") && this.plugin.settings.enableAccount && item.type !== "转账") this.renderInlineChoice(cell, item, "account", this.plugin.settings.accounts.map((account) => account.name), value);
      else cell.setText(value);
    }
    else if (column === "amount") {
      if (this.typeEffect(item) === "positive") cell.addClass("bookkeeping-amount-income");
      else if (this.typeEffect(item) === "negative") cell.addClass("bookkeeping-amount-expense");
      const value = `${this.typeEffect(item) === "positive" ? "+" : this.typeEffect(item) === "negative" ? "−" : ""}${this.money(item.amount)}`;
      if (this.canInlineEdit("amount")) this.renderInlineAmount(cell, item, value);
      else {
        cell.setText(value);
        cell.setAttribute("title", value);
      }
    } else if (column === "note") {
      const note = item.note === "无" ? "" : item.note;
      if (this.canInlineEdit("note")) this.renderInlineText(cell, item, "note", note);
      else cell.createSpan({ text: note || "无", attr: { title: note || "无" }, cls: `bookkeeping-cell-ellipsis${note ? " bookkeeping-user-text" : " is-empty"}` });
    } else if (column === "tags") {
      const tags = this.customTags(item);
      const wrap = cell.createDiv({ cls: "bookkeeping-table-tags" });
      tags.forEach((tag) => {
        const badge = wrap.createEl("button", { cls: "bookkeeping-tag-badge", attr: { title: `筛选#${tag}` } });
        badge.createSpan({ text: `#${tag}`, cls: "bookkeeping-user-text" });
        badge.addEventListener("click", () => {
          this.toggleTagFilter(tag);
          void this.render();
        });
        badge.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          const menu = new Menu();
          menu.addItem((menuItem) => menuItem.setTitle(this.plugin.t("从此账目删除标签")).setIcon("tag-x").onClick(() => { void (async () => {
            const draft = this.toDraft(item);
            draft.tags = draft.tags.filter((value) => value !== tag);
            draft.note = this.replaceNoteTag(draft.note, tag, null);
            await this.plugin.store.update(item, draft);
            await this.render();
          })(); }));
          menu.addItem((menuItem) => menuItem.setTitle(this.plugin.t("全局重命名此标签")).setIcon("pencil").onClick(() => this.plugin.openTagManager(tag)));
          menu.showAtMouseEvent(event);
        });
      });
      if (this.canInlineEdit("tags")) this.renderTagAdder(wrap, item);
      else if (!tags.length) wrap.createSpan({ text: "—", cls: "bookkeeping-empty-value" });
    } else if (column === "attachments") {
      const wrap = cell.createDiv({ cls: "bookkeeping-table-attachments" });
      for (const path of item.attachments) {
        const button = wrap.createEl("button", { cls: "bookkeeping-attachment-link", attr: { title: path, "aria-label": `打开附件${path}` } });
        setIcon(button, "paperclip");
        button.createSpan({ text: path.split("/").pop() ?? path });
        button.addEventListener("click", () => {
          const file = this.app.vault.getAbstractFileByPath(path);
          if (file instanceof TFile) void this.app.workspace.getLeaf(false).openFile(file);
          else this.plugin.notice(`附件不存在：${path}`);
        });
      }
      if (!item.attachments.length) wrap.createSpan({ text: "无", cls: "bookkeeping-empty-value" });
    } else if (column === "actions") {
      const actions = cell.createDiv({ cls: "bookkeeping-row-actions" });
      if (this.plugin.settings.showEditAction) this.iconButton(actions, "pencil", "编辑", () => this.plugin.openMobileEntry(false, item));
      if (this.plugin.settings.showOpenAction) this.iconButton(actions, "file-text", "打开原始Markdown", () => void this.app.workspace.getLeaf(false).openFile(item.file));
      if (this.plugin.settings.showDeleteAction) this.iconButton(actions, "trash-2", "删除", () => {
        if (this.deletingIds.has(item.id)) return;
        if (this.plugin.settings.confirmDelete) new ConfirmDeleteModal(this.app, item, () => void this.deleteWithUndo(item)).open();
        else void this.deleteWithUndo(item);
      });
    }
  }

  private applyStoredColumnWidth(cell: HTMLElement, column: TableColumn): void {
    const width = this.effectiveColumnWidth(column);
    cell.setCssStyles({ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` });
  }

  private effectiveColumnWidth(column: TableColumn): number {
    const stored = this.plugin.settings.tableColumnWidths[column];
    if (typeof stored === "number" && Number.isFinite(stored)) return this.normalizeColumnWidth(column, stored);
    const defaults: Record<TableColumn, number> = {
      date: 58,
      title: 128,
      type: 58,
      necessity: 68,
      category: 72,
      account: 76,
      amount: 86,
      note: 128,
      tags: 82,
      attachments: 88,
      actions: 72
    };
    return defaults[column];
  }

  private normalizeColumnWidth(column: TableColumn, width: number): number {
    const rounded = Math.round(width);
    const migrated = column === "date" && [96, 82, 70, 64].includes(rounded) ? 58 : rounded;
    return Math.max(this.columnMinimumWidth(column), Math.min(480, migrated));
  }

  private columnMinimumWidth(column: TableColumn): number {
    const widths: Record<TableColumn, number> = {
      date: 58,
      title: 48,
      type: 54,
      necessity: 68,
      category: 54,
      account: 48,
      amount: 78,
      note: 48,
      tags: 66,
      attachments: 66,
      actions: 72
    };
    return widths[column];
  }

  private renderColumnResizer(cell: HTMLTableCellElement, column: TableColumn): void {
    const handle = cell.createSpan({ cls: "bookkeeping-column-resizer", attr: { title: `拖动调整${this.plugin.settings.tableColumnLabels[column]}列宽` } });
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startWidth = cell.getBoundingClientRect().width;
      const table = cell.closest("table");
      let frozenContentWidth = table?.getBoundingClientRect().width ?? 0;
      if (table) {
        frozenContentWidth = table.querySelector<HTMLElement>(".bookkeeping-select-column")?.getBoundingClientRect().width ?? 24;
        table.querySelectorAll<HTMLTableCellElement>("thead th[data-column]").forEach((header) => {
          const frozenWidth = Math.round(header.getBoundingClientRect().width);
          const frozenColumn = header.dataset.column as TableColumn | undefined;
          if (!frozenColumn) return;
          frozenContentWidth += frozenWidth;
          table.querySelectorAll<HTMLElement>(`[data-column="${frozenColumn}"]`).forEach((element) => {
            element.setCssStyles({ width: `${frozenWidth}px`, minWidth: `${frozenWidth}px`, maxWidth: `${frozenWidth}px` });
          });
        });
        frozenContentWidth = Math.round(frozenContentWidth);
        table.setCssStyles({ width: `max(100%, ${frozenContentWidth}px)`, minWidth: `${frozenContentWidth}px`, maxWidth: "none", tableLayout: "fixed" });
      }
      handle.setPointerCapture(event.pointerId);
      document.body.addClass("bookkeeping-is-resizing-column");
      const move = (moveEvent: PointerEvent): void => {
        const minimum = this.columnMinimumWidth(column);
        const width = Math.max(minimum, Math.min(480, Math.round(startWidth + moveEvent.clientX - startX)));
        this.contentEl.querySelectorAll<HTMLElement>(`[data-column="${column}"]`).forEach((element) => {

          element.setCssStyles({ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` });
        });
        this.plugin.settings.tableColumnWidths[column] = width;
        if (table) {
          const nextContentWidth = Math.round(frozenContentWidth + width - startWidth);
          table.setCssStyles({ width: `max(100%, ${nextContentWidth}px)`, minWidth: `${nextContentWidth}px`, maxWidth: "none" });
        }
      };
      const end = (): void => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", end);
        document.removeEventListener("pointercancel", end);
        document.body.removeClass("bookkeeping-is-resizing-column");
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        void this.plugin.saveSettingsQuietly();
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", end, { once: true });
      document.addEventListener("pointercancel", end, { once: true });
    });
  }

  private async deleteWithUndo(item: Transaction): Promise<void> {
    if (this.deletingIds.has(item.id)) return;
    this.deletingIds.add(item.id);
    const seconds = this.plugin.settings.undoDeleteSeconds;
    try {
      if (seconds <= 0) {
        await this.plugin.store.remove(item);
        this.plugin.notice("账目已移至系统回收站");
        await this.render();
        return;
      }
      const pending = await this.plugin.store.stageRemove(item);
      await this.render();
      const notice = this.plugin.notice("", seconds * 1000);
      notice.messageEl.empty();
      const wrapper = notice.messageEl.createDiv({ cls: "bookkeeping-undo-notice" });
      wrapper.createSpan({ text: this.plugin.t(`已删除“${item.title}”`) });
      const undo = wrapper.createEl("button", { text: this.plugin.t("撤销") });
      let finished = false;
      const timer = window.setTimeout(() => {
        if (finished) return;
        finished = true;
        void this.plugin.store.finalizeRemove(pending);
      }, seconds * 1000);
      undo.addEventListener("click", () => { void (async () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        await this.plugin.store.undoRemove(pending);
        notice.hide();
        this.plugin.notice("已撤销删除");
        await this.render();
      })(); });
    } catch (error) {
      this.plugin.notice(errorMessageZh(error, "删除失败，请重新扫描后再试"));
    } finally {
      this.deletingIds.delete(item.id);
    }
  }

  private iconButton(parent: HTMLElement, icon: string, tooltip: string, action: () => void): void {
    const button = parent.createEl("button", { cls: tooltip === "删除" ? "bookkeeping-delete-icon" : "", attr: { "aria-label": tooltip } });
    setIcon(button, icon);
    button.addEventListener("click", action);
  }

  private renderInlineDate(cell: HTMLTableCellElement, item: Transaction): void {
    const button = cell.createEl("button", { cls: "bookkeeping-inline-value bookkeeping-date-cell", attr: { title: "修改日期" } });
    button.createSpan({ text: this.displayDate(item.date) });
    button.addEventListener("click", () => {
      cell.empty();
      const input = cell.createEl("input", { type: "date", cls: "bookkeeping-inline-input", value: item.date, attr: { lang: this.plugin.settings.language } });
      let finished = false;
      const commit = async (): Promise<void> => {
        if (finished) return;
        finished = true;
        const date = normalizeDate(input.value);
        if (!date) {
          this.plugin.notice("日期无效，请选择真实存在的日期");
          await this.render();
          return;
        }
        const draft = this.toDraft(item);
        draft.date = date;
        await this.plugin.store.update(item, draft);
        await this.render();
      };
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); void commit(); }
        else if (event.key === "Escape") { finished = true; void this.render(); }
      });
      input.addEventListener("blur", () => void commit());
      input.focus();
    });
  }

  private renderInlineText(cell: HTMLTableCellElement, item: Transaction, field: "title" | "note", value: string): void {
    const displayValue = value || (field === "note" ? "无" : "");
    const button = cell.createEl("button", { cls: `bookkeeping-inline-value bookkeeping-cell-ellipsis${value ? "" : " is-empty"}`, text: displayValue, attr: { title: displayValue } });
    button.addEventListener("click", () => {
      cell.empty();
      const input = cell.createEl("input", { type: "text", cls: "bookkeeping-inline-input", value });
      let finished = false;
      const commit = async (): Promise<void> => {
        if (finished) return;
        finished = true;
        const next = input.value.trim();
        if (field === "title" && (!next || /^\d+$/.test(next))) {
          this.plugin.notice("内容不能为空或纯数字");
          await this.render();
          return;
        }
        const draft = this.toDraft(item);
        draft[field] = next;
        await this.plugin.store.update(item, draft);
        await this.render();
      };
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void commit();
        } else if (event.key === "Escape") {
          finished = true;
          void this.render();
        }
      });
      input.addEventListener("blur", () => void commit());
      input.focus();
      input.select();
    });
  }

  private renderInlineChoice(
    cell: HTMLTableCellElement,
    item: Transaction,
    field: "type" | "necessity" | "category" | "account",
    options: string[],
    value: string,
    className = "",
    displayOption: (value: string) => string = (value) => value
  ): void {
    const presets = [...new Set([value, ...options].filter(Boolean))];
    const button = cell.createEl("button", { cls: `bookkeeping-inline-choice ${className}`, text: displayOption(value), attr: { title: `从预设中切换${this.plugin.settings.tableColumnLabels[field]}` } });
    button.addEventListener("click", (event) => {
      const menu = new Menu();
      presets.forEach((option) => menu.addItem((menuItem) => menuItem
        .setTitle(this.plugin.t(displayOption(option)))
        .setChecked(option === value)
        .onClick(() => void this.updateInlineChoice(item, field, option))));
      menu.showAtMouseEvent(event);
    });
  }

  private async updateInlineChoice(item: Transaction, field: "type" | "necessity" | "category" | "account", value: string): Promise<void> {
    const draft = this.toDraft(item);
    if (field === "type") {
      draft.type = value;
      if (draft.type === "转账") {
        draft.targetAccount = this.plugin.settings.accounts.map((account) => account.name).find((account) => account !== draft.account) ?? "";
      } else {
        draft.targetAccount = "";
        if (this.plugin.settings.enableCategory) {
          const categories = this.plugin.store.typeEffect(draft.type) === "positive" ? this.plugin.settings.incomeCategories : this.plugin.settings.categories;
          if (!categories.includes(draft.category)) draft.category = categories[0] ?? "未分类";
        }
      }
    } else if (field === "necessity") draft.necessity = value === "非必需" ? "非必需" : "必需";
    else draft[field] = value;
    await this.plugin.store.update(item, draft);
    await this.render();
  }

  private renderInlineAmount(cell: HTMLTableCellElement, item: Transaction, displayValue: string): void {
    const button = cell.createEl("button", { cls: "bookkeeping-inline-value bookkeeping-cell-ellipsis", text: displayValue, attr: { title: "修改金额（收支符号保持不变）" } });
    button.addEventListener("click", () => {
      cell.empty();
      const editor = cell.createDiv({ cls: "bookkeeping-inline-amount-editor" });
      const prefix = this.typeEffect(item) === "positive" ? "+" : this.typeEffect(item) === "negative" ? "−" : "";
      editor.createSpan({ text: `${prefix}${this.plugin.settings.currency}`, cls: "bookkeeping-fixed-sign", attr: { title: "符号不可修改" } });
      const input = editor.createEl("input", {
        type: "text",
        value: item.expression || String(item.amount),
        cls: "bookkeeping-inline-input",
        attr: { inputmode: "decimal", "aria-label": "金额数值" }
      });
      let finished = false;
      const commit = async (): Promise<void> => {
        if (finished) return;
        finished = true;
        const expression = input.value.trim();
        let amount = 0;
        try {
          amount = evaluateAmount(expression);
        } catch (error) {
          this.plugin.notice(errorMessageZh(error, "金额或算式不合法"));
          await this.render();
          return;
        }
        const draft = this.toDraft(item);
        draft.amount = amount;
        draft.expression = expression;
        await this.plugin.store.update(item, draft);
        await this.render();
      };
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void commit();
        } else if (event.key === "Escape") {
          finished = true;
          void this.render();
        }
      });
      input.addEventListener("blur", () => void commit());
      input.focus();
      input.select();
    });
  }

  private renderTagAdder(parent: HTMLElement, item: Transaction): void {
    const add = parent.createEl("button", { cls: "bookkeeping-tag-add", attr: { "aria-label": "添加标签", title: "添加标签" } });
    setIcon(add, "plus");
    add.addEventListener("click", () => {
      add.remove();
      parent.querySelector(".bookkeeping-empty-value")?.remove();
      const input = parent.createEl("input", { type: "text", cls: "bookkeeping-tag-input", attr: { placeholder: "标签", "aria-label": "新增标签" } });
      let finished = false;
      const commit = async (): Promise<void> => {
        if (finished) return;
        finished = true;
        const additions = input.value.split(/[\s,，]+/).map((tag) => tag.replace(/^#+/, "").trim()).filter((tag) => tag && tag !== "记账");
        if (!additions.length) {
          await this.render();
          return;
        }
        const draft = this.toDraft(item);
        draft.tags = [...new Set([...draft.tags, ...additions])];
        await this.plugin.store.update(item, draft);
        await this.render();
      };
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void commit();
        } else if (event.key === "Escape") {
          finished = true;
          void this.render();
        }
      });
      input.addEventListener("blur", () => void commit());
      input.focus();
    });
  }

  private toDraft(item: Transaction): TransactionDraft {
    return {
      date: item.date,
      time: item.time,
      type: item.type,
      necessity: item.necessity,
      category: item.category || "未分类",
      account: item.account || this.plugin.settings.defaultAccount,
      targetAccount: item.targetAccount,
      title: item.title,
      amount: item.amount,
      expression: item.expression,
      note: item.note === "无" ? "" : item.note,
      tags: [...item.tags],
      attachments: [...item.attachments]
    };
  }

  private collectTags(items: Transaction[]): string[] {
    return [...new Set([...this.plugin.settings.customTags, ...items.flatMap((item) => this.customTags(item))])].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }

  private customTags(item: Transaction): string[] {
    return item.tags.filter((tag) => tag !== "记账").map((tag) => tag.replace(/^#/, ""));
  }

  private replaceNoteTag(note: string, tag: string, replacement: string | null): string {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return note.replace(new RegExp(`#${escaped}(?=$|[\\s,，。.!！？;；])`, "gu"), replacement ? `#${replacement}` : "").replace(/\s{2,}/g, " ").trim();
  }

  private trendMetricLabel(metric: TrendMetric): string {
    return metric === "expense" ? "支出" : metric === "income" ? "收入" : metric === "net" ? "结余" : "余额";
  }

  private pieColor(metric: PieMetric, _name: string, index: number): string {
    const primary = metric === "incomeCategory" || metric === "accountIncome" || metric === "accountBalance"
      ? this.plugin.semanticColor("income")
      : this.plugin.semanticColor("expense");
    const colors = [primary, ...AUXILIARY_CHART_COLORS];
    return colors[index % colors.length] ?? primary;
  }

  private niceAxisStep(value: number): number {
    const exponent = Math.floor(Math.log10(Math.max(value, Number.EPSILON)));
    const fraction = value / 10 ** exponent;
    const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
    return niceFraction * 10 ** exponent;
  }

  private nextNiceAxisStep(value: number): number {
    const exponent = Math.floor(Math.log10(Math.max(value, Number.EPSILON)));
    const base = 10 ** exponent;
    const fraction = value / base;
    if (fraction < 2 - 1e-8) return 2 * base;
    if (fraction < 2.5 - 1e-8) return 2.5 * base;
    if (fraction < 5 - 1e-8) return 5 * base;
    return 10 * base;
  }

  private seriesTone(metric: TrendMetric): string {
    return metric === "income" ? "is-profit" : metric === "expense" ? "is-loss" : "";
  }

  private trendTone(metric: TrendMetric, value: number): string {
    if (metric === "income") return "is-profit";
    if (metric === "expense") return "is-loss";
    return value < 0 ? "is-loss" : value > 0 ? "is-profit" : "";
  }

  private money(value: number): string {
    return formatMoney(value, this.plugin.settings.currency, this.plugin.settings.numberGrouping);
  }

  private displayDate(value: string): string {
    return formatDateDisplay(value, this.plugin.settings.dateDisplayFormat, this.plugin.settings.language);
  }

  private formatCalendarAmount(value: number): { text: string; hasUnit: boolean } {
    const absolute = Math.abs(value);
    const sign = value < 0 ? "−" : "";
    if (this.plugin.settings.language !== "zh-CN" && this.plugin.settings.language !== "zh-TW") {
      if (absolute >= 1000000) return { text: `${sign}${this.calendarUnitValue(absolute / 1000000, "m")}`, hasUnit: true };
      if (absolute >= 1000) return { text: `${sign}${this.calendarUnitValue(absolute / 1000, "k")}`, hasUnit: true };
    }
    if (absolute >= 100000000) return { text: `${sign}${this.calendarUnitValue(absolute / 100000000, "亿")}`, hasUnit: true };
    if (absolute >= 10000) return { text: `${sign}${this.calendarUnitValue(absolute / 10000, "万")}`, hasUnit: true };
    if (absolute >= 1000) return { text: `${sign}${Math.round(absolute)}`, hasUnit: false };
    if (absolute >= 100) return { text: `${sign}${absolute.toFixed(1)}`, hasUnit: false };
    return { text: `${sign}${absolute.toFixed(2)}`, hasUnit: false };
  }

  private calendarUnitValue(value: number, unit: "万" | "亿" | "k" | "m"): string {
    for (let decimals = 2; decimals >= 0; decimals--) {
      const text = value.toFixed(decimals);
      if (text.replace(".", "").length + 1 <= 4) return `${text}${unit}`;
    }
    return `${Math.round(value)}${unit}`;
  }

  private formatCompactMoney(value: number, axisUsesWan = false): string {
    if (Math.abs(value) < 0.005) return `${this.plugin.settings.currency}0`;
    const absolute = Math.abs(value);
    const sign = value < 0 ? "−" : "";
    if (axisUsesWan && absolute >= 10000) {
      if (this.plugin.settings.language !== "zh-CN" && this.plugin.settings.language !== "zh-TW") {
        const divisor = absolute >= 1000000 ? 1000000 : 1000;
        const unit = absolute >= 1000000 ? "m" : "k";
        return `${sign}${this.plugin.settings.currency}${(absolute / divisor).toFixed(1)}${unit}`;
      }
      return `${sign}${this.plugin.settings.currency}${(absolute / 10000).toFixed(1)}万`;
    }
    if (absolute >= 1000) {
      const rounded = Math.round(absolute);
      const formatted = formatMoney(rounded, "", this.plugin.settings.numberGrouping).replace(/\.00$/, "");
      return `${sign}${this.plugin.settings.currency}${formatted}`;
    }
    const formatted = formatMoney(absolute, "", this.plugin.settings.numberGrouping).replace(/\.00$/, "");
    return `${sign}${this.plugin.settings.currency}${formatted}`;
  }
}

class DashboardChartsModal extends Modal {
  private draggedId = "";

  constructor(app: App, private readonly plugin: BookkeepingPlugin, private readonly onSaved: () => Promise<void>) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    this.renderList();
  }

  onClose(): void {
    void this.onSaved();
  }

  private renderList(): void {
    this.contentEl.empty();
    this.setTitle("仪表盘图表配置");
    const list = this.contentEl.createDiv({ cls: "bookkeeping-chart-manager" });
    for (const chart of this.plugin.settings.chartConfigs) {
      const row = list.createDiv({ cls: "bookkeeping-chart-manager-row" });
      row.dataset.chartId = chart.id;
      const drag = row.createSpan({ cls: "bookkeeping-chart-drag" });
      setIcon(drag, "grip-vertical");
      drag.draggable = true;
      row.createSpan({ cls: "bookkeeping-chart-manager-name", text: chart.title });
      const visible = row.createEl("button", { cls: "clickable-icon", attr: { type: "button", "aria-label": chart.visible ? `隐藏${chart.title}` : `显示${chart.title}` } });
      setIcon(visible, chart.visible ? "eye" : "eye-off");
      visible.addEventListener("click", () => { void (async () => { chart.visible = !chart.visible; await this.plugin.saveSettingsQuietly(); this.renderList(); })(); });
      const edit = row.createEl("button", { cls: "clickable-icon", attr: { "aria-label": `配置${chart.title}` } });
      setIcon(edit, "settings-2");
      edit.addEventListener("click", () => new ChartSettingsModal(this.app, this.plugin, chart, async () => { await this.onSaved(); this.renderList(); }).open());
      const remove = row.createEl("button", { cls: "clickable-icon mod-warning", attr: { "aria-label": `移除${chart.title}` } });
      setIcon(remove, "trash-2");
      remove.addEventListener("click", () => { void (async () => {
        this.plugin.settings.chartConfigs = this.plugin.settings.chartConfigs.filter((item) => item.id !== chart.id);
        await this.plugin.saveSettings();
        await this.onSaved();
        this.renderList();
      })(); });
      drag.addEventListener("dragstart", () => { this.draggedId = chart.id; row.addClass("is-dragging"); });
      drag.addEventListener("dragend", () => { this.draggedId = ""; row.removeClass("is-dragging"); this.contentEl.querySelectorAll(".is-drop-target").forEach((element) => element.classList.remove("is-drop-target")); });
      row.addEventListener("dragover", (event) => event.preventDefault());
      row.addEventListener("dragenter", () => { if (this.draggedId && this.draggedId !== chart.id) row.addClass("is-drop-target"); });
      row.addEventListener("dragleave", (event) => { if (!row.contains(event.relatedTarget as Node | null)) row.removeClass("is-drop-target"); });
      row.addEventListener("drop", (event) => { event.preventDefault(); row.removeClass("is-drop-target"); if (this.draggedId && this.draggedId !== chart.id) void this.move(this.draggedId, chart.id); });
      bindPointerSort({
        root: list,
        item: row,
        handle: drag,
        itemSelector: ".bookkeeping-chart-manager-row",
        onCommit: (_source, target) => {
          const targetId = target?.dataset.chartId;
          if (targetId && targetId !== chart.id) void this.move(chart.id, targetId);
        }
      });
    }
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("添加图表").setIcon("plus").onClick(() => { void (async () => {
      this.plugin.settings.chartConfigs.push({ id: `chart-${Date.now()}`, title: "自定义趋势图", kind: "trend", visible: true, width: "half", metric: "expense", chartType: "line" });
      await this.plugin.saveSettings();
      await this.onSaved();
      this.renderList();
    })(); });
    new ButtonComponent(actions).setButtonText("完成").setCta().onClick(() => this.close());
  }

  private async move(sourceId: string, targetId: string): Promise<void> {
    const configs = [...this.plugin.settings.chartConfigs];
    const source = configs.findIndex((item) => item.id === sourceId);
    const target = configs.findIndex((item) => item.id === targetId);
    if (source < 0 || target < 0) return;
    const [moved] = configs.splice(source, 1);
    if (!moved) return;
    configs.splice(target, 0, moved);
    this.plugin.settings.chartConfigs = configs;
    await this.plugin.saveSettings();
    await this.onSaved();
    this.renderList();
  }
}

class HeaderActionsModal extends Modal {
  private draggedAction: HeaderAction | null = null;
  private changed = false;

  constructor(app: App, private readonly plugin: BookkeepingPlugin, private readonly onSaved: () => Promise<void>) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    this.renderLists();
  }

  onClose(): void {
    if (this.changed) void this.onSaved();
  }

  private renderLists(): void {
    this.contentEl.empty();
    this.setTitle("顶部按钮配置");
    const visible = this.plugin.settings.headerActionOrder.filter((action) => !this.plugin.settings.collapsedHeaderActions.includes(action));
    const hidden = this.plugin.settings.headerActionOrder.filter((action) => this.plugin.settings.collapsedHeaderActions.includes(action));
    this.renderActionGroup("直接显示", visible, true);
    this.renderActionGroup("收进菜单", hidden, false);
    new ButtonComponent(this.contentEl).setButtonText("完成").setCta().onClick(() => this.close());
  }

  private renderActionGroup(title: string, actions: HeaderAction[], visible: boolean): void {
    const section = this.contentEl.createDiv({ cls: "bookkeeping-header-action-section" });
    section.createEl("h4", { text: `${title}（${actions.length}）` });
    const list = section.createDiv({ cls: "bookkeeping-header-action-list" });
    list.dataset.visible = String(visible);
    if (!actions.length) list.createDiv({ cls: "bookkeeping-header-action-empty" });
    for (const action of actions) {
      const row = list.createDiv({ cls: "bookkeeping-header-action-row" });
      row.dataset.action = action;
      const grip = row.createSpan({ cls: "bookkeeping-chart-drag", attr: { title: "拖动排序" } });
      setIcon(grip, "grip-vertical");
      grip.draggable = true;
      row.createSpan({ text: this.actionLabel(action), cls: "bookkeeping-header-action-name" });
      const eye = row.createEl("button", { cls: "clickable-icon", attr: { type: "button", "aria-label": visible ? "收进三点菜单" : "直接显示" } });
      setIcon(eye, visible ? "eye" : "eye-off");
      eye.addEventListener("click", () => void this.setActionVisible(action, !visible));
      grip.addEventListener("dragstart", () => { this.draggedAction = action; row.addClass("is-dragging"); });
      grip.addEventListener("dragend", () => { this.draggedAction = null; row.removeClass("is-dragging"); this.contentEl.querySelectorAll(".is-drop-target").forEach((element) => element.classList.remove("is-drop-target")); });
      row.addEventListener("dragover", (event) => event.preventDefault());
      row.addEventListener("dragenter", () => { if (this.draggedAction && this.draggedAction !== action) row.addClass("is-drop-target"); });
      row.addEventListener("dragleave", (event) => { if (!row.contains(event.relatedTarget as Node | null)) row.removeClass("is-drop-target"); });
      row.addEventListener("drop", (event) => { event.preventDefault(); row.removeClass("is-drop-target"); if (this.draggedAction && this.draggedAction !== action) void this.moveAction(this.draggedAction, action, visible); });
      bindPointerSort({
        root: this.contentEl,
        item: row,
        handle: grip,
        itemSelector: ".bookkeeping-header-action-row",
        onCommit: (_source, target) => {
          const targetAction = target?.dataset.action as HeaderAction | undefined;
          const targetVisible = target?.parentElement?.dataset.visible === "true";
          if (targetAction && targetAction !== action) void this.moveAction(action, targetAction, targetVisible);
        }
      });
    }
    list.addEventListener("dragover", (event) => event.preventDefault());
    list.addEventListener("drop", (event) => { if (event.target === list && this.draggedAction) { event.preventDefault(); void this.moveAction(this.draggedAction, null, visible); } });
  }

  private actionLabel(action: HeaderAction): string {
    return ({ export: "导出CSV文件", import: "导入CSV文件", period: "年度统计", refresh: "刷新", tags: "标签批量管理", settings: "插件设置" } as Record<HeaderAction, string>)[action];
  }

  private async setActionVisible(action: HeaderAction, visible: boolean): Promise<void> {
    this.plugin.settings.collapsedHeaderActions = visible
      ? this.plugin.settings.collapsedHeaderActions.filter((item) => item !== action)
      : [...new Set([...this.plugin.settings.collapsedHeaderActions, action])];
    this.changed = true;
    await this.plugin.saveSettingsQuietly();
    this.renderLists();
  }

  private async moveAction(source: HeaderAction, target: HeaderAction | null, visible: boolean): Promise<void> {
    const order = [...this.plugin.settings.headerActionOrder].filter((item) => item !== source);
    const targetIndex = target ? order.indexOf(target) : -1;
    if (targetIndex >= 0) order.splice(targetIndex, 0, source);
    else {
      const group = order.filter((item) => visible !== this.plugin.settings.collapsedHeaderActions.includes(item));
      const last = group[group.length - 1];
      const index = last ? order.indexOf(last) + 1 : order.length;
      order.splice(index, 0, source);
    }
    this.plugin.settings.headerActionOrder = order;
    this.plugin.settings.collapsedHeaderActions = visible
      ? this.plugin.settings.collapsedHeaderActions.filter((item) => item !== source)
      : [...new Set([...this.plugin.settings.collapsedHeaderActions, source])];
    await this.plugin.saveSettings();
    await this.onSaved();
    this.renderLists();
  }
}

class BudgetEditorModal extends Modal {
  private value: string;

  constructor(app: App, private readonly plugin: BookkeepingPlugin, private readonly onSaved: () => Promise<void>) {
    super(app);
    this.value = Object.entries(plugin.settings.monthlyBudgets).map(([name, amount]) => `${name}=${amount}`).join("\n");
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    this.setTitle("修改预算");
    new Setting(this.contentEl).setName("预算项目").setDesc("每行填写“分类=金额”，可使用“总预算=3000”").addTextArea((area) => {
      area.inputEl.rows = 9;
      area.setValue(this.value).onChange((value) => this.value = value);
    });
    const error = this.contentEl.createDiv({ cls: "bookkeeping-form-error" });
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText("保存预算").setCta().onClick(() => { void (async () => {
      const budgets: Record<string, number> = {};
      for (const line of this.value.split("\n")) {
        if (!line.trim()) continue;
        const [rawName, rawAmount] = line.split("=");
        const name = rawName?.trim();
        const amount = Number(rawAmount?.trim());
        if (!name || !Number.isFinite(amount) || amount <= 0) {
          error.setText(`格式不合法：${line}`);
          return;
        }
        budgets[name] = roundMoney(amount);
      }
      this.plugin.settings.monthlyBudgets = budgets;
      await this.plugin.saveSettings();
      await this.onSaved();
      this.close();
    })(); });
  }
}

class ChartSettingsModal extends Modal {
  private readonly draft: DashboardChartConfig;

  constructor(
    app: App,
    private readonly plugin: BookkeepingPlugin,
    private readonly original: DashboardChartConfig,
    private readonly onSaved: () => Promise<void>
  ) {
    super(app);
    this.draft = { ...original };
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    this.renderForm();
  }

  private renderForm(): void {
    this.contentEl.empty();
    this.setTitle("自定义图表");
    new Setting(this.contentEl).setName("图表标题").addText((text) => text.setValue(this.draft.title).onChange((value) => this.draft.title = value.trim()));
    new Setting(this.contentEl).setName("图表类型").addDropdown((dropdown) => dropdown
      .addOptions({ trend: "趋势图", pie: "饼状图", calendar: "日历收支图", tag: "标签汇总", budget: "预算进度", account: "账户余额" })
      .setValue(this.draft.kind)
      .onChange((value) => {
        this.draft.kind = value as ChartKind;
        this.draft.metric = this.draft.kind === "trend" ? "expense" : this.draft.kind === "pie" ? "expenseCategory" : this.draft.kind === "tag" ? "expense" : this.draft.kind === "budget" ? "budget" : this.draft.kind === "account" ? "account" : "net";
        if (this.draft.kind === "trend") this.draft.chartType = this.draft.chartType ?? "line";
        if (this.draft.kind === "tag") this.draft.tagSort = this.draft.tagSort ?? "amountDesc";
        this.syncTitle();
        this.renderForm();
      }));
    new Setting(this.contentEl).setName("图表宽度").addDropdown((dropdown) => dropdown
      .addOptions({ half: "半宽", full: "通栏" })
      .setValue(this.draft.width)
      .onChange((value) => this.draft.width = value === "full" ? "full" : "half"));
    if (this.draft.kind === "trend") {
      new Setting(this.contentEl).setName("统计指标").addDropdown((dropdown) => dropdown
        .addOptions({ expense: "每日支出", income: "每日收入", net: "每日结余", balance: "每日余额" })
        .setValue(this.draft.metric)
        .onChange((value) => { this.draft.metric = value as TrendMetric; this.syncTitle(); this.renderForm(); }));
      new Setting(this.contentEl).setName("图表样式").addDropdown((dropdown) => dropdown
        .addOptions({ line: "折线图", area: "面积图", bar: "柱状图" })
        .setValue(this.draft.chartType ?? "line")
        .onChange((value) => this.draft.chartType = value as ChartType));
    } else if (this.draft.kind === "pie") {
      const options: Record<PieMetric, string> = {
        expenseCategory: "支出分类占比",
        incomeCategory: "收入分类占比",
        necessityExpense: "必需/非必需支出占比",
        accountExpense: "账户支出占比",
        accountIncome: "账户收入占比",
        accountBalance: "账户结余占比"
      };
      new Setting(this.contentEl).setName("统计指标").addDropdown((dropdown) => dropdown
        .addOptions(options)
        .setValue(this.draft.metric)
        .onChange((value) => { this.draft.metric = value as PieMetric; this.syncTitle(); this.renderForm(); }));
    } else if (this.draft.kind === "tag") {
      new Setting(this.contentEl).setName("标签统计指标").addDropdown((dropdown) => dropdown
        .addOptions({ expense: "标签支出金额", income: "标签收入金额", net: "标签结余金额", count: "标签账目数量" })
        .setValue(this.draft.metric)
        .onChange((value) => { this.draft.metric = value as TagMetric; this.syncTitle(); this.renderForm(); }));
      new Setting(this.contentEl).setName("标签排序").addDropdown((dropdown) => dropdown
        .addOptions({ amountDesc: "金额从高到低", amountAsc: "金额从低到高", nameAsc: "标签名正序", nameDesc: "标签名倒序" })
        .setValue(this.draft.tagSort ?? "amountDesc")
        .onChange((value) => this.draft.tagSort = value as TagSort));
    } else if (this.draft.kind === "calendar") {
      new Setting(this.contentEl).setName("日历统计指标").addDropdown((dropdown) => dropdown
        .addOptions({ net: "每日结余", expense: "每日支出", income: "每日收入" })
        .setValue(this.draft.metric)
        .onChange((value) => { this.draft.metric = value as CalendarMetric; this.syncTitle(); this.renderForm(); }));
    }
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText("保存").setCta().onClick(() => { void (async () => {
      if (!this.draft.title) this.draft.title = "自定义图表";
      if (this.draft.kind !== "trend") {
        delete this.draft.chartType;
        delete this.original.chartType;
      }
      Object.assign(this.original, this.draft);
      await this.plugin.saveSettings();
      await this.onSaved();
      this.close();
    })(); });
  }

  private syncTitle(): void {
    const metric = this.draft.metric;
    if (this.draft.kind === "trend") {
      this.draft.title = metric === "income" ? "每日收入趋势" : metric === "net" ? "每日结余趋势" : metric === "balance" ? "每日余额趋势" : "每日支出趋势";
    } else if (this.draft.kind === "pie") {
      this.draft.title = metric === "incomeCategory" ? "收入分类占比"
        : metric === "necessityExpense" ? "必需/非必需支出占比"
        : metric === "accountExpense" ? "账户支出占比"
        : metric === "accountIncome" ? "账户收入占比"
        : metric === "accountBalance" ? "账户结余占比"
        : "支出分类占比";
    } else if (this.draft.kind === "tag") {
      this.draft.title = metric === "income" ? "标签收入汇总" : metric === "net" ? "标签结余汇总" : metric === "count" ? "标签账目数量" : "标签支出汇总";
    } else if (this.draft.kind === "calendar") {
      this.draft.title = metric === "income" ? "日历收入" : metric === "expense" ? "日历支出" : "日历收支";
    } else this.draft.title = this.draft.kind === "budget" ? "预算进度" : "账户余额";
  }
}

class OpeningBalanceModal extends Modal {
  private values: Record<string, number> = {};
  private accounts: AccountConfig[] = [];
  private errorEl!: HTMLElement;

  constructor(
    app: App,
    private readonly plugin: BookkeepingPlugin,
    private readonly month: string,
    private readonly transactions: Transaction[],
    private readonly onSaved: () => Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    const opening = this.plugin.store.accountMonthlyBalances(this.transactions, this.month).opening;
    this.values = {};
    for (const [name, value] of opening) this.values[name] = value;
    this.accounts = this.plugin.settings.accounts.map((account) => ({ ...account }));
    this.renderContent();
  }

  private renderContent(): void {
    this.contentEl.empty();
    this.setTitle("账户与月初余额");
    this.contentEl.createEl("p", { text: "本月收支会在这些月初余额上加减，得到月末余额；没有单独校准的下个月会自动继承本月月末余额。", cls: "setting-item-description" });
    this.accounts.forEach((account, index) => {
      const row = new Setting(this.contentEl).setName(`${index + 1}. ${account.name}`).setDesc(`全键盘编号：${account.code}`);
      row.settingEl.addClass("bookkeeping-account-editor-row");
      row.addText((text) => {
        text.setPlaceholder("编号").setValue(account.code).onChange((value) => account.code = value.trim());
      });
      row.addText((text) => {
        text.inputEl.inputMode = "decimal";
        text.setValue(String(this.values[account.name] ?? account.initialBalance)).onChange((value) => {
          const normalized = value.trim().replace(/[，,]/g, ".");
          if (/^-?\d+(?:\.\d{0,2})?$/.test(normalized)) this.values[account.name] = Number(normalized);
          else this.values[account.name] = Number.NaN;
        });
      });
      row.addExtraButton((button) => button.setIcon("arrow-up").setTooltip("上移").setDisabled(index === 0).onClick(() => {
        const [moved] = this.accounts.splice(index, 1);
        if (moved) this.accounts.splice(index - 1, 0, moved);
        this.renderContent();
      }));
      row.addExtraButton((button) => button.setIcon("arrow-down").setTooltip("下移").setDisabled(index === this.accounts.length - 1).onClick(() => {
        const [moved] = this.accounts.splice(index, 1);
        if (moved) this.accounts.splice(index + 1, 0, moved);
        this.renderContent();
      }));
      row.addExtraButton((button) => button.setIcon("trash-2").setTooltip("删除账户配置").setDisabled(this.accounts.length <= 1).onClick(() => {
        this.accounts.splice(index, 1);
        this.renderContent();
      }));
    });
    let newName = "";
    let newCode = "";
    const add = new Setting(this.contentEl).setName("新增账户");
    add.addText((text) => text.setPlaceholder("账户名称").onChange((value) => newName = value.trim()));
    add.addText((text) => text.setPlaceholder("编号").onChange((value) => newCode = value.trim()));
    add.addButton((button) => button.setButtonText("添加").onClick(() => {
      if (!newName || this.accounts.some((account) => account.name === newName)) {
        this.plugin.notice(newName ? "账户名称不能重复" : "请输入账户名称");
        return;
      }
      if (!this.validCode(newCode)) return;
      this.accounts.push({ name: newName, code: newCode, initialBalance: 0 });
      this.values[newName] = 0;
      this.renderContent();
    }));
    this.errorEl = this.contentEl.createDiv({ cls: "bookkeeping-form-error" });
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions bookkeeping-balance-actions" });
    if (this.plugin.settings.monthlyOpeningBalances[this.month]) {
      new ButtonComponent(actions).setButtonText("清除本月校准").setDestructive().onClick(() => { void (async () => {
        delete this.plugin.settings.monthlyOpeningBalances[this.month];
        await this.plugin.saveSettings();
        await this.onSaved();
        this.close();
      })(); });
    }
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText("保存账户与余额").setCta().onClick(() => { void (async () => {
      if (this.accounts.some((account) => !Number.isFinite(this.values[account.name] ?? 0))) {
        this.errorEl.setText("余额必须是最多保留2位小数的数字，可以为负数");
        return;
      }
      if (this.accounts.some((account) => !account.code) || new Set(this.accounts.map((account) => account.code.toLocaleLowerCase())).size !== this.accounts.length) {
        this.errorEl.setText("账户编号不能为空或重复");
        return;
      }
      this.plugin.settings.accounts = this.accounts.map((account) => ({ ...account }));
      if (!this.accounts.some((account) => account.name === this.plugin.settings.defaultAccount)) this.plugin.settings.defaultAccount = this.accounts[0]?.name ?? "默认账户";
      const openingBalances: Record<string, number> = {};
      for (const account of this.accounts) openingBalances[account.name] = roundMoney(this.values[account.name] ?? 0);
      this.plugin.settings.monthlyOpeningBalances[this.month] = openingBalances;
      await this.plugin.saveSettings();
      await this.onSaved();
      this.plugin.notice("账户顺序、编号和月初余额已保存");
      this.close();
    })(); });
  }

  private validCode(code: string): boolean {
    if (!code) {
      this.plugin.notice("账户编号不能为空");
      return false;
    }
    if (this.accounts.some((account) => account.code.toLocaleLowerCase() === code.toLocaleLowerCase())) {
      this.plugin.notice("账户编号不能重复");
      return false;
    }
    return true;
  }
}

class BulkEditModal extends Modal {
  private changes: BulkEditChanges = {};
  private tagText = "";

  constructor(app: App, private readonly settings: BookkeepingSettings, private readonly count: number, private readonly onSubmit: (changes: BulkEditChanges) => void) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    this.setTitle(`批量修改${this.count}笔账目`);
    this.contentEl.createEl("p", { text: "保持“不修改”的字段不会改变。可一次修改多个字段。", cls: "setting-item-description" });
    new Setting(this.contentEl).setName("日期").addText((text) => {
      text.inputEl.type = "date";
      text.inputEl.lang = this.settings.language;
      text.onChange((value) => this.changes.date = value || undefined);
    });
    const typeOptions: Record<string, string> = { "": "不修改" };
    this.settings.typeOrder.filter((type) => type !== "转账" || this.settings.enableAccount && this.settings.accounts.length > 1).forEach((type) => typeOptions[type] = this.settings.typeLabels[type] ?? type);
    new Setting(this.contentEl).setName("类型").addDropdown((dropdown) => dropdown.addOptions(typeOptions).onChange((value) => this.changes.type = value || undefined));
    const necessityOptions: Record<string, string> = { "": "不修改" };
    for (const value of this.settings.necessityOrder) necessityOptions[value] = this.settings.necessityLabels[value] ?? value;
    new Setting(this.contentEl).setName("必要性").addDropdown((dropdown) => dropdown
      .addOptions(necessityOptions)
      .onChange((value) => this.changes.necessity = value || undefined));
    if (this.settings.enableAccount) {
      const accounts: Record<string, string> = { "": "不修改" };
      for (const account of this.settings.accounts) accounts[account.name] = account.name;
      new Setting(this.contentEl).setName("账户").addDropdown((dropdown) => dropdown.addOptions(accounts).onChange((value) => this.changes.account = value || undefined));
      new Setting(this.contentEl).setName("转入账户").setDesc("仅批量改为转账时使用").addDropdown((dropdown) => dropdown.addOptions(accounts).onChange((value) => this.changes.targetAccount = value || undefined));
    }
    if (this.settings.enableCategory) {
      const categories = [...new Set(["未分类", ...this.settings.categories, ...this.settings.incomeCategories])];
      const categoryOptions: Record<string, string> = { "": "不修改" };
      for (const category of categories) categoryOptions[category] = category;
      new Setting(this.contentEl).setName("分类").addDropdown((dropdown) => dropdown
        .addOptions(categoryOptions)
        .onChange((value) => this.changes.category = value || undefined));
    }
    new Setting(this.contentEl).setName("标签操作").addDropdown((dropdown) => dropdown
      .addOptions({ "": "不修改", add: "增加标签", remove: "删除标签", replace: "替换全部标签" })
      .onChange((value) => this.changes.tagMode = value === "add" || value === "remove" || value === "replace" ? value : undefined));
    new Setting(this.contentEl).setName("标签").addText((text) => text.setPlaceholder("多个标签用空格分隔").onChange((value) => this.tagText = value));
    const error = this.contentEl.createDiv({ cls: "bookkeeping-form-error" });
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText("应用修改").setCta().onClick(() => {
      if (this.changes.date && !normalizeDate(this.changes.date)) {
        error.setText("请选择真实存在的有效日期");
        return;
      }
      if (this.changes.date) this.changes.date = normalizeDate(this.changes.date) ?? undefined;
      const tags = [...new Set(this.tagText.split(/[\s,，]+/).map((tag) => tag.replace(/^#+/, "").trim()).filter((tag) => tag && tag !== "记账"))];
      if (this.changes.tagMode && !tags.length) {
        error.setText("选择标签操作后必须填写至少一个有效标签");
        return;
      }
      if (this.changes.tagMode) this.changes.tags = tags;
      if (!Object.values(this.changes).some((value) => value !== undefined)) {
        error.setText("请至少选择一项修改内容");
        return;
      }
      this.close();
      this.onSubmit(this.changes);
    });
  }
}

class ConfirmBatchDeleteModal extends Modal {
  constructor(app: App, private readonly count: number, private readonly onConfirm: () => void) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    this.setTitle("批量删除账目");
    this.contentEl.createEl("p", { text: `确定删除选中的${this.count}笔账目吗？` });
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText("批量删除").setDestructive().onClick(() => {
      this.close();
      this.onConfirm();
    });
  }
}

class ConfirmDeleteModal extends Modal {
  constructor(app: App, private readonly transaction: Transaction, private readonly confirm: () => void) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("bookkeeping-modal");
    this.setTitle("删除账目");
    this.contentEl.createEl("p", { text: `确定删除“${this.transaction.title}”吗？文件将移至系统回收站。` });
    const actions = this.contentEl.createDiv({ cls: "bookkeeping-modal-actions" });
    new ButtonComponent(actions).setButtonText("取消").onClick(() => this.close());
    new ButtonComponent(actions).setButtonText("删除").setDestructive().onClick(() => {
      this.close();
      this.confirm();
    });
  }
}
