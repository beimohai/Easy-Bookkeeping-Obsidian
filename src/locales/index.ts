import type { Language } from "../types";
import { SETTINGS_TRANSLATIONS } from "./settings";

export const LANGUAGE_OPTIONS: Record<Language, string> = {
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  en: "English",
  fr: "Français",
  ru: "Русский",
  es: "Español",
  ar: "العربية",
  ja: "日本語",
  ko: "한국어",
  de: "Deutsch",
  pt: "Português",
  fa: "فارسی"
};

const EN: Record<string, string> = {
  "通用": "General",
  "插件语言": "Plugin language",
  "简体中文": "Simplified Chinese",
  "繁體中文": "Traditional Chinese",
  "退出后是否保存界面": "Keep dashboard state after closing",
  "不保持": "Do not keep",
  "保持当前筛选": "Keep current filters",
  "保持当月界面": "Keep the current month view",
  "语言包管理": "Language packs",
  "管理语言包": "Manage language packs",
  "删除后将从语言选项中隐藏，可随时恢复。简体中文为内置基础语言。": "Removed languages are hidden from the language selector and can be restored at any time. Simplified Chinese is built in.",
  "删除的语言包会从语言列表隐藏，之后仍可在这里恢复。": "Removed language packs are hidden from the language list and can be restored here later.",
  "内置基础语言": "Built-in base language",
  "已安装": "Installed",
  "已删除": "Removed",
  "内置": "Built in",
  "恢复": "Restore",
  "返回顶部按钮": "Back-to-top button",
  "返回顶部": "Back to top",
  "返回仪表盘顶部": "Back to dashboard top",
  "自动识别设备": "Detect device automatically",
  "收入颜色": "Income color",
  "支出颜色": "Expense color",
  "赞助与支持": "Support the project",
  "打开赞助面板": "Open support panel",
  "问题反馈": "Feedback",
  "打开反馈面板": "Open feedback panel",
  "录入": "Entry",
  "录入方式": "Entry mode",
  "记账方式": "Entry interface",
  "桌面版": "Desktop",
  "手机版": "Mobile",
  "桌面版为全程键盘记账；手机版为完整表单记账。": "Desktop uses a keyboard-only flow; mobile uses a full form.",
  "桌面版连续记账": "Continuous desktop entry",
  "手机版连续记账": "Continuous mobile entry",
  "手机版保存后打开仪表盘": "Open dashboard after mobile entry",
  "允许内容重复": "Allow duplicate descriptions",
  "关闭后，新建或修改账目时不允许与同日账目使用相同内容。": "When disabled, transactions on the same date cannot share a description.",
  "允许内容为纯数字": "Allow numeric-only descriptions",
  "关闭后，内容只输入数字会提示重新填写。": "When disabled, descriptions containing only digits must be re-entered.",
  "允许金额为空": "Allow empty amounts",
  "开启后，金额留空会按0保存；关闭后必须输入金额或算式。": "When enabled, an empty amount is saved as 0. When disabled, an amount or expression is required.",
  "录入字段与顺序": "Entry fields and order",
  "录入预设": "Entry presets",
  "账户": "Account",
  "类型": "Type",
  "必要性": "Necessity",
  "分类": "Category",
  "附件": "Attachment",
  "拖动文件到此处，或点击选择文件": "Drop files here, or click to choose files",
  "账目明细": "Transaction details",
  "账目数量": "Transaction count",
  "账目数": "Transaction count",
  "笔": " transactions",
  "时间": "Time",
  "时刻": "Time",
  "正序": " ascending",
  "倒序": " descending",
  "已锁定": " · locked",
  "已解锁": " · unlocked",
  "解除日期主排序锁": "Unlock date as primary sort",
  "锁定日期为主排序": "Lock date as primary sort",
  "明细行为": "Table behavior",
  "恢复默认列宽": "Restore default widths",
  "已恢复账目明细自动列宽": "Automatic column widths restored",
  "启用行内编辑": "Enable inline editing",
  "删除前二次确认": "Confirm before deletion",
  "撤销删除时间": "Undo deletion duration",
  "可设置为0-15秒，只能设置为整数。": "Enter an integer from 0 to 15 seconds.",
  "秒": "sec",
  "显示编辑按钮": "Show edit button",
  "显示打开Markdown按钮": "Show open Markdown button",
  "显示删除按钮": "Show delete button",
  "表头顺序": "Column order",
  "拖动左侧滑块调整顺序；右侧眼睛控制是否显示，铅笔控制能否行内编辑。": "Drag the left handle to reorder. The eye controls visibility and the pencil controls inline editing.",
  "表头名称": "Column name",
  "显示 / 编辑": "Show / Edit",
  "界面与格式": "Interface and formats",
  "金额格式": "Amount format",
  "货币符号": "Currency symbol",
  "仅修改符号，不转换金额。": "Changes the symbol only; amounts are not converted.",
  "金额分位方式": "Digit grouping",
  "中文万位分组（1,0000）": "Chinese 4-digit grouping (1,0000)",
  "国际千位分组（10,000）": "International 3-digit grouping (10,000)",
  "不使用分隔符（10000）": "No separator (10000)",
  "日期、时间与星期": "Date, time and week",
  "年月格式": "Year-month format",
  "用于仪表盘的月份选择。": "Used by the dashboard month selector.",
  "账目日期格式": "Transaction date format",
  "用于账目明细、汇总和图表提示。": "Used in details, summaries and chart tooltips.",
  "时间格式": "Time format",
  "24小时制（18:30）": "24-hour (18:30)",
  "12小时制（06:30 PM）": "12-hour (06:30 PM)",
  "每周起始日": "First day of week",
  "周日": "Sunday",
  "周一": "Monday",
  "周二": "Tuesday",
  "周三": "Wednesday",
  "周四": "Thursday",
  "周五": "Friday",
  "周六": "Saturday",
  "数据与文件": "Data and files",
  "存储目录": "Storage folders",
  "账目存储目录": "Transaction folder",
  "CSV导出目录": "CSV export folder",
  "附件存储目录": "Attachment folder",
  "Markdown算式存储": "Markdown expression storage",
  "把算式写入备注": "Write expressions to notes",
  "快捷键": "Shortcuts",
  "桌面版记账快捷键": "Desktop entry shortcuts",
  "确认 / 下一步": "Confirm / Next",
  "上一个选项": "Previous option",
  "下一个选项": "Next option",
  "返回上一步": "Go back",
  "关闭": "Close",
  "打开仪表盘": "Open dashboard",
  "打开记账仪表盘": "Open bookkeeping dashboard",
  "开始记账": "Add transaction",
  "开始记账（使用默认界面）": "Add transaction using the default interface",
  "桌面版全键盘连续记账": "Continuous keyboard entry",
  "手机端表单记账": "Mobile form entry",
  "转换旧版账目为新版Properties": "Convert legacy transactions to new Properties",
  "从CSV导入账目": "Import transactions from CSV",
  "批量管理标签": "Manage tags in bulk",
  "查看年度统计": "View annual statistics",
  "导入CSV文件": "Import CSV",
  "导出CSV文件": "Export CSV",
  "刷新仪表盘": "Refresh dashboard",
  "作者GitHub主页": "Author GitHub",
  "作者B站主页": "Author Bilibili",
  "打开GitHub": "Open GitHub",
  "打开B站": "Open Bilibili",
  "打开GitHub Issues": "Open GitHub Issues",
  "作者：北漠海": "Author: Beimohai",
  "作者": "Author",
  "版本": "Version",
  "版本号": "Version",
  "最近更新": "Last updated",
  "更新日期": "Updated",
  "更新日期：2026-08-18": "Updated: 2026-08-18",
  "本项目基于 MIT License 开源": "Open source under the MIT License",
  "拖动排序": "Drag to reorder",
  "切换表头显示": "Toggle column visibility",
  "切换行内编辑": "Toggle inline editing",
  "点击后按下快捷键": "Click and press a shortcut",
  "请按下快捷键…": "Press a shortcut…",
  "还原默认": "Restore default",
  "还原为未设置": "Reset to unset",
  "还原默认快捷键": "Restore default shortcut",
  "保存": "Save",
  "取消": "Cancel",
  "完成": "Done",
  "确认": "Confirm",
  "删除": "Delete",
  "编辑": "Edit",
  "添加": "Add",
  "配置": "Configure",
  "刷新": "Refresh",
  "重命名": "Rename",
  "清除筛选": "Clear filters",
  "筛选": "Filter",
  "搜索内容、备注或标签": "Search description, notes or tags",
  "基础筛选": "Basic filters",
  "跨月筛选全部账目": "Search transactions across months",
  "最小金额（含）": "Minimum amount (inclusive)",
  "最大金额（含）": "Maximum amount (inclusive)",
  "起始日期（含）": "Start date (inclusive)",
  "结束日期（含）": "End date (inclusive)",
  "日期范围": "Date range",
  "金额范围": "Amount range",
  "全部账目": "All transactions",
  "全部": "All ",
  "本月": "This month",
  "本月收入": "Monthly income",
  "本月支出": "Monthly expense",
  "本月结余": "Monthly net",
  "筛选收入": "Filtered income",
  "筛选支出": "Filtered expense",
  "筛选结余": "Filtered net",
  "收入": "Income",
  "支出": "Expense",
  "转账": "Transfer",
  "必需": "Essential",
  "非必需": "Non-essential",
  "日期": "Date",
  "内容": "Description",
  "金额": "Amount",
  "备注": "Notes",
  "标签": "Tags",
  "操作": "Actions",
  "结余": "Net",
  "余额": "Balance",
  "预算进度": "Budget progress",
  "账户余额": "Account balances",
  "标签汇总": "Tag summary",
  "日历收支": "Income and expense calendar",
  "每日结余趋势": "Daily net trend",
  "每日收入趋势": "Daily income trend",
  "每日支出趋势": "Daily expense trend",
  "每日余额趋势": "Daily balance trend",
  "月份结余趋势": "Monthly net trend",
  "支出分类占比": "Expense by category",
  "收入分类占比": "Income by category",
  "账户支出占比": "Expense by account",
  "账户收入占比": "Income by account",
  "账户结余占比": "Net by account",
  "标签账目数量": "Transaction count by tag",
  "图表管理": "Manage charts",
  "仪表盘图表配置": "Dashboard chart settings",
  "配置仪表盘图表": "Configure dashboard charts",
  "顶部按钮配置": "Top button settings",
  "配置顶部按钮": "Configure top buttons",
  "图表内容": "Chart content",
  "图表宽度": "Chart width",
  "图表标题": "Chart title",
  "图表样式": "Chart style",
  "图表类型": "Chart type",
  "添加图表": "Add chart",
  "显示图表": "Show charts",
  "直接显示": "Show directly",
  "收进菜单": "Move to menu",
  "收进三点菜单": "Move to the More menu",
  "配置年度图表": "Configure annual chart",
  "年度图表管理": "Manage annual charts",
  "统计指标": "Metric",
  "统计年份": "Statistics year",
  "日历统计指标": "Calendar metric",
  "标签统计指标": "Tag metric",
  "标签排序": "Tag sorting",
  "标签名正序": "Tag name ascending",
  "标签名倒序": "Tag name descending",
  "金额从低到高": "Amount ascending",
  "金额从高到低": "Amount descending",
  "名称": "Name",
  "编号": "Code",
  "默认录入值": "Default entry value",
  "计入方式": "Balance effect",
  "不计入": "Exclude from balance",
  "不修改": "No change",
  "分类板块": "Category group",
  "支出分类": "Expense categories",
  "收入分类": "Income categories",
  "分类名称": "Category name",
  "账户名称": "Account name",
  "类型名称": "Type name",
  "必要性名称": "Necessity name",
  "新增账户": "Add account",
  "删除账户": "Delete account",
  "保存修改": "Save changes",
  "应用修改": "Apply changes",
  "修改预算": "Edit budget",
  "总预算": "Total budget",
  "保存预算": "Save budget",
  "预算项目": "Budget item",
  "全选": "Select all",
  "取消选择": "Cancel selection",
  "选择全部可见账目": "Select all visible transactions",
  "账目明细上方横向滚动条": "Top horizontal scrollbar for transactions",
  "账目明细下方横向滚动条": "Bottom horizontal scrollbar for transactions",
  "范围筛选": "Range filters",
  "可使用空格分隔多个关键词": "Separate multiple keywords with spaces",
  "多个标签用空格分隔": "Separate tags with spaces",
  "导入": "Import",
  "导出": "Export",
  "导出位置": "Export location",
  "导出范围": "Export scope",
  "文件名": "File name",
  "来源": "Source",
  "旧版账目位置": "Legacy transaction location",
  "转换来源": "Conversion source",
  "当前Obsidian仓库": "Current Obsidian vault",
  "Obsidian仓库内": "Inside the Obsidian vault",
  "电脑任意位置": "Anywhere on this computer",
  "电脑外部文件夹": "External computer folder",
  "仓库内导出路径": "Vault export path",
  "开始导入": "Start import",
  "开始转换": "Start conversion",
  "转换并继续导入": "Convert and continue import",
  "转换前建议备份！": "Back up your data before conversion!",
  "CSV文件": "CSV file",
  "CSV导入账目": "CSV transaction import",
  "CSV导出失败，请检查保存目录": "CSV export failed. Check the destination folder.",
  "CSV导入失败，请检查文件格式": "CSV import failed. Check the file format.",
  "GitHub暂无可用Release": "No GitHub release is available",
  "GitHub没有返回有效的Release版本": "GitHub did not return a valid release version",
  "以后再说": "Later",
  "暂不更新": "Not now",
  "查看发布页": "View release page",
  "更多仪表盘操作": "More dashboard actions",
  "插件设置": "Plugin settings",
  "重新扫描": "Rescan",
  "仪表盘已刷新": "Dashboard refreshed",
  "当前筛选没有账户": "No accounts match the current filters",
  "本月暂无对应数据": "No matching data this month",
  "没有符合条件的账目": "No matching transactions",
  "尚未显示年度图表，可点击上方“图表管理”添加。": "No annual charts are visible. Use Manage charts above to add one.",
  "未启用任何账目明细列，请在插件设置中选择。": "No transaction columns are enabled. Choose columns in plugin settings.",
  "可留空": "Optional",
  "选择文件夹": "Choose folder",
  "打开原始Markdown": "Open source Markdown",
  "查看附件": "View attachment",
  "选择小票或发票附件": "Choose receipt or invoice attachment",
  "拖动小票或发票到这里，或点击选择文件": "Drop a receipt or invoice here, or click to choose a file",
  "配置图表": "Configure chart",
  "隐藏图表": "Hide chart",
  "删除图表": "Delete chart",
  "复制图表": "Duplicate chart",
  "半宽": "Half width",
  "通栏": "Full width",
  "折线图": "Line chart",
  "柱状图": "Bar chart",
  "面积图": "Area chart",
  "饼状图": "Pie chart",
  "年度统计": "Annual statistics",
  "选择仪表盘月份": "Select dashboard month",
  "记账仪表盘": "Bookkeeping dashboard",
  "开始建立你的第一笔账目": "Create your first transaction",
  "记第一笔": "Add first transaction",
  "未分类": "Uncategorized",
  "默认账户": "Default account",
  "选择附件": "Choose attachment",
  "添加附件": "Add attachment",
  "编辑账目": "Edit transaction",
  "保存账目": "Save transaction",
  "账目已更新": "Transaction updated",
  "删除账目": "Delete transaction",
  "批量修改": "Bulk edit",
  "批量删除": "Bulk delete",
  "标签批量管理": "Manage tags",
  "导入CSV账目": "Import CSV transactions",
  "导出记账CSV": "Export bookkeeping CSV",
  "转换旧版账目": "Convert legacy transactions",
  "当前已是最新版本": "You are using the latest version",
  "更新失败": "Update failed",
  "清空筛选": "Clear filters",
  "筛选账目": "Filter transactions",
  "账目明细横向滚动条": "Transaction table horizontal scroll",
  "可以直接记一笔，也可以从其他记账软件导出的CSV开始。所有数据都会保存在本地Markdown中。": "Add a transaction directly or begin with a CSV exported by another bookkeeping app. All data is stored locally in Markdown.",
  "合计": "Total",
  "未设置账户": "Account not set",
  "本月账目没有附加标签": "No tags were added to this month's transactions",
  "管理账户与月初余额": "Manage accounts and opening balances",
  "账户与月初余额": "Accounts and opening balances",
  "保存账户与余额": "Save accounts and balances",
  "月初": "Opening",
  "月末": "Closing",
  "超支": "Over budget",
  "已用": "Used",
  "无": "—",
  "按时间排序": "Sort by time",
  "上移": "Move up",
  "下移": "Move down",
  "删除账户配置": "Delete account configuration",
  "清除本月校准": "Clear this month's adjustment",
  "改为半宽": "Use half width",
  "改为通栏": "Use full width",
  "自定义趋势图": "Custom trend chart",
  "趋势图": "Trend chart",
  "日历收支图": "Income and expense calendar",
  "每日支出": "Daily expense",
  "每日收入": "Daily income",
  "每日结余": "Daily net",
  "每日余额": "Daily balance",
  "日历支出": "Calendar expense",
  "日历收入": "Calendar income",
  "必需/非必需支出占比": "Essential vs non-essential expenses",
  "标签收入汇总": "Income by tag",
  "标签支出汇总": "Expense by tag",
  "标签结余汇总": "Net by tag",
  "标签收入金额": "Tag income",
  "标签支出金额": "Tag expense",
  "标签结余金额": "Tag net",
  "月份收入趋势": "Monthly income trend",
  "月份支出趋势": "Monthly expense trend",
  "自定义图表": "Custom chart",
  "图表": "Chart",
  "月份": "Month",
  "日": "Sun",
  "一": "Mon",
  "二": "Tue",
  "三": "Wed",
  "四": "Thu",
  "五": "Fri",
  "六": "Sat",
  "尚无可管理的附加标签。": "There are no tags to manage.",
  "从此账目删除标签": "Remove tag from this transaction",
  "全局重命名此标签": "Rename this tag everywhere",
  "返回标签管理": "Back to tag management",
  "标签操作": "Tag action",
  "仅移除标签": "Remove tag only",
  "删除相关账目": "Delete matching transactions",
  "增加标签": "Add tags",
  "替换全部标签": "Replace all tags",
  "修改日期": "Change date",
  "修改金额（收支符号保持不变）": "Change amount (income/expense sign is preserved)",
  "金额数值": "Amount value",
  "金额或算式不合法": "The amount or expression is invalid",
  "符号不可修改": "The income/expense sign cannot be changed",
  "新增标签": "Add tag",
  "已撤销删除": "Deletion undone",
  "撤销": "Undo",
  "删除失败，请重新扫描后再试": "Deletion failed. Rescan and try again.",
  "文件夹已存在，请重新扫描后再试": "The folder already exists. Rescan and try again.",
  "批量修改失败，请重新扫描后再试": "Bulk edit failed. Rescan and try again.",
  "批量删除失败，请重新扫描后再试": "Bulk deletion failed. Rescan and try again.",
  "日期无效": "Invalid date",
  "日期无效，请选择真实存在的日期": "Invalid date. Choose a real calendar date.",
  "时间无效": "Invalid time",
  "金额只能输入非负数字，且最多保留两位小数": "Enter a non-negative amount with no more than two decimal places",
  "最大金额必须大于或等于最小金额": "The maximum amount must be greater than or equal to the minimum",
  "结束日期必须大于或等于开始日期": "The end date must be on or after the start date",
  "选择": "Select",
  "打开": "Open",
  "未命名": "Untitled",
  "其他": "Other",
  "默认": "Default",
  "继续": "Continue",
  "信息": "Information",
  "重复账目": "Duplicate transactions",
  "准备修改…": "Preparing changes…",
  "准备删除账目…": "Preparing deletion…",
  "准备扫描…（0%）": "Preparing scan… (0%)",
  "准备转换…（0%）": "Preparing conversion… (0%)",
  "正在读取CSV…（0%）": "Reading CSV… (0%)",
  "正在转换旧版账目": "Converting legacy transactions",
  "操作失败，请稍后重试": "Operation failed. Try again later.",
  "操作超时，请检查环境后重试": "The operation timed out. Check the environment and try again.",
  "请稍后重试": "Try again later",
  "转入账户": "Destination account",
  "仅批量改为转账时使用": "Used only when bulk-changing transactions to transfers",
  "每行填写“分类=金额”，可使用“总预算=3000”": "Enter one “category=amount” per line. You may use “total budget=3000”.",
  "本月收支会在这些月初余额上加减，得到月末余额；没有单独校准的下个月会自动继承本月月末余额。": "This month's income and expenses are applied to these opening balances to calculate closing balances. The next month inherits them unless adjusted separately.",
  "保持“不修改”的字段不会改变。可一次修改多个字段。": "Fields set to “No change” remain unchanged. You can update multiple fields at once.",
  "选择外部旧版账目文件夹": "Choose an external legacy transaction folder",
  "选择“以后再说”只影响新建或再次编辑的账目。": "Choosing “Later” affects only newly created or subsequently edited transactions.",
  "转换现有文件": "Convert existing files",
  "必须包含日期和金额。无法导入的行会生成带原因的失败报告。": "Date and amount are required. Rows that cannot be imported will be listed with reasons in a failure report.",
  "CSV元数据与当前仓库预设不一致": "CSV metadata does not match the current vault presets",
  "继续后会把未知类型、必要性、分类和账户转换为当前仪表盘的对应默认值。是否继续导入？": "Unknown types, necessities, categories and accounts will be converted to the current dashboard defaults. Continue importing?",
  "“仅移除标签”会保留账目；“删除相关账目”会把所有包含该标签的账目移入系统回收站。": "“Remove tag only” keeps the transactions. “Delete matching transactions” moves every transaction with this tag to the system trash.",
  "该年度暂无可统计数据": "No data is available for this year",
  "拖动文件到这里，或点击选择": "Drop a file here or click to choose",
  "账目已移至系统回收站": "Transaction moved to the system trash",
  "内容不能为空或纯数字": "Description cannot be empty or contain only numbers",
  "记账": "Bookkeeping",
  "账户名称不能重复": "Account names must be unique",
  "请输入账户名称": "Enter an account name",
  "余额必须是最多保留2位小数的数字，可以为负数": "Balance must be a number with at most two decimal places and may be negative",
  "账户编号不能为空或重复": "Account code cannot be empty or duplicated",
  "账户顺序、编号和月初余额已保存": "Account order, codes, and opening balances saved",
  "账户编号不能为空": "Account code cannot be empty",
  "账户编号不能重复": "Account codes must be unique",
  "请选择真实存在的有效日期": "Choose a valid calendar date",
  "选择标签操作后必须填写至少一个有效标签": "Enter at least one valid tag after choosing a tag action",
  "请至少选择一项修改内容": "Choose at least one field to change",
  "批量删除账目": "Delete transactions in bulk",
  "桌面版记账": "Desktop entry",
  "请输入账目内容": "Enter transaction description",
  "请输入账目内容（不能为纯数字）": "Enter transaction description (not numeric-only)",
  "请输入备注，可以留空": "Enter notes, optional",
  "请输入金额或算式": "Enter an amount or expression",
  "请输入类型编号或完整名称": "Enter the type code or full name",
  "请输入必要性编号或完整名称": "Enter the necessity code or full name",
  "金额不得为空": "Amount cannot be empty",
  "金额或算式无效": "Invalid amount or expression",
  "内容不能为纯数字": "Description cannot contain only numbers",
  "请输入选项编号或完整名称": "Enter an option code or its full name",
  "输入无效，请检查当前步骤": "Invalid input. Check the current step",
  "转入账户不能与转出账户相同": "Destination account must differ from the source account",
  "输入日期中的日，例如21": "Enter the day of the month, for example 21",
  "输入编号，直接回车使用默认值": "Enter a code, or press Enter to use the default",
  "输入账目内容": "Enter transaction description",
  "输入金额或算式，例如11.4+5.1": "Enter an amount or expression, for example 11.4+5.1",
  "输入备注；无备注直接回车": "Enter notes, or press Enter for none",
  "输入日期": "Enter date",
  "输入内容": "Enter description",
  "输入金额": "Enter amount",
  "输入备注": "Enter notes",
  "请输入内容": "Enter a description",
  "无法确定插件安装目录": "Unable to locate the plugin installation folder",
  "Tag汇总": "Tag summary",
  "请选择仓库内旧账目录": "Choose the legacy transaction folder in the vault",
  "请先选择外部旧账文件夹": "Choose an external legacy transaction folder first",
  "旧版账目转换失败": "Legacy transaction conversion failed",
  "所选目录没有检测到旧版账目": "No legacy transactions were found in the selected folder",
  "所选外部文件夹中没有Markdown文件": "No Markdown files were found in the selected external folder",
  "当前环境无法打开系统文件夹选择窗口": "The system folder picker is unavailable in this environment",
  "当前Obsidian版本不支持系统文件夹选择窗口": "This Obsidian version does not support the system folder picker",
  "当前环境无法读取外部文件夹": "External folders cannot be read in this environment",
  "同步现有账目的算式格式？": "Synchronize expression storage for existing transactions?",
  "设置已经启用。是否把现有账目的算式同步写入备注？": "This option is now enabled. Write existing expressions into notes?",
  "设置已经关闭。是否从现有账目的备注中移除自动写入的算式行，并移除专门的算式属性？": "This option is now disabled. Remove automatically written expression lines from notes and remove the dedicated expression property?",
  "自定义日期范围": "Custom date range",
  "保存目录不能为空": "Destination folder cannot be empty",
  "文件名不能为空": "File name cannot be empty",
  "请选择有效且先后顺序正确的日期范围": "Choose a valid date range in chronological order",
  "当前环境无法打开系统保存对话框": "The system save dialog is unavailable in this environment",
  "当前Obsidian版本不支持系统保存对话框": "This Obsidian version does not support the system save dialog",
  "账目导出": "Transaction export",
  "已取消导出": "Export canceled",
  "账目": "Transactions",
  "撤销删除时间必须是0—15秒的整数": "Undo duration must be an integer from 0 to 15 seconds",
  "打开Easy Bookkeeping GitHub主页": "Open the Easy Bookkeeping GitHub page",
  "启用": "Enable",
  "微信与支付宝收款码": "WeChat Pay and Alipay payment codes",
  "QQ群588526922二维码": "QR code for QQ group 588526922",
  "类型名称不能重复": "Type names must be unique",
  "类型名称不能为空": "Type name cannot be empty",
  "必要性名称不能重复": "Necessity names must be unique",
  "必要性名称不能为空": "Necessity name cannot be empty",
  "分类名称不能重复": "Category names must be unique",
  "分类名称不能为空": "Category name cannot be empty",
  "账户名称不能为空": "Account name cannot be empty",
  "编号不能为空": "Code cannot be empty",
  "同一组选项的编号不能重复": "Codes within the same option group must be unique",
  "新类型名称": "New type name",
  "新必要性名称": "New necessity name",
  "新分类名称": "New category name",
  "新账户名称": "New account name",
  "名称和编号不能为空": "Name and code cannot be empty",
  "类型名称或编号不能重复": "Type name and code must be unique",
  "必要性名称或编号不能重复": "Necessity name and code must be unique",
  "账户名称或编号不能重复": "Account name and code must be unique",
  "分类名称或编号不能重复": "Category name and code must be unique",
  "账目保存失败，请检查输入和存储目录": "Transaction could not be saved. Check the input and storage folder",
  "请选择有效时间": "Choose a valid time",
  "请选择账户": "Choose an account",
  "转出账户和转入账户不能相同": "Source and destination accounts must differ",
  "已记录：": "Recorded: ",
  "待上传文件": "pending upload ",
  "餐饮": "Dining",
  "交通": "Transportation",
  "购物": "Shopping",
  "居住": "Housing",
  "医疗": "Healthcare",
  "学习": "Education",
  "娱乐": "Entertainment",
  "人情": "Gifts and social",
  "工资": "Salary",
  "奖金": "Bonus",
  "报销": "Reimbursement",
  "理财": "Investments",
  "兼职": "Side job",
  "其他收入": "Other income"
};

