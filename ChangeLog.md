# 更新日志 Changelog

* [V2.0.3](https://github.com/beimohai/Easy-Bookkeeping-Obsidian/releases/tag/2.0.3) 2026-08-07
  * 审核修复与规范优化
    * 将 manifest 描述改为英文并使用审核器可识别的英文句点结尾。
    * 移除设置页重复插件名标题，并继续保持由 Obsidian 插件市场负责更新。
    * 为 Release 工作流加入 GitHub Artifact Attestations，便于验证 `main.js`、`manifest.json`、`styles.css` 的来源。
    * 优化部分审核 Warning：改用 Obsidian SVG/DOM helper、`messageEl`、`setDestructive()`、跨窗口安全类型判断，并清理不必要的空 catch、全角空格和正则转义。
  * Review fixes and compliance improvements
    * Replaced the manifest description with English text and ended it with an ASCII period recognized by the review tool.
    * Removed the duplicated plugin-name heading from settings and kept updates delegated to the Obsidian community plugin catalog.
    * Added GitHub Artifact Attestations to the Release workflow for `main.js`, `manifest.json`, and `styles.css`.
    * Reduced review warnings by using Obsidian SVG/DOM helpers, `messageEl`, `setDestructive()`, cross-window-safe type checks, and by cleaning up empty catches, irregular whitespace, and regex escapes.


* [V2.0.2](https://github.com/beimohai/Easy-Bookkeeping-Obsidian/releases/tag/2.0.2) 2026-08-06
  * 发布规范与文档
    * 将插件版本同步到 2.0.2，并改用不带 `v` 的 GitHub tag。
    * 修复 Obsidian 插件市场审核指出的 manifest 描述、作者链接、最低版本和样式赋值问题。
    * Release 仅上传 `main.js`、`manifest.json`、`styles.css` 三个官方安装文件。
    * README 增加插件 Logo、修正中英文切换链接，并同步 GitHub Releases 与夸克网盘安装说明。
    * 去除插件内检查更新与自动下载更新功能，上传插件市场后交由 Obsidian 负责更新。
  * Release compliance and documentation
    * Updated the plugin version to 2.0.2 and switched GitHub tags to the non-`v` format.
    * Fixed manifest metadata, author URL, minimum app version, and style-assignment issues reported by the community plugin review.
    * Release assets now include only the three official installation files: `main.js`, `manifest.json`, and `styles.css`.
    * Added the plugin logo to the READMEs, fixed bilingual language-switch links, and synchronized GitHub Releases plus Quark Drive installation notes.
    * Removed the in-plugin update checker and automatic download updater; updates should be handled by Obsidian after community catalog publication.


* V2.0.0 2026-08-04
  * 插件化重构
    * 将原有 Templater 与 Dataview 模板项目重构为独立的 Obsidian 插件，不再依赖其他社区插件。
    * 每笔账目继续保存为独立 Markdown 文件，并保留稳定的账户、分类、算式和附件字段。
    * 新增从旧版 Markdown 模板账目迁移到新版 Properties 的转换工具。
  * 记账录入
    * 新增桌面版全键盘连续记账和手机版完整表单，并支持自动识别设备。
    * 账户、类型、必要性、分类和附件可独立启用、拖动排序和设置默认值。
    * 类型、必要性、分类和账户预设支持新增、删除、重命名、自定义唯一编号与排序。
    * 金额支持四则运算表达式，并严格校验负数、非法字符和超过两位小数的输入。
    * 新增可配置的桌面记账快捷键、全局快捷键、连续记账、重复内容校验和附件录入。
  * 仪表盘与图表
    * 新增月度收入、支出、结余与账目数量统计，以及分月年度汇总表格。
    * 新增收入、支出、结余和余额趋势图，可切换折线、面积和柱状样式。
    * 新增日历收支、分类与账户饼状图、标签汇总、预算进度和账户余额图表。
    * 图表支持添加、删除、隐藏、复制配置、拖动排序和半栏或通栏宽度。
    * 新增年度单列图表管理，并让统计卡片与所有图表同步使用当前筛选结果。
  * 账目明细与筛选
    * 表头支持重命名、显示、排序、行内编辑权限、拖动列宽和恢复默认列宽。
    * 新增日期主排序锁和同日次级排序，并正确处理带正负号的金额排序。
    * 新增类型、必要性、分类、账户和标签联动多选，以及关键词、金额、日期和跨月筛选。
    * 新增行内编辑、标签交互、批量修改、批量删除和底部返回顶部按钮。
    * 上下横向滚动条常驻显示并与表格同步，选择列固定在最左侧。
  * 账户、预算、标签与附件
    * 新增多账户、账户编号和排序、转账、逐月月初余额校准与自动结转。
    * 新增总预算、分类预算及专用预算编辑界面。
    * 新增标签重命名、删除、批量管理和相关账目处理。
    * 新增小票与发票附件拖放、手机文件选择、自动命名、Markdown 预览和编辑面板预览。
  * 数据与文件
    * 新增 CSV 导入、字段转换确认、失败行原因和百分比进度。
    * 新增可配置范围、文件名与位置的 CSV 导出；桌面端可保存到仓库外目录。
    * 新增仓库内与外部文件夹两种旧账转换方式、重复账目跳过和算式迁移。
    * 新增二次删除确认、0—15 秒撤销删除和标签批量文件更新。
  * 界面、格式与本地化
    * 新增收入与支出颜色、货币符号、三种金额分位方式、多种年月与日期格式、12/24 小时制和任意每周起始日。
    * 新增简体中文、繁体中文、英语、法语、俄语、西班牙语、阿拉伯语、日语、韩语、德语、葡萄牙语和波斯语界面。
    * 重做桌面、手机和平板响应式布局，改进触控拖动、输入框、按钮、对齐、安全区和横向滚动体验。
    * 修复打开仪表盘或设置交互时页面跳动、删除状态残留、空结果表头消失及多个移动端控件错位问题。
    * 修复手机端颜色选择框被设置布局拉伸为椭圆的问题。
    * 新增页面保持模式、返回顶部按钮、社区支持面板、版本信息和 GitHub Release 安装说明。
  * Plugin architecture
    * Rebuilt the original Templater and Dataview template project as a standalone Obsidian plugin with no community-plugin dependency.
    * Preserved one Markdown file per transaction with stable account, category, expression, and attachment properties.
    * Added migration from legacy template-based Markdown transactions to the new Properties format.
  * Transaction entry
    * Added keyboard-only continuous desktop entry, a complete mobile form, and automatic device detection.
    * Made account, type, necessity, category, and attachment fields independently configurable and sortable.
    * Added creation, deletion, renaming, unique custom codes, ordering, and defaults for type, necessity, category, and account presets.
    * Added arithmetic amount expressions with strict validation for signs, invalid characters, and values exceeding two decimal places.
    * Added configurable entry and global shortcuts, continuous entry, duplicate-description validation, and attachments.
  * Dashboard and charts
    * Added monthly income, expense, net, and transaction-count summaries plus a monthly yearly-summary table.
    * Added expense, income, net, and balance trends with line, area, and bar styles.
    * Added calendar results, category and account pie charts, tag summaries, budget progress, and account balances.
    * Added chart creation, removal, visibility, configuration duplication, drag sorting, and half/full widths.
    * Added single-column yearly chart management and synchronized all cards and charts with active filters.
  * Transaction details and filters
    * Added customizable labels, visibility, order, inline-edit permissions, resizable widths, and automatic-width restoration.
    * Added a primary date-sort lock and same-date secondary sorting, including correct signed-amount order.
    * Added linked multi-value filters for type, necessity, category, account, and tags, plus keyword, amount, date, and cross-month filters.
    * Added inline editing, tag interaction, bulk editing, bulk deletion, and a floating back-to-top action.
    * Added permanently visible synchronized horizontal scrollbars above and below the table, with a fixed left selection column.
  * Accounts, budgets, tags, and attachments
    * Added multiple accounts, account codes and order, transfers, monthly opening-balance corrections, and automatic carry-over.
    * Added overall and category budgets with a dedicated budget editor.
    * Added global tag rename, deletion, bulk management, and related-transaction handling.
    * Added receipt and invoice drag-and-drop, mobile file selection, automatic naming, Markdown previews, and editor previews.
  * Data and files
    * Added CSV import with field-conversion confirmation, failed-row reasons, and percentage progress.
    * Added CSV export with configurable scope, name, and location, including external desktop destinations.
    * Added vault and external-folder legacy conversion, duplicate skipping, and expression migration.
    * Added delete confirmation, a configurable 0–15 second undo window, and bulk tag file updates.
  * Interface, formats, and localization
    * Added configurable income and expense colors, currency symbol, three grouping styles, year-month and date formats, 12/24-hour time, and any first day of the week.
    * Added Simplified Chinese, Traditional Chinese, English, French, Russian, Spanish, Arabic, Japanese, Korean, German, Portuguese, and Persian interfaces.
    * Rebuilt responsive desktop, phone, and tablet layouts and improved touch sorting, inputs, actions, alignment, safe areas, and horizontal scrolling.
    * Fixed page jumps on dashboard or settings interaction, stale deletion state, missing empty-result headers, and multiple mobile control alignment issues.
    * Fixed the mobile color picker being stretched into an oval by the settings layout.
    * Added dashboard state persistence, a back-to-top action, community panels, version details, and GitHub Release installation notes.

* [V1.4](https://github.com/beimohai/Easy-Bookkeeping-Obsidian/commit/ff22802) 2025-07-25
  * 文档修复
    * 修复 README 中示例图片在 GitHub 页面无法显示的问题。
    * 将 Obsidian 内部嵌入语法改为标准 Markdown 图片链接。
  * Documentation fixes
    * Fixed example images that were not displayed on GitHub.
    * Replaced Obsidian embed syntax with standard Markdown image links.

* [V1.3](https://github.com/beimohai/Easy-Bookkeeping-Obsidian/commit/615b744) 2025-07-25
  * 文档排版
    * 调整 README 示例图片区域的排版和间距。
  * Documentation layout
    * Adjusted spacing and layout around README example images.

* [V1.2](https://github.com/beimohai/Easy-Bookkeeping-Obsidian/commit/fe99723) 2025-07-25
  * 模板整理
    * 将单日记账、多日记账和月汇总模板统一移动到 `Template/` 目录。
    * 更新 README 的模板下载和使用说明，并修正文件结构示例缩进。
  * Template organization
    * Moved the single-day, multi-day, and monthly-summary templates into `Template/`.
    * Updated the README instructions and corrected the directory-tree indentation.

* [V1.1](https://github.com/beimohai/Easy-Bookkeeping-Obsidian/commit/450347b) 2025-07-25
  * 文档修复
    * 修正 README 中 Obsidian、模板、账目和汇总目录树的排版。
  * Documentation fixes
    * Corrected the README directory tree for the vault, templates, transactions, and summaries.

* [V1.0](https://github.com/beimohai/Easy-Bookkeeping-Obsidian/commit/70139e3) 2025-07-25
  * 首次发布
    * 首次公开基于模板的 Easy Bookkeeping。
    * 提供单日记账、多日连续记账和月汇总模板。
    * 使用 Templater 录入账目，使用 Dataview JS 汇总月度数据。
    * 按日期和账目名称拼音排序，并提供记账与月汇总示例图片。
  * Initial release
    * Published the first template-based version of Easy Bookkeeping.
    * Added single-day, multi-day continuous-entry, and monthly-summary templates.
    * Used Templater for entry and Dataview JS for monthly summaries.
    * Sorted transactions by date and description pinyin and added example images.
