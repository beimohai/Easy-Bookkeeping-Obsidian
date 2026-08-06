export interface PointerSortOptions {
  root: HTMLElement;
  item: HTMLElement;
  handle: HTMLElement;
  itemSelector: string;
  onCommit: (source: HTMLElement, target: HTMLElement | null) => void | Promise<void>;
}

export function bindPointerSort({ root, item, handle, itemSelector, onCommit }: PointerSortOptions): void {
  handle.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    let target: HTMLElement | null = null;

    const move = (moveEvent: PointerEvent): void => {
      if (moveEvent.pointerId !== pointerId) return;
      if (!active && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 5) return;
      if (!active) {
        active = true;
        item.classList.add("is-dragging", "is-pointer-dragging");
        document.body.addClass("bookkeeping-is-pointer-sorting");
      }
      moveEvent.preventDefault();
      item.setCssStyles({ pointerEvents: "none" });
      const below = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      item.setCssStyles({ pointerEvents: "" });
      const candidate = below instanceof Element ? below.closest<HTMLElement>(itemSelector) : null;
      root.querySelectorAll(".is-drop-target").forEach((element) => element.removeClass("is-drop-target"));
      if (!candidate || candidate === item || !root.contains(candidate)) return;
      target = candidate;
      candidate.addClass("is-drop-target");
      const parent = candidate.parentElement;
      if (!parent) return;
      const rect = candidate.getBoundingClientRect();
      const before = moveEvent.clientY < rect.top + rect.height / 2;
      parent.insertBefore(item, before ? candidate : candidate.nextSibling);
    };

    const end = (endEvent: PointerEvent): void => {
      if (endEvent.pointerId !== pointerId) return;
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
      root.querySelectorAll(".is-drop-target").forEach((element) => element.removeClass("is-drop-target"));
      item.classList.remove("is-dragging", "is-pointer-dragging");
      document.body.removeClass("bookkeeping-is-pointer-sorting");
      if (active) void onCommit(item, target);
    };

    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  });
}