const TW_PHRASES: Record<string, string> = {
  "插件语言": "外掛語言",
  "插件": "外掛",
  "仪表盘": "儀表板",
  "账目": "帳目",
  "账户": "帳戶",
  "软件": "軟體",
  "文件夹": "資料夾",
  "保存": "儲存",
  "存储": "儲存",
  "目录": "目錄",
  "范围": "範圍",
  "选项": "選項",
  "信息": "資訊",
  "默认": "預設",
  "筛选": "篩選",
  "标签": "標籤",
  "图表": "圖表",
  "数据": "資料",
  "导入": "匯入",
  "导出": "匯出",
  "设置": "設定",
  "颜色": "顏色",
  "删除": "刪除",
  "添加": "新增",
  "金额": "金額",
  "时间": "時間",
  "星期": "星期",
  "显示": "顯示",
  "关闭": "關閉",
  "打开": "開啟",
  "编辑": "編輯",
  "输入": "輸入",
  "检查": "檢查",
  "更新": "更新",
  "自动": "自動",
  "继续": "繼續",
  "选择": "選擇",
  "转换": "轉換",
  "恢复": "恢復",
  "汇总": "彙總",
  "备注": "備註",
  "分类": "分類",
  "录入": "輸入",
  "快捷键": "快速鍵",
  "明细": "明細",
  "结余": "結餘",
  "趋势": "趨勢",
  "内联": "行內",
  "二维码": "QR Code",
  "简体中文": "簡體中文",
  "万": "萬",
  "亿": "億"
};

