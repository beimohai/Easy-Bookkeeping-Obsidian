# Easy Bookkeeping

<div align="center">

<img src="src/assets/branding/logo.png" alt="Easy Bookkeeping Logo" width="96" />

[中文](README_zh-CN.md) | English

</div>

## Project overview

Easy Bookkeeping is a minimalist local bookkeeping plugin for [Obsidian](https://obsidian.md/), with separate desktop and mobile entry modes. It provides:

- Cross-platform support: use it on phones and computers, and transfer transactions through CSV;
- Multiple languages: support for 12 languages, including Simplified Chinese, Traditional Chinese, English, Japanese, and Korean;
- Minimalist bookkeeping: use concise categories and rapidly enter transactions for different dates in one continuous session;
- Multiple charts: income and expense trends, calendar charts, pie charts, tag summaries, budgets, and account balances;
- Multidimensional tables: clearly display transaction details with multiple sorting methods;
- Flexible filtering: basic filters, range filters, cross-month filters, and filter-result export.

It does not depend on third-party services. All data is stored locally as Markdown files, and the project is completely open source and highly customizable.

Author on Bilibili: [北漠海](https://space.bilibili.com/1065768987)
Introduction video: [bilibili](https://www.bilibili.com/video/BV1po8q69E6j/)
Change log: [ChangeLog.md](ChangeLog.md)

The plugin has not yet undergone long-term use by the author or exhaustive testing. If you encounter a bug, contact the author on Bilibili or join QQ group 588526922. I may not review [Issues](https://github.com/beimohai/Easy-Bookkeeping-Obsidian/issues) and [Pull requests](https://github.com/beimohai/Easy-Bookkeeping-Obsidian/pulls) promptly.

## Quick start

### Install from the Obsidian community plugin catalog

1. Search for **Easy Bookkeeping** under **Settings → Community plugins → Browse**, or [open the plugin page directly](obsidian://show-plugin?id=easy-bookkeeping);
2. Select **Install**, then **Enable**.

### Install from GitHub Releases

1. Download the latest plugin from [Releases](https://github.com/beimohai/Easy-Bookkeeping-Obsidian/releases/latest);
2. Extract it and move the folder into `.obsidian/plugins/` inside your Obsidian vault. You may need to enable the display of hidden folders;
3. Place the three plugin files in that directory;
4. Restart Obsidian and enable **Easy Bookkeeping** under **Settings → Community plugins**.

For a manual update, replace only `main.js`, `manifest.json`, and `styles.css`. Keep the existing `data.json`, or your plugin settings will be lost.

### Install from a cloud drive

1. Open the [Quark Drive link](https://pan.quark.cn/s/6e91aa90fec6), save it, and download the latest plugin;
2. Follow the remaining steps above.

### Install with BRAT

1. Download [BRAT](obsidian://show-plugin?id=obsidian42-brat) from the Obsidian community plugin catalog;
2. Add a new beta plugin and paste `https://github.com/beimohai/Easy-Bookkeeping-Obsidian` into the repository field.

### Build from source

```bash
npm ci
npm run build
```

The production build generates `main.js` in the project root.

## Feature overview

1. **Fast entry and input validation**
   - The desktop mode uses a single-input keyboard workflow for date, account, type, necessity, category, attachment, description, amount, and notes, without requiring a mouse;
   - The mobile mode provides a complete touch-friendly form. The plugin can detect the device automatically or use a manually selected desktop or mobile mode;
   - Continuous entry can be enabled independently on desktop and mobile. Transactions created from the dashboard automatically use the currently displayed month;
   - Date, description, amount, notes, account, type, necessity, category, and attachments follow the configured entry order. Notes can be disabled, while date, description, and amount are always kept;
   - Add text or select entry fields to forms, keyboard entry, and transaction details. Select presets support defaults, unique codes, drag sorting, and restoration to their creation-time snapshot;
   - Amounts accept plain numbers and arithmetic expressions such as `11.4+5.1-4`. A transaction is not created when an input contains invalid characters or more than two decimal places;
   - Desktop entry shortcuts, same-day duplicate-description validation, numeric-only description validation, empty-amount validation, and attachment drag-and-drop are configurable. Global shortcuts are configured through Obsidian's built-in hotkey settings.

2. **Bookkeeping dashboard and yearly statistics**
   - View monthly income, expenses, net balance, and transaction count. Changing the displayed month also changes the month used for entry;
   - Choose whether closing the dashboard resets the page, preserves the current filter, or preserves an independent view for each month;
   - Header actions can be reordered by dragging and either shown directly or placed in the three-dot menu;
   - View a yearly table of monthly income, expenses, net balance, and transaction count, together with configurable yearly charts;
   - Open chart management, tag management, CSV import/export, yearly statistics, rescanning, and settings directly from the dashboard.

3. **Customizable charts**
   - Daily trends support income, expenses, net balance, and account balance, with line, area, and bar styles;
   - Calendar charts support daily income, expenses, and net balance, with any day from Sunday through Saturday as the first day of the week;
   - Pie charts support expense categories, income categories, necessity, account expenses, account income, and account balances, with both amounts and percentages;
   - Tag summaries support income, expenses, net balance, and transaction count, sorted by amount or tag name in ascending or descending order;
   - Budget progress and account balances are independent charts with dedicated editors for budgets and monthly opening balances;
   - Charts can be added, removed, hidden, duplicated, reordered by dragging, and switched between half and full width. Summary cards, pie charts, and tag summaries use the complete filtered transaction-detail result.

4. **Multidimensional transaction details**
   - Customize column names, order, visibility, inline-edit permissions, and widths. Columns can be resized by dragging or restored to their default widths;
   - Permanently visible horizontal scrollbars above and below the table stay synchronized, while the selection column remains fixed on the left;
   - Date order can be locked as the primary sort. Transactions on the same date can then be sorted by time, description, type, necessity, category, account, or amount;
   - When inline editing is enabled, configured columns can directly edit dates, descriptions, preset fields, amount formulas, notes, and tags. Invalid input produces a localized message;
   - Selected transactions can be updated in bulk for date, type, necessity, account, category, enabled custom select fields, and tags, or deleted together;
   - Any result set over 100 transactions uses fixed pages. Select all covers the complete filtered result rather than only the current page;
   - Long descriptions, notes, tags, and preset values are automatically truncated according to the available width.

5. **Linked filters and search**
   - Type, necessity, category, account, tag, and custom select fields support multiple selection, select all, keyword search, and linked values based on the current result;
   - Search descriptions, notes, tags, and every custom field, and set minimum and maximum amounts or start and end dates. Search waits until IME composition is complete;
   - Amount ranges accept only non-negative values with at most two decimal places, and both amount and date ranges validate their lower and upper bounds;
   - Cross-month filtering applies to every filter condition and turns on automatically when the date range extends outside the displayed month;
   - Transaction details, income, expenses, net balance, transaction count, pie charts, and tag summaries use the same filtered result;
   - Selecting an account balance, tag summary, or transaction tag applies the matching filter without changing the current page position or forcing a collapsed filter panel open.

6. **Accounts, budgets, tags, and attachments**
   - Support multiple accounts, custom account codes and order, transfers, editable monthly opening balances, and automatic carry-over;
   - Set overall and category budgets and view their usage in budget progress charts;
   - Add or remove tags on individual transactions, create empty tags, or globally rename, delete, and batch-process tags and related transactions;
   - Tags can be entered directly in notes: leading `#tag` tokens are parsed as tags, spaces separate multiple tags, and parsed tags are not written to the note. Consecutive spaces count as one separator, while note text itself is preserved. After the first space-separated segment that does not start with `#`, everything after it remains note text, even if it contains more spaces or `#` characters;
   - Drop receipts or invoices into the desktop form or select files on mobile. Attachments are stored automatically in the configured folder and named after the corresponding transaction file;
   - Preview attachments in both Markdown files and the transaction editor, then select a preview to open the original file.

7. **Data import, export, and migration**
   - CSV import detects field and preset differences and requests confirmation before converting data to the current settings;
   - CSV can carry the complete entry-field configuration. Import can keep the current setup or enable the attached setup after a second confirmation and old-property cleanup;
   - CSV import and legacy conversion show percentage progress and report failed items with specific reasons;
   - CSV export supports all transactions, the current month, current filtered results, or a custom date range, with configurable filenames and destinations;
   - On desktop, use the operating-system save dialog to export outside the Obsidian vault;
   - Legacy conversion can process a folder inside the vault or import transactions from an external folder while preserving the original files;
   - Expressions found in legacy notes can be migrated to the current expression-storage mode, and duplicate transactions are skipped automatically.

8. **Local storage and safe operations**
   - Every transaction is stored as an independent Markdown file without requiring Dataview, QuickAdd, or Templater;
   - Even when account or category entry is disabled, Markdown still stores a default account and `未分类`;
   - Expressions can optionally be written to notes. When this is disabled, newly saved transactions no longer keep a dedicated expression property, and existing files can be converted after the setting changes;
   - Deletion supports a confirmation dialog and a configurable undo period from 0 to 15 seconds;
   - When deleting a custom entry field, choose whether to preserve its historical Markdown property or remove that property from all existing transactions;
   - File changes refresh automatically, and the dashboard can also be rescanned manually;
   - After publication in the community plugin catalog, updates are handled by Obsidian. Manual installations can be updated by downloading the new files again from GitHub Releases or the cloud-drive mirror.

9. **Extensive customization and multiple languages**
   - Type, necessity, category, and account presets support adding, deleting, renaming, unique custom codes, drag sorting, restoring defaults, and default values;
   - Customize the currency symbol, resettable income and expense colors, number grouping, year-month format, date format, time format, and first day of the week;
   - Charts, header actions, entry fields, transaction columns, column widths, edit permissions, and shortcuts are configurable;
   - Phone, tablet, and desktop layouts adapt to the available width. Mobile summary cards remain in two columns, while charts switch to one column;
   - Supports Simplified Chinese, Traditional Chinese, English, French, Russian, Spanish, Arabic, Japanese, Korean, German, Portuguese, and Persian;
   - The interface, settings, filters, statistics, and messages follow the selected language, while transaction descriptions, user tags, and notes remain unchanged.

## File structure

Each transaction is stored as an independent Markdown file, for example:

```yaml
---
记账插件: true
时间: 2026-07-21 11:45
类型: 支出
标签: 必需
分类: 未分类
账户: 默认账户
内容: 午餐
金额: 19.19
备注: 无
附件: []
---
```

```text
Obsidian/
  └─ 你的存放目录/
	├─ YYYY/
	│	└─ MM/
	│		└─ DD/
	│			└─ 账目文件.md	# 一条账目一个文件
	├─ 导出/
	│	└─ 账目导出.csv
	└─ 附件/
		└─ YYYY/
			└─ MM/
				└─ DD/
					└─ 账目附件.md
```

## Sponsorship and support

If you like my plugin, you can support me here. Thank you!

![WeChat Pay and Alipay payment codes](src/assets/community/support.png)

- [Report a problem](https://github.com/beimohai/Easy-Bookkeeping-Obsidian/issues)
- [Author on GitHub](https://github.com/beimohai)
- [Author on Bilibili](https://space.bilibili.com/1065768987)

## License

This project is open source under the [MIT License](https://github.com/beimohai/Easy-Bookkeeping-Obsidian/blob/main/LICENSE).

_Open source makes the world more wonderful._
