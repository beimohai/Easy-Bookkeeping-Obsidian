# Easy Bookkeeping 2.0.8

## 中文

Easy Bookkeeping 2.0.8 重点完善自定义录入字段、CSV 配置迁移和大量账目的使用体验。

### 更新内容

- 新增内容型和分类型录入字段，支持表单、全键盘连续记账、账目明细、搜索和筛选。
- 分类型预设支持默认录入值、唯一编号、拖动排序、新增删除，以及恢复到字段创建时的初始状态。内容型留空显示“无”，分类型留空使用默认值。
- 删除自定义字段时增加二次确认，可选择保留历史 Markdown 属性或一并清理。
- CSV 导出可附带完整录入字段配置；导入时可沿用当前配置，或经确认后启用附带配置并清理旧自定义属性。
- 任意筛选结果超过 100 笔时自动分页，避免一次渲染大量行；全选覆盖全部筛选结果，顶部汇总统计不受当前页限制。
- 批量修改支持已启用的分类型录入字段；小型多选筛选的“清除筛选”会立即生效并收起面板。
- Markdown 保留“记账插件”属性作为账目格式标记，不再自动写入无实际用途的“记账”标签；编辑旧账目时会同步清除该自动标签。
- 手机端基础筛选选项面板跟随选择框显示，滑动页面时不会误收起；输入框和选择框按控件高度与电脑端保持相同圆角比例。
- 日历、标签和账户图表筛选会同步条件但不强制展开筛选面板，再次点击同一条件即可取消；日历日期显示为当天到当天。
- 饼图和标签汇总使用当前账目明细的完整筛选结果；输入显示月份之外的日期范围时自动启用跨月筛选。
- 搜索支持所有自定义字段，中文拼音组合完成前不会触发搜索；筛选、选择和分页刷新时保持页面位置。
- 统一预设按钮、删除按钮及分页控件样式，并同步版本、更新日期、README 和插件市场简介。

### Release 文件

请直接下载并安装本 Release 附件中的三个文件：`main.js`、`manifest.json`、`styles.css`。手动覆盖更新时请保留原来的 `data.json`，否则会丢失插件设置。

网盘镜像：[夸克网盘](https://pan.quark.cn/s/6e91aa90fec6)。

## English

Easy Bookkeeping 2.0.8 focuses on custom entry fields, portable CSV field configuration, and reliable browsing for large ledgers.

### Changes

- Added text and select entry fields across forms, keyboard entry, transaction details, search, and filters.
- Select presets now support a default value, unique codes, drag sorting, add/remove actions, and restoring the creation-time snapshot. Empty text fields display “None,” while empty select fields use their default.
- Added a second confirmation when deleting custom fields, with a choice to preserve or remove historical Markdown properties.
- CSV export can include the complete entry-field configuration. Import can keep the current setup or enable the attached configuration after confirmation and old-property cleanup.
- Any result set over 100 transactions now uses fixed pages to avoid excessive DOM growth. Select all covers every filtered result, while summary totals remain independent of the current page.
- Bulk edit supports enabled custom select fields, and clearing a compact multi-select filter applies immediately and collapses its panel.
- Markdown keeps the “记账插件” property as the transaction-format marker and no longer writes the unused automatic “记账” tag. Editing older transactions removes that automatic tag.
- Mobile basic-filter option panels stay below their controls and remain open while the page is scrolled. Mobile input and select corner radii scale with control height to match desktop proportions.
- Calendar, tag, and account chart filters mirror their values without forcing the filter panel open. Clicking the same value again clears it; calendar dates appear as a same-day range.
- Pie charts and tag summaries use the complete filtered transaction-detail result. Entering dates outside the displayed month automatically enables cross-month filtering.
- Search now covers every custom field and waits for IME composition to finish. Filter, selection, and page refreshes preserve the dashboard position.
- Unified preset, delete, and pagination styling and synchronized the version, update date, README, and marketplace summary.

### Release assets

Install the three attached files: `main.js`, `manifest.json`, and `styles.css`. When updating manually, keep the existing `data.json` or plugin settings will be lost.

Cloud-drive mirror: [Quark Drive](https://pan.quark.cn/s/6e91aa90fec6).
