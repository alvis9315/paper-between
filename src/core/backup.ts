import { normalizeHtml } from "./normalize";
import { createRecord } from "./library";
import type { BookRecord, Notebook } from "./model";
export function notebookHtml(doc: Notebook): string {
  const root = document.createElement("div");
  let currentTable: HTMLTableElement | undefined;
  let tableId: string | undefined;
  const lists: {
    list: HTMLOListElement | HTMLUListElement;
    last: HTMLLIElement;
    next?: number;
  }[] = [];
  for (const block of doc.blocks) {
    const holder = document.createElement("div");
    holder.innerHTML = block.html;
    const stable = holder.firstElementChild as HTMLElement | null;
    if (stable) stable.dataset.blockId = block.id;
    if (block.kind === "row") {
      lists.length = 0;
      if (!currentTable || tableId !== block.tableId) {
        currentTable = document.createElement("table");
        root.append(currentTable);
        tableId = block.tableId;
      }
      const row = holder.querySelector("tr");
      if (row) {
        (row as HTMLElement).dataset.blockId = block.id;
        const group = document.createElement(
          block.headerOnly ? "thead" : "tbody",
        );
        group.append(row);
        currentTable.append(group);
      }
    } else {
      currentTable = undefined;
      tableId = undefined;
      if (block.kind === "list") {
        const item = holder.firstElementChild as HTMLElement;
        const marker = item?.dataset.marker || "•";
        const number = /^\d/.test(marker)
          ? Number(marker.replace(/\D/g, ""))
          : undefined;
        const depth = Math.max(
          1,
          Math.min(
            5,
            Number(item.style.getPropertyValue("--indent")) || 1,
            lists.length + 1,
          ),
        );
        lists.length = Math.min(lists.length, depth);
        let current = lists[depth - 1];
        if (
          !current ||
          current.list.tagName !== (number === undefined ? "UL" : "OL") ||
          (number !== undefined && current.next !== number)
        ) {
          const list = document.createElement(
            number === undefined ? "ul" : "ol",
          );
          if (number !== undefined) list.setAttribute("start", String(number));
          (depth === 1 ? root : lists[depth - 2]!.last).append(list);
          current = { list, last: document.createElement("li") };
          lists[depth - 1] = current;
        }
        const li = document.createElement("li");
        li.dataset.blockId = block.id;
        li.innerHTML = item?.innerHTML || "";
        current.list.append(li);
        current.last = li;
        current.next = number === undefined ? undefined : number + 1;
      } else {
        lists.length = 0;
        root.append(...holder.childNodes);
      }
    }
  }
  return root.innerHTML;
}
export function exportBackup(books: BookRecord[]): string {
  return JSON.stringify({
    format: "paper-between-bookshelf",
    version: 1,
    books: books.map((b) => ({
      title: b.document.title,
      html: notebookHtml(b.document),
      warnings: b.document.warnings,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      deletedAt: b.deletedAt,
      progress: b.progress,
      favorite: b.favorite === true,
      position: {
        block: b.document.blocks.findIndex((x) => x.id === b.anchor.blockId),
        offset: b.anchor.offset,
      },
    })),
  });
}
export function importBackup(text: string): BookRecord[] {
  if (text.length > 50 * 1024 * 1024)
    throw new Error("備份超過 50MB，無法在此瀏覽器還原。");
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("無法讀取備份，請選擇頁白匯出的 JSON 備份。");
  }
  if (
    data?.format !== "paper-between-bookshelf" ||
    data.version !== 1 ||
    !Array.isArray(data.books) ||
    data.books.length > 500 ||
    !data.books.length
  )
    throw new Error("這不是支援的頁白書架備份。");
  return data.books.map((b: any) => {
    if (
      typeof b.title !== "string" ||
      typeof b.html !== "string" ||
      !b.html.trim() ||
      b.html.length > 4_000_000
    )
      throw new Error("備份含有不完整或過大的筆記，尚未匯入任何內容。");
    const doc = normalizeHtml(
      b.html,
      b.title.trim().slice(0, 120) || "還原的筆記",
    );
    const block =
      doc.blocks[
        Math.max(
          0,
          Math.min(
            doc.blocks.length - 1,
            Number.isInteger(b.position?.block) ? b.position.block : 0,
          ),
        )
      ]!;
    const offset = Number.isInteger(b.position?.offset)
      ? Math.max(0, Math.min(block.text.length - 1, b.position.offset))
      : 0;
    const record = createRecord(doc, { blockId: block.id, offset });
    if (
      Number.isFinite(b.createdAt) &&
      b.createdAt > 0 &&
      Number.isFinite(new Date(b.createdAt).getTime())
    )
      record.createdAt = b.createdAt;
    if (
      Number.isFinite(b.updatedAt) &&
      b.updatedAt > 0 &&
      Number.isFinite(new Date(b.updatedAt).getTime())
    )
      record.updatedAt = b.updatedAt;
    if (
      Number.isFinite(b.deletedAt) &&
      b.deletedAt > 0 &&
      Number.isFinite(new Date(b.deletedAt).getTime())
    )
      record.deletedAt = b.deletedAt;
    if (Number.isFinite(b.progress))
      record.progress = Math.max(0, Math.min(1, b.progress));
    doc.warnings = Array.isArray(b.warnings)
      ? b.warnings.filter((w: unknown) => typeof w === "string").slice(0, 100)
      : [];
    record.favorite = b.favorite === true;
    return record;
  });
}
