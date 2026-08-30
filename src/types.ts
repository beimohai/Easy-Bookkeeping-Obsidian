import type { TFile } from "obsidian";

export type TransactionType = string;
export type Necessity = string;
export type EntryMode = "auto" | "desktop" | "mobile";
export type OptionField = "account" | "type" | "necessity" | "category" | "attachments";
export type BuiltinEntryField = "date" | OptionField | "title" | "amount" | "note";
export type CustomFieldKey = `custom:${string}`;
export type EntryField = BuiltinEntryField | CustomFieldKey;
export type FilterPersistenceMode = "none" | "current" | "monthly";
export type Language = "zh-CN" | "zh-TW" | "en" | "fr" | "ru" | "es" | "ar" | "ja" | "ko" | "de" | "pt" | "fa";
export type BuiltinTableColumn = "date" | "title" | "type" | "necessity" | "category" | "account" | "amount" | "note" | "tags" | "attachments" | "actions";
export type TableColumn = BuiltinTableColumn | CustomFieldKey;
export type TrendMetric = "expense" | "income" | "net" | "balance";
export type ChartType = "line" | "area" | "bar";
export type PieMetric = "expenseCategory" | "incomeCategory" | "necessityExpense" | "accountExpense" | "accountIncome" | "accountBalance";
export type TagMetric = "expense" | "income" | "net" | "count";
export type TagSort = "amountDesc" | "amountAsc" | "nameAsc" | "nameDesc";
export type CalendarMetric = "expense" | "income" | "net";
export type ChartKind = "trend" | "pie" | "tag" | "calendar" | "budget" | "account";
export type ChartWidth = "half" | "full";
export type ChartMetric = TrendMetric | PieMetric | TagMetric | CalendarMetric | "budget" | "account";
export type HeaderAction = "export" | "import" | "period" | "refresh" | "tags" | "settings";
export type AnnualChartMetric = "monthlyNet" | "monthlyIncome" | "monthlyExpense" | "tagExpense" | "tagIncome" | "tagNet" | "tagCount" | "accountBalance";
export type NumberGrouping = "none" | "thousand" | "wan";
export type YearMonthDisplayFormat = "YYYY-MM" | "YYYY/MM" | "YYYY.MM" | "YYYY年MM月" | "MM/YYYY" | "MM-YYYY" | "MMM YYYY";
export type DateDisplayFormat = "MM-DD" | "MM/DD" | "MM.DD" | "MM月DD日" | "DD-MM" | "DD/MM" | "DD.MM" | "YYYY-MM-DD" | "YYYY/MM/DD" | "DD/MM/YYYY" | "MM/DD/YYYY" | "DD.MM.YYYY" | "YYYY年MM月DD日";
export type TimeDisplayFormat = "24h" | "12h";
export type TypeEffect = "positive" | "negative" | "neutral";
export type CalendarWeekStart = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

export interface DashboardChartConfig {
  id: string;
  title: string;
  kind: ChartKind;
  visible: boolean;
  width: ChartWidth;
  metric: ChartMetric;
  chartType?: ChartType;
  tagSort?: TagSort;
}

export interface AnnualChartConfig {
  id: string;
  title: string;
  metric: AnnualChartMetric;
  visible: boolean;
}

export interface KeyboardShortcutConfig {
  confirm: string;
  previous: string;
  next: string;
  back: string;
  close: string;
}

export interface AccountConfig {
  name: string;
  initialBalance: number;
  code: string;
}

export type CustomFieldKind = "text" | "select";

export interface CustomFieldConfig {
  id: string;
  name: string;
  property: string;
  kind: CustomFieldKind;
  options: string[];
  optionCodes: Record<string, string>;
  defaultValue: string;
  initialOptions: string[];
  initialOptionCodes: Record<string, string>;
  initialDefaultValue: string;
  enabled: boolean;
}

const RESERVED_TRANSACTION_PROPERTIES = new Set([
  "记账插件", "账目ID", "时间", "日期", "时刻", "类型", "标签", "分类", "账户", "目标账户", "内容", "金额", "算式", "备注", "附件", "tags"
].map((property) => property.toLocaleLowerCase("zh-CN")));

export const isReservedTransactionProperty = (property: string): boolean => RESERVED_TRANSACTION_PROPERTIES.has(property.trim().toLocaleLowerCase("zh-CN"));

export const customFieldDefaultValue = (field: CustomFieldConfig): string => field.kind === "select"
  ? (field.options.includes(field.defaultValue) ? field.defaultValue : (field.options[0] ?? ""))
  : "";

export const customFieldKey = (id: string): CustomFieldKey => `custom:${id}`;
export const isCustomFieldKey = (value: string): value is CustomFieldKey => value.startsWith("custom:");
export const customFieldId = (key: CustomFieldKey): string => key.slice("custom:".length);

export interface DashboardFilterState {
  types: TransactionType[];
  necessities: Necessity[];
  categories: string[];
  accounts: string[];
  customFields: Record<string, string[]>;
  keyword: string;
  amountMin: string;
  amountMax: string;
  dateFrom: string;
  dateTo: string;
  tags: string;
  crossMonth: boolean;
  calendarDate: string;
}

