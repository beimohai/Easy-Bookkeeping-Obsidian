# Easy Bookkeeping 2.0.9

## 中文

Easy Bookkeeping 2.0.9 重点修复手机版年度图表管理与配置弹窗的窄屏操作问题，并处理 Obsidian 审核中的安全兼容写法。

### 更新内容

- 修复部分窄屏机型中“年度图表管理”的“完成”按钮可能超出可视范围的问题；图表列表改为独立滚动，底部“添加图表 / 完成”操作区保持可见。
- 修复“配置年度图表”操作按钮在窄屏上横向溢出的问题，手机端改为等宽三列布局。
- 移除“配置年度图表”弹窗中的“隐藏图表”按钮；图表显示与隐藏仍可在“年度图表管理”中通过眼睛按钮控制。
- 输入事件改用 Obsidian 跨窗口安全的 `instanceOf(InputEvent)`，避免跨窗口环境中原生 `instanceof` 判断失效。
- 移除两处无意义的类型断言、一个返回组件的 void 回调和一个多余的 `TFile` 强制断言，不改变原有业务逻辑。
- 版本更新为 2.0.9，同步插件底部更新日期、版本兼容表和新版插件市场介绍文案。

### Release 文件

请直接下载并安装本 Release 附件中的三个文件：`main.js`、`manifest.json`、`styles.css`。手动覆盖更新时请保留原来的 `data.json`，否则会丢失插件设置。

网盘镜像：[夸克网盘](https://pan.quark.cn/s/6e91aa90fec6)。

## English

Easy Bookkeeping 2.0.9 fixes narrow-screen controls in annual-chart management and settings, while adopting safer Obsidian review-compatible type checks.

### Changes

- Fixed narrow-screen devices where the Manage Annual Charts “Done” button could move outside the visible area. The chart list now scrolls independently while the Add Chart and Done footer remains visible.
- Prevented annual-chart settings actions from overflowing horizontally by using three equal-width mobile columns.
- Removed the Hide Chart action from the annual-chart settings dialog. Chart visibility remains available through the eye control in Manage Annual Charts.
- Replaced native `instanceof InputEvent` with Obsidian's cross-window-safe `instanceOf(InputEvent)` check.
- Removed two unnecessary type assertions, a component-returning void callback, and a redundant `TFile` cast without changing existing behavior.
- Updated the version to 2.0.9 and synchronized the settings-footer date, compatibility map, and revised marketplace-description copy.

### Release assets

Install the three attached files: `main.js`, `manifest.json`, and `styles.css`. When updating manually, keep the existing `data.json` or plugin settings will be lost.

Cloud-drive mirror: [Quark Drive](https://pan.quark.cn/s/6e91aa90fec6).