const TW_CHARACTERS: Record<string, string> = {
  "账": "帳", "户": "戶", "软": "軟", "夹": "夾", "资": "資", "储": "儲", "预": "預", "筛": "篩",
  "签": "籤", "图": "圖", "导": "導", "设": "設", "颜": "顏", "删": "刪", "添": "添", "额": "額",
  "时": "時", "显": "顯", "闭": "閉", "开": "開", "编": "編", "输": "輸", "检": "檢", "续": "續",
  "选": "選", "转": "轉", "复": "復", "汇": "彙", "备": "備", "类": "類", "录": "錄", "键": "鍵",
  "简": "簡", "体": "體", "万": "萬", "亿": "億", "与": "與", "为": "為", "启": "啟", "后": "後",
  "内": "內", "栏": "欄", "顺": "順", "页": "頁", "动": "動", "应": "應", "发": "發", "现": "現",
  "载": "載", "项": "項", "笔": "筆", "处": "處", "实": "實", "际": "際", "过": "過", "单": "單",
  "击": "擊", "归": "歸", "数": "數", "据": "據", "标": "標", "题": "題", "块": "塊",
  "宽": "寬", "细": "細", "线": "線", "这": "這", "个": "個", "该": "該", "从": "從", "没": "沒",
  "无": "無", "对": "對", "话": "話", "统": "統", "计": "計", "历": "曆", "间": "間", "还": "還",
  "护": "護", "层": "層", "称": "稱", "码": "碼", "号": "號", "旧": "舊", "径": "徑", "门": "門",
  "锁": "鎖", "总": "總", "败": "敗", "误": "誤", "认": "認", "择": "擇", "览": "覽", "态": "態"
};