export interface BookkeepingSettings {
  ledgerFolder: string;
  exportFolder: string;
  currency: string;
  incomeColor: string;
  expenseColor: string;
  numberGrouping: NumberGrouping;
  yearMonthDisplayFormat: YearMonthDisplayFormat;
  dateDisplayFormat: DateDisplayFormat;
  timeDisplayFormat: TimeDisplayFormat;
  entryMode: EntryMode;
  enableCategory: boolean;
  enableAccount: boolean;
  enableType: boolean;
  enableNecessity: boolean;
  enableNote: boolean;
  customFields: CustomFieldConfig[];
  optionFieldOrder: EntryField[];
  categories: string[];
  incomeCategories: string[];
  typeCodes: Record<TransactionType, string>;
  necessityCodes: Record<Necessity, string>;
  typeLabels: Record<TransactionType, string>;
  necessityLabels: Record<Necessity, string>;
  typeOrder: TransactionType[];
  necessityOrder: Necessity[];
  typeEffects: Record<TransactionType, TypeEffect>;
  categoryCodes: Record<string, string>;
  incomeCategoryCodes: Record<string, string>;
  accounts: AccountConfig[];
  monthlyBudgets: Record<string, number>;
  monthlyOpeningBalances: Record<string, Record<string, number>>;
  defaultType: TransactionType;
  defaultNecessity: Necessity;
  defaultCategory: string;
  defaultIncomeCategory: string;
  defaultAccount: string;
  desktopContinuousEntry: boolean;
  mobileContinuousEntry: boolean;
  openDashboardAfterEntry: boolean;
  allowNumericTitle: boolean;
  allowEmptyAmount: boolean;
  tableColumnOrder: TableColumn[];
  visibleTableColumns: TableColumn[];
  tableColumnLabels: Record<string, string>;
  tableColumnWidths: Partial<Record<string, number>>;
  chartConfigs: DashboardChartConfig[];
  annualChartConfigs: AnnualChartConfig[];
  showBudgetPanel: boolean;
  showAccountPanel: boolean;
  enableInlineEditing: boolean;
  editableColumns: TableColumn[];
  enableEntryAttachments: boolean;
  attachmentFolder: string;
  saveExpressionInNote: boolean;
  undoDeleteSeconds: number;
  confirmDelete: boolean;
  showEditAction: boolean;
  showOpenAction: boolean;
  showDeleteAction: boolean;
  keyboardShortcuts: KeyboardShortcutConfig;
  collapsedHeaderActions: HeaderAction[];
  headerActionOrder: HeaderAction[];
  calendarWeekStart: CalendarWeekStart;
  showFloatingBackToTop: boolean;
  language: Language;
  filterPersistence: FilterPersistenceMode;
  saveFiltersOnExit: boolean;
  lastDashboardMonth: string;
  savedDashboardAdvancedFilters: boolean;
  savedMonthlyDashboardAdvancedFilters: Record<string, boolean>;
  savedDashboardFilters: DashboardFilterState;
  savedMonthlyDashboardFilters: Record<string, DashboardFilterState>;
  disabledLanguages: Language[];
  ribbonPosition: number;
  allowDuplicateContent: boolean;
  customTags: string[];
}

export function canRecordTransfer(settings: Pick<BookkeepingSettings, "enableType" | "enableAccount" | "accounts">): boolean {
  return settings.enableType && settings.enableAccount && settings.accounts.length > 1;
}

export interface TransactionDraft {
  date: string;
  time: string;
  type: TransactionType;
  necessity: Necessity;
  category: string;
  account: string;
  targetAccount: string;
  title: string;
  amount: number;
  expression: string;
  note: string;
  tags: string[];
  attachments: string[];
  customValues: Record<string, string>;
  customProperties?: Record<string, string>;
}

export interface Transaction extends TransactionDraft {
  id: string;
  file: TFile;
  legacy: boolean;
}

export interface MonthSummary {
  income: number;
  expense: number;
  balance: number;
  expenseCount: number;
  incomeCount: number;
  byCategory: Map<string, number>;
  byDay: Map<string, number>;
}

