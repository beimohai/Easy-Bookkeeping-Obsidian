# Easy Bookkeeping 2.0.11

## 中文

Easy Bookkeeping 2.0.11 修复了手机账目面板中“转账”类型的可见性与可用性问题，并统一所有录入和编辑入口的转账条件。

### 更新内容

- 修复手机账目面板中账户字段已显示、但“转账”类型因账户条件被隐藏的界面矛盾。
- 统一普通录入、全键盘连续记账、账目行内编辑和批量修改的转账可用条件：需启用类型和账户功能，并至少配置两个账户。
- 条件未满足时，普通录入面板保留“转账（暂不可用）”并明确提示原因；满足条件后可正常选择，并显示转入账户。
- 防止新建账目在转账不可用时仍沿用“转账”默认类型，改为使用第一个可用的非转账类型。
- CSV 导入和底层 Markdown 写入会拒绝不满足转账条件或缺少有效转入账户的数据，避免绕过界面限制产生无效账目。
- 更新中英文 README，说明录入转账需要启用账户并配置至少两个账户。

### Release 文件

请直接下载并安装本 Release 附件中的三个文件：`main.js`、`manifest.json`、`styles.css`。手动覆盖更新时请保留原来的 `data.json`，否则会丢失插件设置。

网盘镜像：[夸克网盘](https://pan.quark.cn/s/6e91aa90fec6)。

## English

Easy Bookkeeping 2.0.11 fixes Transfer-type visibility and availability in the mobile transaction editor, and unifies transfer requirements across every entry and editing path.

### Changes

- Fixed the inconsistent mobile editor state where the account field could be visible while the Transfer type was hidden by account requirements.
- Unified transfer availability across standard entry, keyboard entry, inline transaction editing, and bulk editing: type and account features must be enabled and at least two accounts must be configured.
- When unavailable, the standard editor retains a disabled “Transfer (unavailable)” option with an explanation. Once requirements are met, it can be selected normally and shows the target-account field.
- Prevented new transactions from retaining Transfer as their default type when transfers are unavailable; the first available non-transfer type is used instead.
- CSV import and the underlying Markdown write boundary reject transfers that do not meet the requirements or lack a valid target account, preventing invalid transactions from bypassing the UI.
- Updated both READMEs to explain that recording a transfer requires enabled accounts and at least two configured accounts.

### Release assets

Install the three attached files: `main.js`, `manifest.json`, and `styles.css`. When updating manually, keep the existing `data.json` or plugin settings will be lost.

Cloud-drive mirror: [Quark Drive](https://pan.quark.cn/s/6e91aa90fec6).