const LOCALE_TERMS: Partial<Record<Language, Record<string, string>>> = {
  fr: {
    "通用": "Général", "插件语言": "Langue du plugin", "自动识别设备": "Détection automatique", "桌面版": "Ordinateur", "手机版": "Mobile",
    "录入": "Saisie", "账目明细": "Transactions", "界面与格式": "Interface et formats", "数据与文件": "Données et fichiers", "快捷键": "Raccourcis",
    "记账仪表盘": "Tableau de bord", "开始记账": "Ajouter une transaction", "收入": "Revenus", "支出": "Dépenses", "结余": "Solde net", "余额": "Solde",
    "账户": "Compte", "类型": "Type", "必要性": "Nécessité", "分类": "Catégorie", "附件": "Pièce jointe", "日期": "Date", "内容": "Libellé", "金额": "Montant", "备注": "Notes", "标签": "Étiquettes", "操作": "Actions",
    "筛选": "Filtrer", "清空筛选": "Effacer les filtres", "插件设置": "Paramètres", "保存": "Enregistrer", "取消": "Annuler", "确认": "Confirmer", "删除": "Supprimer", "添加": "Ajouter", "编辑": "Modifier", "刷新": "Actualiser", "导入CSV文件": "Importer un CSV", "导出CSV文件": "Exporter un CSV", "赞助与支持": "Soutenir le projet", "问题反馈": "Commentaires"
  },
  ru: {
    "通用": "Общие", "插件语言": "Язык плагина", "自动识别设备": "Автоопределение", "桌面版": "Компьютер", "手机版": "Мобильный",
    "录入": "Ввод", "账目明细": "Операции", "界面与格式": "Интерфейс и форматы", "数据与文件": "Данные и файлы", "快捷键": "Горячие клавиши",
    "记账仪表盘": "Финансовая панель", "开始记账": "Добавить операцию", "收入": "Доход", "支出": "Расход", "结余": "Итог", "余额": "Баланс",
    "账户": "Счёт", "类型": "Тип", "必要性": "Необходимость", "分类": "Категория", "附件": "Вложение", "日期": "Дата", "内容": "Описание", "金额": "Сумма", "备注": "Примечания", "标签": "Метки", "操作": "Действия",
    "筛选": "Фильтр", "清空筛选": "Сбросить фильтры", "插件设置": "Настройки", "保存": "Сохранить", "取消": "Отмена", "确认": "Подтвердить", "删除": "Удалить", "添加": "Добавить", "编辑": "Изменить", "刷新": "Обновить", "导入CSV文件": "Импорт CSV", "导出CSV文件": "Экспорт CSV", "赞助与支持": "Поддержать проект", "问题反馈": "Обратная связь"
  },
  es: {
    "通用": "General", "插件语言": "Idioma del complemento", "自动识别设备": "Detectar dispositivo", "桌面版": "Escritorio", "手机版": "Móvil",
    "录入": "Registro", "账目明细": "Movimientos", "界面与格式": "Interfaz y formatos", "数据与文件": "Datos y archivos", "快捷键": "Atajos",
    "记账仪表盘": "Panel financiero", "开始记账": "Añadir movimiento", "收入": "Ingresos", "支出": "Gastos", "结余": "Neto", "余额": "Saldo",
    "账户": "Cuenta", "类型": "Tipo", "必要性": "Necesidad", "分类": "Categoría", "附件": "Adjunto", "日期": "Fecha", "内容": "Descripción", "金额": "Importe", "备注": "Notas", "标签": "Etiquetas", "操作": "Acciones",
    "筛选": "Filtrar", "清空筛选": "Borrar filtros", "插件设置": "Ajustes", "保存": "Guardar", "取消": "Cancelar", "确认": "Confirmar", "删除": "Eliminar", "添加": "Añadir", "编辑": "Editar", "刷新": "Actualizar", "导入CSV文件": "Importar CSV", "导出CSV文件": "Exportar CSV", "赞助与支持": "Apoyar el proyecto", "问题反馈": "Comentarios"
  },
  ar: {
    "通用": "عام", "插件语言": "لغة الإضافة", "自动识别设备": "اكتشاف الجهاز تلقائياً", "桌面版": "سطح المكتب", "手机版": "الهاتف",
    "录入": "الإدخال", "账目明细": "المعاملات", "界面与格式": "الواجهة والتنسيقات", "数据与文件": "البيانات والملفات", "快捷键": "الاختصارات",
    "记账仪表盘": "لوحة الحسابات", "开始记账": "إضافة معاملة", "收入": "الدخل", "支出": "المصروف", "结余": "الصافي", "余额": "الرصيد",
    "账户": "الحساب", "类型": "النوع", "必要性": "الضرورة", "分类": "الفئة", "附件": "المرفق", "日期": "التاريخ", "内容": "الوصف", "金额": "المبلغ", "备注": "ملاحظات", "标签": "الوسوم", "操作": "الإجراءات",
    "筛选": "تصفية", "清空筛选": "مسح عوامل التصفية", "插件设置": "الإعدادات", "保存": "حفظ", "取消": "إلغاء", "确认": "تأكيد", "删除": "حذف", "添加": "إضافة", "编辑": "تعديل", "刷新": "تحديث", "导入CSV文件": "استيراد CSV", "导出CSV文件": "تصدير CSV", "赞助与支持": "دعم المشروع", "问题反馈": "ملاحظات"
  },
  ja: {
    "通用": "一般", "插件语言": "プラグインの言語", "自动识别设备": "端末を自動判定", "桌面版": "デスクトップ", "手机版": "モバイル",
    "录入": "入力", "账目明细": "取引明細", "界面与格式": "画面と書式", "数据与文件": "データとファイル", "快捷键": "ショートカット",
    "记账仪表盘": "家計簿ダッシュボード", "开始记账": "取引を追加", "收入": "収入", "支出": "支出", "结余": "収支", "余额": "残高",
    "账户": "口座", "类型": "種類", "必要性": "必要性", "分类": "カテゴリ", "附件": "添付", "日期": "日付", "内容": "内容", "金额": "金額", "备注": "メモ", "标签": "タグ", "操作": "操作",
    "筛选": "フィルター", "清空筛选": "フィルターを解除", "插件设置": "プラグイン設定", "保存": "保存", "取消": "キャンセル", "确认": "確認", "删除": "削除", "添加": "追加", "编辑": "編集", "刷新": "更新", "导入CSV文件": "CSVをインポート", "导出CSV文件": "CSVをエクスポート", "赞助与支持": "プロジェクトを支援", "问题反馈": "フィードバック"
  },
  ko: {
    "通用": "일반", "插件语言": "플러그인 언어", "自动识别设备": "기기 자동 감지", "桌面版": "데스크톱", "手机版": "모바일",
    "录入": "입력", "账目明细": "거래 내역", "界面与格式": "화면 및 형식", "数据与文件": "데이터 및 파일", "快捷键": "단축키",
    "记账仪表盘": "가계부 대시보드", "开始记账": "거래 추가", "收入": "수입", "支出": "지출", "结余": "순액", "余额": "잔액",
    "账户": "계정", "类型": "유형", "必要性": "필요성", "分类": "분류", "附件": "첨부", "日期": "날짜", "内容": "내용", "金额": "금액", "备注": "메모", "标签": "태그", "操作": "작업",
    "筛选": "필터", "清空筛选": "필터 지우기", "插件设置": "플러그인 설정", "保存": "저장", "取消": "취소", "确认": "확인", "删除": "삭제", "添加": "추가", "编辑": "편집", "刷新": "새로고침", "导入CSV文件": "CSV 가져오기", "导出CSV文件": "CSV 내보내기", "赞助与支持": "프로젝트 후원", "问题反馈": "피드백"
  },
  de: {
    "通用": "Allgemein", "插件语言": "Plugin-Sprache", "自动识别设备": "Gerät automatisch erkennen", "桌面版": "Desktop", "手机版": "Mobil",
    "录入": "Erfassung", "账目明细": "Buchungen", "界面与格式": "Oberfläche und Formate", "数据与文件": "Daten und Dateien", "快捷键": "Tastenkürzel",
    "记账仪表盘": "Finanzübersicht", "开始记账": "Buchung hinzufügen", "收入": "Einnahmen", "支出": "Ausgaben", "结余": "Netto", "余额": "Saldo",
    "账户": "Konto", "类型": "Typ", "必要性": "Notwendigkeit", "分类": "Kategorie", "附件": "Anhang", "日期": "Datum", "内容": "Beschreibung", "金额": "Betrag", "备注": "Notizen", "标签": "Tags", "操作": "Aktionen",
    "筛选": "Filtern", "清空筛选": "Filter löschen", "插件设置": "Plugin-Einstellungen", "保存": "Speichern", "取消": "Abbrechen", "确认": "Bestätigen", "删除": "Löschen", "添加": "Hinzufügen", "编辑": "Bearbeiten", "刷新": "Aktualisieren", "导入CSV文件": "CSV importieren", "导出CSV文件": "CSV exportieren", "赞助与支持": "Projekt unterstützen", "问题反馈": "Feedback"
  },
  pt: {
    "通用": "Geral", "插件语言": "Idioma do plugin", "自动识别设备": "Detetar dispositivo", "桌面版": "Computador", "手机版": "Telemóvel",
    "录入": "Registo", "账目明细": "Transações", "界面与格式": "Interface e formatos", "数据与文件": "Dados e ficheiros", "快捷键": "Atalhos",
    "记账仪表盘": "Painel financeiro", "开始记账": "Adicionar transação", "收入": "Receitas", "支出": "Despesas", "结余": "Líquido", "余额": "Saldo",
    "账户": "Conta", "类型": "Tipo", "必要性": "Necessidade", "分类": "Categoria", "附件": "Anexo", "日期": "Data", "内容": "Descrição", "金额": "Valor", "备注": "Notas", "标签": "Etiquetas", "操作": "Ações",
    "筛选": "Filtrar", "清空筛选": "Limpar filtros", "插件设置": "Definições", "保存": "Guardar", "取消": "Cancelar", "确认": "Confirmar", "删除": "Eliminar", "添加": "Adicionar", "编辑": "Editar", "刷新": "Atualizar", "导入CSV文件": "Importar CSV", "导出CSV文件": "Exportar CSV", "赞助与支持": "Apoiar o projeto", "问题反馈": "Comentários"
  },
  fa: {
    "通用": "عمومی", "插件语言": "زبان افزونه", "自动识别设备": "تشخیص خودکار دستگاه", "桌面版": "رومیزی", "手机版": "موبایل",
    "录入": "ثبت", "账目明细": "تراکنش‌ها", "界面与格式": "رابط و قالب‌ها", "数据与文件": "داده‌ها و فایل‌ها", "快捷键": "میانبرها",
    "记账仪表盘": "داشبورد مالی", "开始记账": "افزودن تراکنش", "收入": "درآمد", "支出": "هزینه", "结余": "خالص", "余额": "موجودی",
    "账户": "حساب", "类型": "نوع", "必要性": "ضرورت", "分类": "دسته", "附件": "پیوست", "日期": "تاریخ", "内容": "شرح", "金额": "مبلغ", "备注": "یادداشت", "标签": "برچسب‌ها", "操作": "عملیات",
    "筛选": "فیلتر", "清空筛选": "پاک‌کردن فیلترها", "插件设置": "تنظیمات", "保存": "ذخیره", "取消": "لغو", "确认": "تأیید", "删除": "حذف", "添加": "افزودن", "编辑": "ویرایش", "刷新": "تازه‌سازی", "导入CSV文件": "درون‌ریزی CSV", "导出CSV文件": "برون‌ریزی CSV", "赞助与支持": "حمایت از پروژه", "问题反馈": "بازخورد"
  }
};

