import DOMPurify from "dompurify";
import type { ReviewCard } from "./model";

const tags = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "sup",
  "sub",
  "code",
  "blockquote",
  "h3",
  "h4",
];
export function sanitizeCardHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: tags,
    ALLOWED_ATTR: ["colspan", "rowspan"],
    ALLOW_DATA_ATTR: false,
  });
}
export function cardPlainText(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = sanitizeCardHtml(html);
  root.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
  root
    .querySelectorAll("p,li,tr,h3,h4,blockquote")
    .forEach((el) => el.append("\n"));
  root.querySelectorAll("td,th").forEach((el) => el.append(" "));
  return (root.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}
export function normalizeCardSearch(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
}
/** Insert text nodes/marks after sanitization; search strings are never HTML. */
export function highlightCardHtml(html: string, query: string): string {
  const root = document.createElement("div");
  root.innerHTML = sanitizeCardHtml(html);
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .slice(0, 12);
  if (!terms.length) return root.innerHTML;
  const pattern = new RegExp(
    terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "giu",
  );
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const match of node.data.matchAll(pattern)) {
      fragment.append(node.data.slice(offset, match.index));
      const mark = document.createElement("mark");
      mark.textContent = match[0];
      fragment.append(mark);
      offset = match.index! + match[0].length;
    }
    if (offset) {
      fragment.append(node.data.slice(offset));
      node.replaceWith(fragment);
    }
  }
  return root.innerHTML;
}
export function plainCardHtml(text: string): string {
  const root = document.createElement("div");
  for (const part of text.split(/\n\s*\n/)) {
    const p = document.createElement("p");
    p.textContent = part;
    root.append(p);
  }
  return root.innerHTML;
}
export function answerHtml(card: ReviewCard, query = "") {
  const root = document.createElement("div");
  root.innerHTML = highlightCardHtml(
    card.answerHtml || plainCardHtml(card.body),
    query,
  );
  root.querySelectorAll("table").forEach((table) => {
    const wrapper = document.createElement("div");
    wrapper.className = "card-table-scroll";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", "答案表格，可左右捲動");
    table.replaceWith(wrapper);
    wrapper.append(table);
  });
  return root.innerHTML;
}
/** Optional fields remain compatible with pre-1.8 backups, validated as a unit. */
export function cardDetails(
  value: Record<string, unknown>,
): Partial<ReviewCard> {
  const result: Partial<ReviewCard> = {};
  for (const [name, limit] of [
    ["summary", 500],
    ["context", 4000],
    ["section", 160],
  ] as const) {
    const text = value[name];
    if (text === undefined) continue;
    if (typeof text !== "string" || text.length > limit)
      throw new Error("小卡的速答、章節或題幹格式不正確，尚未加入任何內容。");
    result[name] = text;
  }
  if (value.answerHtml !== undefined) {
    if (typeof value.answerHtml !== "string" || value.answerHtml.length > 40000)
      throw new Error("小卡答案格式不正確，尚未加入任何內容。");
    result.answerHtml = sanitizeCardHtml(value.answerHtml);
  }
  if (value.favorite !== undefined) {
    if (typeof value.favorite !== "boolean")
      throw new Error("小卡收藏格式不正確。");
    result.favorite = value.favorite;
  }
  if (value.kind !== undefined) {
    if (
      !["review", "past", "practice", "glossary"].includes(String(value.kind))
    )
      throw new Error("小卡類型格式不正確。");
    result.kind = value.kind as ReviewCard["kind"];
  }
  if (value.keywords !== undefined) {
    if (
      !Array.isArray(value.keywords) ||
      value.keywords.length > 80 ||
      value.keywords.some((v) => typeof v !== "string" || v.length > 120)
    )
      throw new Error("小卡關鍵字格式不正確。");
    result.keywords = value.keywords;
  }
  if (value.sourcePages !== undefined) {
    if (!Array.isArray(value.sourcePages) || value.sourcePages.length > 20)
      throw new Error("小卡來源頁數格式不正確。");
    let total = 0;
    result.sourcePages = value.sourcePages.map((v) => {
      if (
        !v ||
        !Number.isInteger(v.page) ||
        v.page < 1 ||
        v.page > 200 ||
        typeof v.text !== "string" ||
        v.text.length > 30000 ||
        (total += v.text.length) > 200000
      )
        throw new Error("小卡來源文字格式不正確，尚未加入任何內容。");
      return { page: v.page, text: v.text };
    });
  }
  return result;
}