export const DEFAULT_SETTINGS: BookkeepingSettings = {
  ledgerFolder: "记账",
  exportFolder: "记账/导出",
  currency: "¥",
  incomeColor: "#d9363e",
  expenseColor: "#2f6bff",
  numberGrouping: "wan",
  yearMonthDisplayFormat: "YYYY年MM月",
  dateDisplayFormat: "MM-DD",
  timeDisplayFormat: "24h",
  entryMode: "auto",
  enableCategory: false,
  enableAccount: false,
  enableType: true,
  enableNecessity: true,
  enableNote: true,
  customFields: [],
  optionFieldOrder: ["date", "account", "type", "necessity", "category", "title", "amount", "note", "attachments"],
  categories: ["未分类", "餐饮", "交通", "购物", "居住", "医疗", "学习", "娱乐", "人情", "其他"],
  incomeCategories: ["工资", "奖金", "报销", "理财", "兼职", "其他收入"],
  typeCodes: { "支出": "1", "收入": "2", "转账": "3" },
  necessityCodes: { "必需": "1", "非必需": "2" },
  typeLabels: { "支出": "支出", "收入": "收入", "转账": "转账" },
  necessityLabels: { "必需": "必需", "非必需": "非必需" },
  typeOrder: ["支出", "收入", "转账"],
  necessityOrder: ["必需", "非必需"],
  typeEffects: { "支出": "negative", "收入": "positive", "转账": "neutral" },
  categoryCodes: { "未分类": "0", "餐饮": "1", "交通": "2", "购物": "3", "居住": "4", "医疗": "5", "学习": "6", "娱乐": "7", "人情": "8", "其他": "9" },
  incomeCategoryCodes: { "工资": "1", "奖金": "2", "报销": "3", "理财": "4", "兼职": "5", "其他收入": "6" },
  accounts: [{ name: "默认账户", initialBalance: 0, code: "1" }],
  monthlyBudgets: {},
  monthlyOpeningBalances: {},
  defaultType: "支出",
  defaultNecessity: "必需",
  defaultCategory: "未分类",
  defaultIncomeCategory: "工资",
  defaultAccount: "默认账户",
  desktopContinuousEntry: true,
  mobileContinuousEntry: true,
  openDashboardAfterEntry: true,
  allowNumericTitle: false,
  allowEmptyAmount: false,
  tableColumnOrder: ["date", "title", "type", "necessity", "category", "account", "amount", "note", "tags", "attachments", "actions"],
  visibleTableColumns: ["date", "title", "type", "necessity", "amount", "note", "actions"],
  tableColumnLabels: {
    date: "日期",
    title: "内容",
    type: "类型",
    necessity: "必要性",
    category: "分类",
    account: "账户",
    amount: "金额",
    note: "备注",
    tags: "标签",
    attachments: "附件",
    actions: "操作"
  },
  tableColumnWidths: {},
  chartConfigs: [
    { id: "trend", title: "每日结余趋势", kind: "trend", visible: true, width: "half", chartType: "line", metric: "net" },
    { id: "calendar", title: "日历收支", kind: "calendar", visible: true, width: "half", metric: "net" },
    { id: "category-pie", title: "支出分类占比", kind: "pie", visible: false, width: "half", metric: "expenseCategory" },
    { id: "tag-summary", title: "标签汇总", kind: "tag", visible: false, width: "half", metric: "expense" },
    { id: "budget", title: "预算进度", kind: "budget", visible: false, width: "half", metric: "budget" },
    { id: "account", title: "账户余额", kind: "account", visible: false, width: "half", metric: "account" }
  ],
  annualChartConfigs: [
    { id: "annual-monthly-net", title: "月份结余趋势", metric: "monthlyNet", visible: true }
  ],
  showBudgetPanel: true,
  showAccountPanel: true,
  enableInlineEditing: false,
  editableColumns: ["date", "title", "type", "necessity", "category", "account", "amount", "note", "tags"],
  enableEntryAttachments: false,
  attachmentFolder: "记账/附件",
  saveExpressionInNote: false,
  undoDeleteSeconds: 5,
  confirmDelete: true,
  showEditAction: true,
  showOpenAction: true,
  showDeleteAction: true,
  keyboardShortcuts: {
    confirm: "Enter",
    previous: "ArrowUp",
    next: "ArrowDown",
    back: "Ctrl+Z",
    close: "Escape"
  },
  collapsedHeaderActions: ["export", "import"],
  headerActionOrder: ["export", "import", "period", "refresh", "tags", "settings"],
  calendarWeekStart: "sunday",
  showFloatingBackToTop: true,
  language: "zh-CN",
  filterPersistence: "current",
  saveFiltersOnExit: true,
  lastDashboardMonth: "",
  savedDashboardAdvancedFilters: false,
  savedMonthlyDashboardAdvancedFilters: {},
  savedDashboardFilters: {
    types: [], necessities: [], categories: [], accounts: [], customFields: {}, keyword: "",
    amountMin: "", amountMax: "", dateFrom: "", dateTo: "", tags: "", crossMonth: false, calendarDate: ""
  },
  savedMonthlyDashboardFilters: {},
  disabledLanguages: [],
  ribbonPosition: -1,
  allowDuplicateContent: true,
  customTags: []
};

export const OPTION_FIELD_LABELS: Record<OptionField, string> = {
  account: "账户",
  type: "类型",
  necessity: "必要性",
  category: "分类",
  attachments: "附件"
};

export const ENTRY_FIELD_LABELS: Record<BuiltinEntryField, string> = {
  date: "日期",
  account: "账户",
  type: "类型",
  necessity: "必要性",
  category: "分类",
  attachments: "附件",
  title: "内容",
  amount: "金额",
  note: "备注"
};

export const TABLE_COLUMN_LABELS: Record<BuiltinTableColumn, string> = {
  date: "日期",
  title: "内容",
  type: "类型",
  necessity: "必要性",
  category: "分类",
  account: "账户",
  amount: "金额",
  note: "备注",
  tags: "标签",
  attachments: "附件",
  actions: "操作"
};