const LOCALE_DYNAMIC_TERMS: Partial<Record<Language, Record<string, string>>> = {
  fr: { "账目数量": "Nombre de transactions", "账目数": "Nombre de transactions", "笔": " transactions", "时间": "Heure", "时刻": "Heure", "正序": " croissant", "倒序": " décroissant", "已锁定": " · verrouillé", "已解锁": " · déverrouillé", "返回顶部": "Retour en haut", "全部": "Tous les ", "本月": "Ce mois-ci" },
  ru: { "账目数量": "Количество операций", "账目数": "Количество операций", "笔": " операций", "时间": "Время", "时刻": "Время", "正序": " по возрастанию", "倒序": " по убыванию", "已锁定": " · заблокировано", "已解锁": " · разблокировано", "返回顶部": "Наверх", "全部": "Все ", "本月": "Этот месяц" },
  es: { "账目数量": "Número de movimientos", "账目数": "Número de movimientos", "笔": " movimientos", "时间": "Hora", "时刻": "Hora", "正序": " ascendente", "倒序": " descendente", "已锁定": " · bloqueado", "已解锁": " · desbloqueado", "返回顶部": "Volver arriba", "全部": "Todos los ", "本月": "Este mes" },
  ar: { "账目数量": "عدد المعاملات", "账目数": "عدد المعاملات", "笔": " معاملات", "时间": "الوقت", "时刻": "الوقت", "正序": " تصاعدي", "倒序": " تنازلي", "已锁定": " · مقفل", "已解锁": " · غير مقفل", "返回顶部": "العودة للأعلى", "全部": "كل ", "本月": "هذا الشهر" },
  ja: { "账目数量": "取引件数", "账目数": "取引件数", "笔": "件", "时间": "時刻", "时刻": "時刻", "正序": " 昇順", "倒序": " 降順", "已锁定": "・ロック中", "已解锁": "・ロック解除", "返回顶部": "トップへ戻る", "全部": "すべての", "本月": "今月" },
  ko: { "账目数量": "거래 수", "账目数": "거래 수", "笔": "건", "时间": "시간", "时刻": "시간", "正序": " 오름차순", "倒序": " 내림차순", "已锁定": " · 잠김", "已解锁": " · 잠금 해제", "返回顶部": "맨 위로", "全部": "모든 ", "本月": "이번 달" },
  de: { "账目数量": "Anzahl Buchungen", "账目数": "Anzahl Buchungen", "笔": " Buchungen", "时间": "Uhrzeit", "时刻": "Uhrzeit", "正序": " aufsteigend", "倒序": " absteigend", "已锁定": " · gesperrt", "已解锁": " · entsperrt", "返回顶部": "Nach oben", "全部": "Alle ", "本月": "Dieser Monat" },
  pt: { "账目数量": "Número de transações", "账目数": "Número de transações", "笔": " transações", "时间": "Hora", "时刻": "Hora", "正序": " ascendente", "倒序": " descendente", "已锁定": " · bloqueado", "已解锁": " · desbloqueado", "返回顶部": "Voltar ao topo", "全部": "Todos os ", "本月": "Este mês" },
  fa: { "账目数量": "تعداد تراکنش‌ها", "账目数": "تعداد تراکنش‌ها", "笔": " تراکنش", "时间": "زمان", "时刻": "زمان", "正序": " صعودی", "倒序": " نزولی", "已锁定": " · قفل", "已解锁": " · باز", "返回顶部": "بازگشت به بالا", "全部": "همه ", "本月": "این ماه" }
};

const LOCALE_PHRASES: Partial<Record<Language, Record<string, string>>> = {
  fr: { "本月收入": "Revenus du mois", "本月支出": "Dépenses du mois", "本月结余": "Solde net du mois", "筛选收入": "Revenus filtrés", "筛选支出": "Dépenses filtrées", "筛选结余": "Solde net filtré" },
  ru: { "本月收入": "Доход за месяц", "本月支出": "Расход за месяц", "本月结余": "Итог за месяц", "筛选收入": "Отфильтрованный доход", "筛选支出": "Отфильтрованный расход", "筛选结余": "Отфильтрованный итог" },
  es: { "本月收入": "Ingresos del mes", "本月支出": "Gastos del mes", "本月结余": "Neto del mes", "筛选收入": "Ingresos filtrados", "筛选支出": "Gastos filtrados", "筛选结余": "Neto filtrado" },
  ar: { "本月收入": "دخل الشهر", "本月支出": "مصروف الشهر", "本月结余": "صافي الشهر", "筛选收入": "الدخل المصفى", "筛选支出": "المصروف المصفى", "筛选结余": "الصافي المصفى" },
  ja: { "本月收入": "今月の収入", "本月支出": "今月の支出", "本月结余": "今月の収支", "筛选收入": "絞り込み後の収入", "筛选支出": "絞り込み後の支出", "筛选结余": "絞り込み後の収支" },
  ko: { "本月收入": "이번 달 수입", "本月支出": "이번 달 지출", "本月结余": "이번 달 순액", "筛选收入": "필터된 수입", "筛选支出": "필터된 지출", "筛选结余": "필터된 순액" },
  de: { "本月收入": "Einnahmen des Monats", "本月支出": "Ausgaben des Monats", "本月结余": "Netto des Monats", "筛选收入": "Gefilterte Einnahmen", "筛选支出": "Gefilterte Ausgaben", "筛选结余": "Gefiltertes Netto" },
  pt: { "本月收入": "Receitas do mês", "本月支出": "Despesas do mês", "本月结余": "Líquido do mês", "筛选收入": "Receitas filtradas", "筛选支出": "Despesas filtradas", "筛选结余": "Líquido filtrado" },
  fa: { "本月收入": "درآمد ماه", "本月支出": "هزینه ماه", "本月结余": "خالص ماه", "筛选收入": "درآمد فیلترشده", "筛选支出": "هزینه فیلترشده", "筛选结余": "خالص فیلترشده" }
};

const LANGUAGE_LOCALES: Partial<Record<Language, string>> = {
  fr: "fr-FR", ru: "ru-RU", es: "es-ES", ar: "ar-u-ca-gregory", ja: "ja-JP", ko: "ko-KR", de: "de-DE", pt: "pt-PT", fa: "fa-IR-u-ca-gregory"
};

const LOCALE_TEMPLATES: Partial<Record<Language, Record<"addIn" | "entryMonth" | "monthNet" | "selected", string>>> = {
  fr: { addIn: "Ajouter une transaction en {value}", entryMonth: "Mois de l’opération : {value}", monthNet: "Solde net de {value} :", selected: "{value} sélectionné(s)" },
  ru: { addIn: "Добавить операцию за {value}", entryMonth: "Месяц операции: {value}", monthNet: "Итог за {value}:", selected: "Выбрано: {value}" },
  es: { addIn: "Añadir movimiento en {value}", entryMonth: "Mes del movimiento: {value}", monthNet: "Neto de {value}:", selected: "{value} seleccionados" },
  ar: { addIn: "إضافة معاملة في {value}", entryMonth: "شهر المعاملة: {value}", monthNet: "صافي {value}:", selected: "تم تحديد {value}" },
  ja: { addIn: "{value}に取引を追加", entryMonth: "取引月：{value}", monthNet: "{value}の収支：", selected: "{value}件を選択" },
  ko: { addIn: "{value}에 거래 추가", entryMonth: "거래 월: {value}", monthNet: "{value} 순액:", selected: "{value}개 선택됨" },
  de: { addIn: "Buchung für {value} hinzufügen", entryMonth: "Buchungsmonat: {value}", monthNet: "Netto für {value}:", selected: "{value} ausgewählt" },
  pt: { addIn: "Adicionar transação em {value}", entryMonth: "Mês da transação: {value}", monthNet: "Líquido de {value}:", selected: "{value} selecionadas" },
  fa: { addIn: "افزودن تراکنش در {value}", entryMonth: "ماه تراکنش: {value}", monthNet: "خالص {value}:", selected: "{value} مورد انتخاب شد" }
};

