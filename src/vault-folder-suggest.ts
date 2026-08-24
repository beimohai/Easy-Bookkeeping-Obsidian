import { AbstractInputSuggest, App, TFolder, setIcon } from "obsidian";

export class VaultFolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(app: App, private readonly inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.limit = 100;
  }

  protected getSuggestions(query: string): TFolder[] {
    const normalized = query.trim().replace(/^\/+|\/+$/g, "").toLocaleLowerCase();
    const folders = [
      this.app.vault.getRoot(),
      ...this.app.vault.getAllLoadedFiles().filter((file): file is TFolder => file instanceof TFolder && !file.isRoot())
    ];
    return folders
      .filter((folder) => !normalized || folder.isRoot() || folder.path.toLocaleLowerCase().includes(normalized))
      .sort((a, b) => {
        if (a.isRoot()) return -1;
        if (b.isRoot()) return 1;
        return a.path.localeCompare(b.path, "zh-CN", { numeric: true });
      });
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    const icon = el.createSpan({ cls: "bookkeeping-folder-suggestion-icon" });
    setIcon(icon, "folder");
    el.createSpan({ text: folder.isRoot() ? "/（仓库根目录）" : folder.path });
  }

  selectSuggestion(folder: TFolder): void {
    this.setValue(folder.isRoot() ? "/" : folder.path);
    this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    this.inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    this.close();
  }
}
