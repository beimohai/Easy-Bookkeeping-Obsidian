# Easy Bookkeeping 2.0.6

## English

Easy Bookkeeping 2.0.6 focuses on entry ordering, editor consistency, tag workflows, and Obsidian-native hotkeys.

### Changes

- Entry-field ordering now includes date, description, amount, notes, and attachments. Attachments follow the configured order in both desktop entry and the editor.
- Attachments now default after notes in the entry-field order, and changing entry-field visibility no longer changes table column visibility.
- Added settings for numeric-only descriptions and empty amounts. Empty amounts can be saved as `0` when enabled, with updated setting descriptions.
- Updated desktop continuous-entry placeholders and validation text, including date, type, necessity, amount, content, notes, and attachment hints.
- The transaction editor now follows the entry order, shows disabled fields, aligns attachment/input widths, formats tags as `#tag`, and reports multiple validation errors together.
- On phones, header actions fill the available first row before wrapping; editor labels and controls stay aligned, time/date values use leading aligned icons and left-aligned text, and irrelevant target-account rows stay hidden.
- Attachment drop zones match the input width on desktop and mobile, attachment hints are limited to two lines, and the notes field starts at two lines.
- Empty placeholders are lighter so they remain visually distinct from entered values.
- Tag management can create new tags, cancel rename mode, and shows clearer rename feedback.
- The first-transaction empty state now uses the plugin logo while the left ribbon keeps Obsidian's icon. CSV import/export are collapsed into the three-dot menu by default.
- Chart empty states are vertically centered, tag-summary clicks no longer open the filter panel, and default date-column width is tightened.
- Selecting transactions no longer resets table widths, and hover/selection highlighting now spans the full row. The selection/date columns remain compact.
- Desktop editor time/date typography and leading picker icons are aligned; range-filter separators are vertically centered, and the trend axis/calendar cells plus their bottom summaries share matching baselines.
- Calendar expense/income legend edges align with the first and last date-cell borders, while month-balance spacing remains even.
- Global shortcuts moved to Obsidian's built-in hotkey settings. Start bookkeeping defaults to `Cmd/Ctrl+Shift+N`; other commands have no default hotkey.
- Income and expense colors can be reset. Type, necessity, category, and account preset panels can restore defaults.
- New transactions no longer keep a dedicated expression property when “write expressions to notes” is disabled.
- README documents note-based `#tag` parsing and the storage behavior change.

### Release assets

Install the three attached files directly: `main.js`, `manifest.json`, and `styles.css`.

Cloud-drive mirror: [Quark Drive](https://pan.quark.cn/s/6e91aa90fec6).

## 中文

Easy Bookkeeping 2.0.6 重点优化录入顺序、编辑面板一致性、标签流程和 Obsidian 原生快捷键。

### 更新内容

- 录入字段排序扩展到日期、内容、金额、备注和附件；附件在桌面录入和编辑面板中都会跟随设置顺序。
- 附件默认排在备注后，调整录入字段显示状态时不再联动账目明细表头显示状态。
- 新增内容纯数字与金额留空开关；允许金额为空时会按 `0` 保存，并同步更新设置注释。
- 优化桌面连续记账的日期、类型、必要性、金额、内容、备注和附件提示文案。
- 编辑面板按录入顺序展示，关闭的字段也会显示；附件框和输入框宽度对齐，标签按 `#标签` 显示，并可一次展示多个错误。
- 手机端顶部按钮会先排满第一行再换行；编辑面板标签和控件保持对齐，时间和日期使用左侧对齐图标及左对齐文字，并隐藏无效的转入账户行。
- 电脑和手机端的附件拖动框均与输入栏等宽，附件提示最多显示两行，备注初始高度为两行。
- 未输入占位文字进一步调浅，与已输入内容保持清晰区别。
- 标签批量管理支持新建标签、取消重命名，并优化重命名完成提示。
- “开始建立你的第一笔账目”空状态使用插件 Logo，左侧 ribbon 保留 Obsidian 图标；导出和导入 CSV 默认收进三点菜单。
- 图表空状态上下居中，点击标签汇总只应用筛选、不自动展开筛选栏，默认日期列宽收窄。
- 选择账目不再重置表格列宽，悬停和选中状态会覆盖整行，并保持选择列和日期列紧凑。
- 统一电脑端编辑面板的时间、日期字体和左侧选择图标；范围筛选分隔线垂直居中，趋势图横坐标、日历日期框及底部说明文字相互对齐。
- 日历收支两侧图例与首末日期框边缘对齐，月结余上下留白保持一致。
- 全局快捷键并入 Obsidian 自带快捷键设置；开始记账默认 `Cmd/Ctrl+Shift+N`，其他命令默认留空。
- 收入和支出颜色支持重置；类型、必要性、分类和账户四个预设面板支持恢复默认。
- 关闭“把算式写入备注”后，新建账目不再专门保留算式字段。
- README 补充备注中 `#标签` 的解析规则和算式存储行为。

### Release 文件

请直接下载并安装本 Release 附件中的三个文件：`main.js`、`manifest.json`、`styles.css`。

网盘镜像：[夸克网盘](https://pan.quark.cn/s/6e91aa90fec6)。