const LOCALE_ENTRY_TERMS: Partial<Record<Language, Record<string, string>>> = {
  fr: {
    "桌面版记账": "Saisie sur ordinateur", "桌面版连续记账": "Saisie continue sur ordinateur", "输入日期中的日，例如21": "Saisissez le jour du mois, par exemple 21", "输入编号，直接回车使用默认值": "Saisissez un code ou appuyez sur Entrée pour la valeur par défaut", "输入账目内容": "Saisissez le libellé", "输入金额或算式，例如11.4+5.1": "Saisissez un montant ou une formule, par exemple 11.4+5.1", "输入备注；无备注直接回车": "Saisissez une note ou appuyez sur Entrée s’il n’y en a pas", "请输入选项编号或完整名称": "Saisissez le code ou le nom complet de l’option", "输入无效，请检查当前步骤": "Saisie incorrecte ; vérifiez l’étape actuelle", "输入日期": "Saisir la date", "输入内容": "Saisir le libellé", "输入金额": "Saisir le montant", "输入备注": "Saisir une note", "内容不能为空或纯数字": "Le libellé ne peut pas être vide ni uniquement numérique", "转入账户不能与转出账户相同": "Le compte destinataire doit être différent du compte source"
  },
  ru: {
    "桌面版记账": "Ввод на компьютере", "桌面版连续记账": "Непрерывный ввод на компьютере", "输入日期中的日，例如21": "Введите день месяца, например 21", "输入编号，直接回车使用默认值": "Введите код или нажмите Enter для значения по умолчанию", "输入账目内容": "Введите описание операции", "输入金额或算式，例如11.4+5.1": "Введите сумму или выражение, например 11.4+5.1", "输入备注；无备注直接回车": "Введите примечание или нажмите Enter, если его нет", "请输入选项编号或完整名称": "Введите код или полное название варианта", "输入无效，请检查当前步骤": "Некорректный ввод; проверьте текущий шаг", "输入日期": "Введите дату", "输入内容": "Введите описание", "输入金额": "Введите сумму", "输入备注": "Введите примечание", "内容不能为空或纯数字": "Описание не может быть пустым или состоять только из цифр", "转入账户不能与转出账户相同": "Счёт назначения должен отличаться от исходного"
  },
  es: {
    "桌面版记账": "Registro en ordenador", "桌面版连续记账": "Registro continuo en ordenador", "输入日期中的日，例如21": "Introduce el día del mes, por ejemplo 21", "输入编号，直接回车使用默认值": "Introduce un código o pulsa Intro para usar el valor predeterminado", "输入账目内容": "Introduce la descripción", "输入金额或算式，例如11.4+5.1": "Introduce un importe o una fórmula, por ejemplo 11.4+5.1", "输入备注；无备注直接回车": "Introduce una nota o pulsa Intro si no hay ninguna", "请输入选项编号或完整名称": "Introduce el código o el nombre completo de la opción", "输入无效，请检查当前步骤": "Entrada no válida; revisa el paso actual", "输入日期": "Introducir fecha", "输入内容": "Introducir descripción", "输入金额": "Introducir importe", "输入备注": "Introducir nota", "内容不能为空或纯数字": "La descripción no puede estar vacía ni contener solo números", "转入账户不能与转出账户相同": "La cuenta de destino debe ser distinta de la cuenta de origen"
  },
  ar: {
    "桌面版记账": "إدخال سطح المكتب", "桌面版连续记账": "إدخال متواصل على سطح المكتب", "输入日期中的日，例如21": "أدخل يوم الشهر، مثل 21", "输入编号，直接回车使用默认值": "أدخل الرمز أو اضغط Enter لاستخدام القيمة الافتراضية", "输入账目内容": "أدخل وصف المعاملة", "输入金额或算式，例如11.4+5.1": "أدخل مبلغاً أو صيغة، مثل 11.4+5.1", "输入备注；无备注直接回车": "أدخل ملاحظة أو اضغط Enter إذا لم توجد", "请输入选项编号或完整名称": "أدخل رمز الخيار أو اسمه الكامل", "输入无效，请检查当前步骤": "إدخال غير صالح؛ تحقق من الخطوة الحالية", "输入日期": "أدخل التاريخ", "输入内容": "أدخل الوصف", "输入金额": "أدخل المبلغ", "输入备注": "أدخل الملاحظة", "内容不能为空或纯数字": "لا يمكن أن يكون الوصف فارغاً أو أرقاماً فقط", "转入账户不能与转出账户相同": "يجب أن يختلف الحساب الوجهة عن الحساب المصدر"
  },
  ja: {
    "桌面版记账": "デスクトップ入力", "桌面版连续记账": "デスクトップ連続入力", "输入日期中的日，例如21": "日付の日を入力（例：21）", "输入编号，直接回车使用默认值": "コードを入力。既定値は Enter", "输入账目内容": "取引内容を入力", "输入金额或算式，例如11.4+5.1": "金額または式を入力（例：11.4+5.1）", "输入备注；无备注直接回车": "メモを入力。なければ Enter", "请输入选项编号或完整名称": "コードまたは完全な名称を入力", "输入无效，请检查当前步骤": "入力が無効です。現在の手順を確認してください", "输入日期": "日付を入力", "输入内容": "内容を入力", "输入金额": "金額を入力", "输入备注": "メモを入力", "内容不能为空或纯数字": "内容は空欄または数字だけにはできません", "转入账户不能与转出账户相同": "振替先口座は振替元口座と異なる必要があります"
  },
  ko: {
    "桌面版记账": "데스크톱 입력", "桌面版连续记账": "데스크톱 연속 입력", "输入日期中的日，例如21": "날짜의 일을 입력하세요(예: 21)", "输入编号，直接回车使用默认值": "코드를 입력하거나 기본값은 Enter를 누르세요", "输入账目内容": "거래 내용을 입력하세요", "输入金额或算式，例如11.4+5.1": "금액 또는 수식을 입력하세요(예: 11.4+5.1)", "输入备注；无备注直接回车": "메모를 입력하거나 없으면 Enter를 누르세요", "请输入选项编号或完整名称": "옵션 코드 또는 전체 이름을 입력하세요", "输入无效，请检查当前步骤": "입력이 올바르지 않습니다. 현재 단계를 확인하세요", "输入日期": "날짜 입력", "输入内容": "내용 입력", "输入金额": "금액 입력", "输入备注": "메모 입력", "内容不能为空或纯数字": "내용은 비워 두거나 숫자로만 입력할 수 없습니다", "转入账户不能与转出账户相同": "대상 계정은 원본 계정과 달라야 합니다"
  },
  de: {
    "桌面版记账": "Desktop-Erfassung", "桌面版连续记账": "Fortlaufende Desktop-Erfassung", "输入日期中的日，例如21": "Tag des Monats eingeben, zum Beispiel 21", "输入编号，直接回车使用默认值": "Code eingeben oder Enter für den Standardwert drücken", "输入账目内容": "Buchungsbeschreibung eingeben", "输入金额或算式，例如11.4+5.1": "Betrag oder Ausdruck eingeben, zum Beispiel 11.4+5.1", "输入备注；无备注直接回车": "Notiz eingeben oder Enter drücken, wenn keine vorhanden ist", "请输入选项编号或完整名称": "Code oder vollständigen Namen der Option eingeben", "输入无效，请检查当前步骤": "Ungültige Eingabe; aktuellen Schritt prüfen", "输入日期": "Datum eingeben", "输入内容": "Beschreibung eingeben", "输入金额": "Betrag eingeben", "输入备注": "Notiz eingeben", "内容不能为空或纯数字": "Die Beschreibung darf nicht leer sein oder nur aus Zahlen bestehen", "转入账户不能与转出账户相同": "Zielkonto und Quellkonto müssen verschieden sein"
  },
  pt: {
    "桌面版记账": "Registo no computador", "桌面版连续记账": "Registo contínuo no computador", "输入日期中的日，例如21": "Introduza o dia do mês, por exemplo 21", "输入编号，直接回车使用默认值": "Introduza um código ou prima Enter para usar o valor predefinido", "输入账目内容": "Introduza a descrição", "输入金额或算式，例如11.4+5.1": "Introduza um valor ou fórmula, por exemplo 11.4+5.1", "输入备注；无备注直接回车": "Introduza uma nota ou prima Enter se não houver", "请输入选项编号或完整名称": "Introduza o código ou o nome completo da opção", "输入无效，请检查当前步骤": "Entrada inválida; verifique o passo atual", "输入日期": "Introduzir data", "输入内容": "Introduzir descrição", "输入金额": "Introduzir valor", "输入备注": "Introduzir nota", "内容不能为空或纯数字": "A descrição não pode estar vazia nem conter apenas números", "转入账户不能与转出账户相同": "A conta de destino deve ser diferente da conta de origem"
  },
  fa: {
    "桌面版记账": "ثبت رومیزی", "桌面版连续记账": "ثبت پیوسته رومیزی", "输入日期中的日，例如21": "روز ماه را وارد کنید، برای نمونه 21", "输入编号，直接回车使用默认值": "کد را وارد کنید یا برای مقدار پیش‌فرض Enter بزنید", "输入账目内容": "شرح تراکنش را وارد کنید", "输入金额或算式，例如11.4+5.1": "مبلغ یا عبارت را وارد کنید، برای نمونه 11.4+5.1", "输入备注；无备注直接回车": "یادداشت را وارد کنید یا اگر ندارید Enter بزنید", "请输入选项编号或完整名称": "کد یا نام کامل گزینه را وارد کنید", "输入无效，请检查当前步骤": "ورودی نامعتبر است؛ مرحله فعلی را بررسی کنید", "输入日期": "تاریخ را وارد کنید", "输入内容": "شرح را وارد کنید", "输入金额": "مبلغ را وارد کنید", "输入备注": "یادداشت را وارد کنید", "内容不能为空或纯数字": "شرح نمی‌تواند خالی یا فقط شامل عدد باشد", "转入账户不能与转出账户相同": "حساب مقصد باید با حساب مبدأ متفاوت باشد"
  }
};

