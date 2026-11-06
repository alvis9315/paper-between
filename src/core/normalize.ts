import DOMPurify from "dompurify";
import type { Block, Notebook } from "./model";

const allowed = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "br",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "a",
  "blockquote",
  "sup",
  "sub",
  "figure",
  "figcaption",
  "div",
];
export function normalizeHtml(
  html: string,
  title: string,
  warnings: string[] = [],
): Notebook {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowed,
    ALLOWED_ATTR: [
      "href",
      "start",
      "colspan",
      "rowspan",
      "data-block-id",
      "data-media-id",
      "data-width",
      "data-height",
      "data-layout",
      "data-alt",
      "data-figure-body",
    ],
    ALLOW_DATA_ATTR: false,
  });
  const root = document.createElement("div");
  root.innerHTML = clean;
  root
    .querySelectorAll("br")
    .forEach((br) => br.replaceWith(document.createTextNode("\n")));
  root
    .querySelectorAll("[rowspan]")
    .forEach((cell) => cell.removeAttribute("rowspan"));
  root.querySelectorAll("a").forEach((a) => {
    if (!/^(https?:|mailto:)/i.test(a.getAttribute("href") || ""))
      a.removeAttribute("href");
    else {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
  });
  const blocks: Block[] = [];
  const id = crypto.randomUUID();
  const usedIds = new Set<string>();
  function add(
    el: HTMLElement,
    kind: Block["kind"],
    extra: Partial<Block> = {},
  ) {
    if (!el.textContent?.trim() && kind !== "figure") return;
    const requested = extra.id || el.dataset.blockId;
    const blockId =
      requested &&
      /^[A-Za-z0-9_-]{1,180}$/.test(requested) &&
      !usedIds.has(requested)
        ? requested
        : `${id}-${blocks.length}`;
    usedIds.add(blockId);
    blocks.push({
      kind,
      html: el.outerHTML,
      text: el.textContent,
      ...extra,
      id: blockId,
    });
  }
  function visit(el: HTMLElement, depth = 0, ordered = false, number = 1) {
    const tag = el.tagName.toLowerCase();
    if (tag === "figure") {
      const mediaId = el.dataset.mediaId || "";
      const width = Number(el.dataset.width);
      const height = Number(el.dataset.height);
      if (
        !/^m-[a-f0-9]{64}$/.test(mediaId) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width < 1 ||
        height < 1 ||
        width > 2000 ||
        height > 2000
      )
        throw new Error("圖文區塊缺少有效的圖片資料，請重新選擇圖片。");
      add(el, "figure", {
        image: {
          mediaId,
          width,
          height,
          alt: el.dataset.alt || "筆記圖片",
          layout: el.dataset.layout === "stacked" ? "stacked" : "side",
        },
      });
    } else if (/^h[1-6]$/.test(tag))
      add(el, "heading", { level: Number(tag[1]) });
    else if (tag === "ul" || tag === "ol") {
      let n = Number(el.getAttribute("start") || 1);
      for (const child of [...el.children])
        visit(child as HTMLElement, depth + 1, tag === "ol", n++);
    } else if (tag === "li") {
      const copy = el.cloneNode(true) as HTMLElement;
      copy.querySelectorAll("ul,ol").forEach((n) => n.remove());
      const p = document.createElement("div");
      p.className = "list-item";
      p.dataset.marker = ordered ? `${number}.` : "•";
      p.style.setProperty("--indent", String(Math.min(depth, 5)));
      p.innerHTML = copy.innerHTML;
      add(p, "list", { id: el.dataset.blockId });
      for (const child of [...el.children])
        if (/^(UL|OL)$/.test(child.tagName)) visit(child as HTMLElement, depth);
    } else if (tag === "table") {
      const tableId = `${id}-table-${blocks.length}`;
      const rows = [...el.querySelectorAll("tr")].filter(
        (r) => r.closest("table") === el,
      );
      const first = rows[0];
      const hasHeader =
        !!first &&
        (first.querySelector("th") !== null ||
          first.parentElement?.tagName === "THEAD");
      const header = hasHeader ? first.outerHTML : "";
      rows.forEach((row, i) => {
        const table = document.createElement("table");
        const body = document.createElement("tbody");
        body.append(row.cloneNode(true));
        table.append(body);
        add(table, "row", {
          tableId,
          header,
          headerOnly: hasHeader && i === 0,
          id: (row as HTMLElement).dataset.blockId,
        });
      });
    } else if (["p", "blockquote"].includes(tag)) add(el, "paragraph");
    else if (el.children.length)
      for (const child of [...el.children]) visit(child as HTMLElement);
    else {
      const p = document.createElement("p");
      p.textContent = el.textContent;
      add(p, "paragraph");
    }
  }
  for (const node of [...root.childNodes]) {
    if (node instanceof HTMLElement) visit(node);
    else if (node.textContent?.trim()) {
      const p = document.createElement("p");
      p.textContent = node.textContent;
      add(p, "paragraph");
    }
  }
  if (!blocks.length)
    throw new Error(
      "文件中沒有可閱讀的文字。請確認 Word 文件含有文字段落或表格。",
    );
  return { id, title, blocks, warnings: [...new Set(warnings)] };
}

export function sliceHtml(html: string, start: number, end: number): string {
  const root = document.createElement("div");
  root.innerHTML = html;
  let cursor = 0;
  function clip(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      const base = cursor;
      cursor += text.length;
      const value = text.slice(
        Math.max(0, start - base),
        Math.max(0, Math.min(text.length, end - base)),
      );
      return value ? document.createTextNode(value) : null;
    }
    const copy = node.cloneNode(false);
    for (const child of [...node.childNodes]) {
      const result = clip(child);
      if (result) copy.appendChild(result);
    }
    return copy;
  }
  const result = document.createElement("div");
  for (const child of [...root.childNodes]) {
    const copy = clip(child);
    if (copy) result.append(copy);
  }
  return result.innerHTML;
}
