# Easy Bookkeeping 2.0.7

## English

Easy Bookkeeping 2.0.7 is a focused desktop alignment and review-compatibility release.

### Changes

- Fixed desktop transaction-editor time and date text so both start at the same position; mobile styling is unchanged.
- Removed the redundant product name from the manifest description.
- Removed the default global hotkey and duplicate plugin-name prefixes from command labels. Users can assign Start bookkeeping from the built-in hotkey settings.
- Replaced two generic span helpers and the deprecated warning-button API with their current equivalents.
- Consolidated equivalent CSS gap declarations and removed a duplicate declaration without changing layout.
- Updated the plugin version and compatibility map, made the settings-footer version follow the manifest automatically at build time, and set its update date to August 18, 2026.

The ledger-folder enumeration recommendation and deprecated settings-tab `display()` warning remain unchanged because addressing them would alter file discovery or require rebuilding the custom settings page.

### Release assets

Install the three attached files directly: `main.js`, `manifest.json`, and `styles.css`.

Cloud-drive mirror: [Quark Drive](https://pan.quark.cn/s/6e91aa90fec6).

## 中文

Easy Bookkeeping 2.0.7 是一次针对电脑端对齐与审核兼容性的修复版本。

### 更新内容

- 修复电脑端编辑账目中时间和日期文字起点不一致的问题；手机端样式保持不变。
- 移除 manifest 描述中的冗余产品名。
- 取消开始记账命令的默认全局快捷键，并移除快捷键命令名称中重复的插件名前缀；用户可在自带快捷键设置中自行分配。
- 将两处通用 span helper 和弃用的警告按钮 API 更新为当前推荐写法。
- 等价合并 CSS 网格间距声明并移除重复声明，不改变现有布局。
- 同步版本号和兼容表；设置页底部版本号改为随 manifest 构建时自动同步，并将更新日期设为 2026 年 8 月 18 日。

账目目录枚举建议与设置页 `display()` 弃用警告暂不处理，因为修改会影响文件发现范围，或需要重建自定义设置页。

### Release 文件

请直接下载并安装本 Release 附件中的三个文件：`main.js`、`manifest.json`、`styles.css`。

网盘镜像：[夸克网盘](https://pan.quark.cn/s/6e91aa90fec6)。