const LOCALE_DEFAULT_DATA_TERMS: Partial<Record<Language, Record<string, string>>> = {
  fr: { "转账": "Virement", "必需": "Essentiel", "非必需": "Non essentiel", "未分类": "Non classé", "默认账户": "Compte par défaut", "餐饮": "Repas", "交通": "Transports", "购物": "Achats", "居住": "Logement", "医疗": "Santé", "学习": "Études", "娱乐": "Loisirs", "人情": "Cadeaux et relations", "工资": "Salaire", "奖金": "Prime", "报销": "Remboursement", "理财": "Placements", "兼职": "Travail d’appoint", "其他收入": "Autres revenus" },
  ru: { "转账": "Перевод", "必需": "Необходимое", "非必需": "Необязательное", "未分类": "Без категории", "默认账户": "Счёт по умолчанию", "餐饮": "Питание", "交通": "Транспорт", "购物": "Покупки", "居住": "Жильё", "医疗": "Здоровье", "学习": "Образование", "娱乐": "Развлечения", "人情": "Подарки и общение", "工资": "Зарплата", "奖金": "Премия", "报销": "Возмещение", "理财": "Инвестиции", "兼职": "Подработка", "其他收入": "Прочий доход" },
  es: { "转账": "Transferencia", "必需": "Esencial", "非必需": "No esencial", "未分类": "Sin categoría", "默认账户": "Cuenta predeterminada", "餐饮": "Comida", "交通": "Transporte", "购物": "Compras", "居住": "Vivienda", "医疗": "Salud", "学习": "Educación", "娱乐": "Ocio", "人情": "Regalos y relaciones", "工资": "Salario", "奖金": "Bonificación", "报销": "Reembolso", "理财": "Inversiones", "兼职": "Trabajo adicional", "其他收入": "Otros ingresos" },
  ar: { "转账": "تحويل", "必需": "أساسي", "非必需": "غير أساسي", "未分类": "غير مصنف", "默认账户": "الحساب الافتراضي", "餐饮": "طعام", "交通": "مواصلات", "购物": "تسوق", "居住": "سكن", "医疗": "صحة", "学习": "تعليم", "娱乐": "ترفيه", "人情": "هدايا وعلاقات", "工资": "راتب", "奖金": "مكافأة", "报销": "استرداد", "理财": "استثمارات", "兼职": "عمل إضافي", "其他收入": "دخل آخر" },
  ja: { "转账": "振替", "必需": "必須", "非必需": "任意", "未分类": "未分類", "默认账户": "既定の口座", "餐饮": "食費", "交通": "交通", "购物": "買い物", "居住": "住居", "医疗": "医療", "学习": "学習", "娱乐": "娯楽", "人情": "交際費", "工资": "給与", "奖金": "賞与", "报销": "払い戻し", "理财": "投資", "兼职": "副業", "其他收入": "その他の収入" },
  ko: { "转账": "이체", "必需": "필수", "非必需": "비필수", "未分类": "미분류", "默认账户": "기본 계정", "餐饮": "식비", "交通": "교통", "购物": "쇼핑", "居住": "주거", "医疗": "의료", "学习": "교육", "娱乐": "여가", "人情": "선물 및 교제", "工资": "급여", "奖金": "상여금", "报销": "환급", "理财": "투자", "兼职": "부업", "其他收入": "기타 수입" },
  de: { "转账": "Umbuchung", "必需": "Notwendig", "非必需": "Nicht notwendig", "未分类": "Nicht kategorisiert", "默认账户": "Standardkonto", "餐饮": "Essen", "交通": "Verkehr", "购物": "Einkäufe", "居住": "Wohnen", "医疗": "Gesundheit", "学习": "Bildung", "娱乐": "Freizeit", "人情": "Geschenke und Kontakte", "工资": "Gehalt", "奖金": "Bonus", "报销": "Erstattung", "理财": "Anlagen", "兼职": "Nebenjob", "其他收入": "Sonstige Einnahmen" },
  pt: { "转账": "Transferência", "必需": "Essencial", "非必需": "Não essencial", "未分类": "Sem categoria", "默认账户": "Conta predefinida", "餐饮": "Alimentação", "交通": "Transportes", "购物": "Compras", "居住": "Habitação", "医疗": "Saúde", "学习": "Educação", "娱乐": "Lazer", "人情": "Presentes e relações", "工资": "Salário", "奖金": "Bónus", "报销": "Reembolso", "理财": "Investimentos", "兼职": "Trabalho extra", "其他收入": "Outros rendimentos" },
  fa: { "转账": "انتقال", "必需": "ضروری", "非必需": "غیرضروری", "未分类": "دسته‌بندی‌نشده", "默认账户": "حساب پیش‌فرض", "餐饮": "خوراک", "交通": "حمل‌ونقل", "购物": "خرید", "居住": "مسکن", "医疗": "سلامت", "学习": "آموزش", "娱乐": "سرگرمی", "人情": "هدیه و روابط", "工资": "حقوق", "奖金": "پاداش", "报销": "بازپرداخت", "理财": "سرمایه‌گذاری", "兼职": "کار جانبی", "其他收入": "درآمد دیگر" }
};

function localizedMonthLabel(value: string, language: Language): string {
  const month = Number(value);
  const locale = LANGUAGE_LOCALES[language];
  if (!locale || !Number.isInteger(month) || month < 1 || month > 12) return value;
  return new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2020, month - 1, 1)));
}

function applyTemplate(template: string, value: string): string {
  return template.replace("{value}", value);
}

const englishFragments = Object.entries(EN).sort(([left], [right]) => right.length - left.length);
const traditionalFragments = Object.entries(TW_PHRASES).sort(([left], [right]) => right.length - left.length);

function translateEnglish(source: string): string {
  if (EN[source]) return EN[source] as string;
  const directPatterns: Array<[RegExp, (...matches: string[]) => string]> = [
    [/^在(.+)新建账目$/u, (_, month) => `Add transaction in ${month.replace(/年/u, "-").replace(/月/u, "")}`],
    [/^记账月份：(.+)$/u, (_, month) => `Transaction month: ${month.replace(/年/u, "-").replace(/月/u, "")}`],
    [/^请输入1-(\d+)之间的日期$/u, (_, maximum) => `Enter a day from 1 to ${maximum}`],
    [/^已隐藏“(.+)”$/u, (_, title) => `Hidden “${translateEnglish(title)}”`],
    [/^已删除图表“(.+)”$/u, (_, title) => `Deleted chart “${translateEnglish(title)}”`],
    [/^请至少选择一个(.+)，或点击“清除筛选”$/u, (_, label) => `Select at least one ${translateEnglish(label).toLowerCase()}, or click “Clear filters”`],
    [/^已批量修改(\d+)笔账目$/u, (_, count) => `Updated ${count} transactions`],
    [/^附件不存在：(.+)$/u, (_, path) => `Attachment not found: ${path}`],
    [/^隐藏(.+)$/u, (_, label) => `Hide ${translateEnglish(label)}`],
    [/^显示(.+)$/u, (_, label) => `Show ${translateEnglish(label)}`],
    [/^移除(.+)$/u, (_, label) => `Remove ${translateEnglish(label)}`],
    [/^格式不合法：(.+)$/u, (_, reason) => `Invalid format: ${translateEnglish(reason)}`],
    [/^请输入1—(\d+)之间的日期$/u, (_, maximum) => `Enter a day from 1 to ${maximum}`],
    [/^发布包缺少(.+)$/u, (_, files) => `Release assets are missing ${files}`],
    [/^已转换(\d+)个仓库内旧版账目$/u, (_, count) => `Converted ${count} legacy transactions in the vault`],
    [/^已从外部导入(\d+)笔，跳过或失败(\d+)个文件$/u, (_, imported, failed) => `Imported ${imported} transactions externally; skipped or failed ${failed} files`],
    [/^正在处理 (\d+)\/(\d+)（(\d+)%）$/u, (_, current, total, percent) => `Processing ${current}/${total} (${percent}%)`],
    [/^已同步(\d+)个账目文件$/u, (_, count) => `Synchronized ${count} transaction files`],
    [/^正在导入 (\d+)\/(\d+)（(\d+)%）$/u, (_, current, total, percent) => `Importing ${current}/${total} (${percent}%)`],
    [/^导入完成：成功(\d+)笔，重复跳过(\d+)笔，失败(\d+)笔。$/u, (_, imported, duplicates, failed) => `Import complete: ${imported} succeeded, ${duplicates} duplicates skipped, ${failed} failed.`],
    [/^(.+)整月$/u, (_, month) => `Entire ${month}`],
    [/^当前仪表盘筛选结果（(\d+)笔）$/u, (_, count) => `Current dashboard filter results (${count} transactions)`],
    [/^CSV已导出：(.+)$/u, (_, path) => `CSV exported: ${path}`],
    [/^已把#(.+)重命名为#(.+)，影响(\d+)笔账目。$/u, (_, oldTag, newTag, count) => `Renamed #${oldTag} to #${newTag} in ${count} transactions.`],
    [/^已从(\d+)笔账目删除#(.+)。$/u, (_, count, tag) => `Removed #${tag} from ${count} transactions.`],
    [/^正在删除 (\d+)\/(\d+)（(\d+)%）$/u, (_, current, total, percent) => `Deleting ${current}/${total} (${percent}%)`],
    [/^已删除(\d+)笔包含#(.+)的账目。文件已移入系统回收站。$/u, (_, count, tag) => `Deleted ${count} transactions containing #${tag}. Files were moved to the system trash.`],
    [/^发现新版本 (.+)$/u, (_, version) => `New version available: ${version}`],
    [/^修改(.+)表头名称$/u, (_, label) => `Rename the ${translateEnglish(label).toLowerCase()} column`],
    [/^(.+)预设$/u, (_, label) => `${translateEnglish(label)} presets`],
    [/^移除待上传文件(.+)$/u, (_, file) => `Remove pending upload ${file}`],
    [/^(.+)副本$/u, (_, title) => `${translateEnglish(title)} copy`],
    [/^(.+)范围：(.+)～(.+)$/u, (_, label, minimum, maximum) => `${translateEnglish(label)} range: ${minimum}–${maximum}`],
    [/^清空(.+)$/u, (_, label) => `Clear ${translateEnglish(label).toLowerCase()}`],
    [/^已选择(\d+)笔$/u, (_, count) => `${count} selected`],
    [/^已删除(\d+)笔账目$/u, (_, count) => `Deleted ${count} transaction${count === "1" ? "" : "s"}`],
    [/^已恢复(\d+)笔账目$/u, (_, count) => `Restored ${count} transaction${count === "1" ? "" : "s"}`],
    [/^拖动调整(.+)列宽$/u, (_, label) => `Drag to resize the ${translateEnglish(label).toLowerCase()} column`],
    [/^已删除“(.+)”$/u, (_, title) => `Deleted “${title}”`],
    [/^从预设中切换(.+)$/u, (_, label) => `Choose ${translateEnglish(label).toLowerCase()} from presets`],
    [/^全键盘编号：(.+)$/u, (_, code) => `Keyboard code: ${code}`],
    [/^确定删除选中的(\d+)笔账目吗？$/u, (_, count) => `Delete the ${count} selected transaction${count === "1" ? "" : "s"}?`],
    [/^确定删除“(.+)”吗？文件将移至系统回收站。$/u, (_, title) => `Delete “${title}”? The file will be moved to the system trash.`],
    [/^文件：(.+)$/u, (_, file) => `File: ${file}`],
    [/^失败报告：(.+)$/u, (_, file) => `Failure report: ${file}`],
    [/^#(.+)用于(\d+)笔账目。请选择是否保留这些账目。$/u, (_, tag, count) => `#${tag} is used by ${count} transaction${count === "1" ? "" : "s"}. Choose whether to keep them.`],
    [/^(\d+)年$/u, (_, year) => `${year}`],
    [/^(\d+)月$/u, (_, month) => `Month ${month}`],
    [/^保存时上传并自动重命名：(.+)$/u, (_, file) => `Upload and rename when saved: ${file}`],
    [/^(.+)确认\s+(.+)\/(.+)选择\s+(.+)返回\s+(.+)关闭$/u, (_, confirm, previous, next, back, close) => `${confirm} Confirm  ${previous}/${next} Select  ${back} Back  ${close} Close`],
    [/^按\s*(.+)\s*继续$/u, (_, key) => `Press ${key} to continue`],
    [/^检测到约(\d+)行数据。会自动识别常见中英文列名，并跳过疑似重复账目。$/u, (_, count) => `About ${count} rows detected. Common Chinese and English column names will be recognized automatically, and likely duplicates will be skipped.`],
    [/^(\d+)笔$/u, (_, count) => `${count} transaction${count === "1" ? "" : "s"}`],
    [/^按(.+)排序$/u, (_, label) => `Sort by ${translateEnglish(label)}`],
    [/^搜索(.+)$/u, (_, label) => `Search ${translateEnglish(label)}`],
    [/^当前月份没有可选(.+)$/u, (_, label) => `No ${translateEnglish(label).toLowerCase()} available this month`],
    [/^全部(.+)$/u, (_, label) => `All ${translateEnglish(label).toLowerCase()}`],
    [/^(.+)…\[共(\d+)项\]$/u, (_, value, count) => `${value}… [${count} items]`],
    [/^…\[共(\d+)项\]$/u, (_, count) => `… [${count} items]`],
    [/^共(\d+)项$/u, (_, count) => `${count} items`],
    [/^(.+)月结余：$/u, (_, month) => `${month} net: `],
    [/^版本 (.+)$/u, (_, version) => `Version ${version}`]
  ];
  for (const [pattern, replacement] of directPatterns) {
    const match = source.match(pattern);
    if (match) return replacement(...match);
  }
  let result = source;
  for (const [from, to] of englishFragments) result = result.replaceAll(from, to);
  return result;
}

function preservesUserValue(source: string): boolean {
  return /^.*…\[共\d+项\]$/u.test(source)
    || /^已删除“.+”$/u.test(source)
    || /^确定删除“.+”吗？文件将移至系统回收站。$/u.test(source)
    || /^#.+用于\d+笔账目。请选择是否保留这些账目。$/u.test(source)
    || /^保存时上传并自动重命名：.+$/u.test(source);
}

export function translate(source: string, language: Language): string {
  if (language === "zh-CN" || !source.trim()) return source;
  if (language === "en") {
    const result = translateEnglish(source);
    if (preservesUserValue(source)) return result;
    return /[\u3400-\u9fff]/u.test(result) ? source : result;
  }
  if (language !== "zh-TW") {
    const dictionary = { ...(LOCALE_TERMS[language] ?? {}), ...(LOCALE_DYNAMIC_TERMS[language] ?? {}), ...(LOCALE_PHRASES[language] ?? {}), ...(LOCALE_ENTRY_TERMS[language] ?? {}), ...(LOCALE_DEFAULT_DATA_TERMS[language] ?? {}), ...(SETTINGS_TRANSLATIONS[language] ?? {}) };
    if (dictionary[source]) return dictionary[source] as string;
    const templates = LOCALE_TEMPLATES[language];
    const addIn = source.match(/^在(.+)新建账目$/u);
    if (addIn?.[1] && templates) return applyTemplate(templates.addIn, addIn[1]);
    const entryMonth = source.match(/^记账月份：(.+)$/u);
    if (entryMonth?.[1] && templates) return applyTemplate(templates.entryMonth, entryMonth[1]);
    const monthNet = source.match(/^(\d{1,2})月结余：$/u);
    if (monthNet?.[1] && templates) return applyTemplate(templates.monthNet, localizedMonthLabel(monthNet[1], language));
    const selected = source.match(/^已选择(\d+)笔$/u);
    if (selected?.[1] && templates) return applyTemplate(templates.selected, selected[1]);
    const month = source.match(/^(\d{1,2})月$/u);
    if (month?.[1]) return localizedMonthLabel(month[1], language);
    const year = source.match(/^(\d{4})年$/u);
    if (year?.[1]) return year[1];
    const sortStatus = source.match(/^(日期|时刻)(正序|倒序)(已锁定|已解锁)$/u);
    if (sortStatus) return sortStatus.slice(1).map((part) => dictionary[part] ?? EN[part] ?? part).join("");
    const count = source.match(/^(\d+)笔$/u);
    if (count) return `${count[1]}${dictionary["笔"] ?? EN["笔"] ?? ""}`;
    if (EN[source]) return EN[source] as string;
    const english = translateEnglish(source);
    if (!/[\u3400-\u9fff]/u.test(english) || preservesUserValue(source)) return english;
    let result = source;
    for (const [from, to] of Object.entries(dictionary).sort(([left], [right]) => right.length - left.length)) result = result.replaceAll(from, to);
    return result;
  }
  let result = source;
  for (const [from, to] of traditionalFragments) result = result.replaceAll(from, to);
  return Array.from(result).map((character) => TW_CHARACTERS[character] ?? character).join("");
}

interface TextState {
  source: string;
  localized: string;
}

export class I18nController {
  private observer: MutationObserver | null = null;
  private readonly textStates = new WeakMap<Text, TextState>();
  private readonly attributeStates = new WeakMap<Element, Map<string, TextState>>();

  constructor(private readonly getLanguage: () => Language) {}

  start(): void {
    this.stop();
    this.observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData" && record.target instanceof Text) this.localizeText(record.target);
        for (const node of Array.from(record.addedNodes)) this.localizeNode(node);
        if (record.type === "attributes" && record.target instanceof Element) {
          if (record.attributeName === "class" && record.target.matches(".bookkeeping-dashboard, .bookkeeping-modal, .bookkeeping-settings")) this.localizeNode(record.target);
          else this.localizeAttributes(record.target);
        }
      }
    });
    this.observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "placeholder", "title", "aria-label"] });
    this.refresh();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  refresh(root?: HTMLElement): void {
    const rtl = this.getLanguage() === "ar" || this.getLanguage() === "fa";
    const elements = root
      ? [root]
      : Array.from(document.querySelectorAll<HTMLElement>(".bookkeeping-dashboard, .bookkeeping-modal, .bookkeeping-settings"));
    elements.forEach((element) => {
      element.dir = rtl ? "rtl" : "ltr";
      element.toggleClass("bookkeeping-rtl", rtl);
      this.localizeNode(element);
    });
  }

  private localizeNode(node: Node): void {
    if (!this.belongsToPlugin(node)) return;
    if (node instanceof Text) {
      this.localizeText(node);
      return;
    }
    if (!(node instanceof Element)) return;
    this.localizeAttributes(node);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const current = walker.currentNode;
      if (!this.belongsToPlugin(current)) continue;
      if (current instanceof Text) this.localizeText(current);
      else if (current instanceof Element) this.localizeAttributes(current);
    }
  }

  private localizeText(node: Text): void {
    if (!this.belongsToPlugin(node)) return;
    const previous = this.textStates.get(node);
    const source = previous && node.data === previous.localized ? previous.source : node.data;
    const localized = translate(source, this.getLanguage());
    this.textStates.set(node, { source, localized });
    if (node.data !== localized) node.data = localized;
  }

  private localizeAttributes(element: Element): void {
    if (!this.belongsToPlugin(element)) return;
    const states = this.attributeStates.get(element) ?? new Map<string, TextState>();
    for (const name of ["placeholder", "title", "aria-label"]) {
      const current = element.getAttribute(name);
      if (current === null) continue;
      const previous = states.get(name);
      const source = previous && current === previous.localized ? previous.source : current;
      const localized = translate(source, this.getLanguage());
      states.set(name, { source, localized });
      if (current !== localized) element.setAttribute(name, localized);
    }
    this.attributeStates.set(element, states);
  }

  private belongsToPlugin(node: Node): boolean {
    const element = node instanceof Element ? node : node.parentElement;
    return Boolean(element?.closest(".bookkeeping-dashboard, .bookkeeping-modal, .bookkeeping-settings") && !element.closest(".bookkeeping-user-text"));
  }
}
