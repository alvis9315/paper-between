import { normalizeHtml } from "./normalize";
import type { Notebook } from "./model";

export const MAX_TEXT_LENGTH = 200_000;

function appendInline(element: HTMLElement, text: string, format: boolean) {
  if (!format) {
    element.textContent = text;
    return;
  }
  let cursor = 0;
  for (const match of text.matchAll(/\*\*([^*\n]+)\*\*/g)) {
    element.append(text.slice(cursor, match.index));
    const strong = document.createElement("strong");
    strong.textContent = match[1]!;
    element.append(strong);
    cursor = match.index! + match[0].length;
  }
  element.append(text.slice(cursor));
}

export function notebookFromText(
  text: string,
  title = "",
  format = true,
): Notebook {
  if (!text.trim()) throw new Error("請先輸入或貼上筆記內容。");
  if (text.length > MAX_TEXT_LENGTH)
    throw new Error("內容超過 200,000 字元，請拆成較短的筆記後再建立。");

  const root = document.createElement("div");
  let paragraph: string[] = [];
  let list: HTMLOListElement | HTMLUListElement | undefined;
  let nextNumber: number | undefined;
  function flushParagraph() {
    if (!paragraph.length) return;
    const p = document.createElement("p");
    appendInline(p, paragraph.join("\n"), format);
    root.append(p);
    paragraph = [];
  }
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) {
      flushParagraph();
      list = undefined;
      continue;
    }
    const heading = format ? line.match(/^ {0,3}(#{1,6})\s+(.+)$/) : null;
    const bullet = format ? line.match(/^ {0,3}[-*+•]\s+(.+)$/) : null;
    const ordered = format
      ? line.match(/^ {0,3}(\d{1,6})[.)、]\s+(.+)$/)
      : null;
    if (heading) {
      flushParagraph();
      list = undefined;
      const h = document.createElement(`h${heading[1]!.length}`);
      appendInline(h, heading[2]!, format);
      root.append(h);
    } else if (bullet || ordered) {
      flushParagraph();
      const type = ordered ? "OL" : "UL";
      const number = ordered ? Number(ordered[1]) : undefined;
      if (
        !list ||
        list.tagName !== type ||
        (ordered && number !== nextNumber)
      ) {
        list = document.createElement(ordered ? "ol" : "ul");
        if (ordered) list.setAttribute("start", String(number));
        root.append(list);
      }
      const li = document.createElement("li");
      appendInline(li, ordered ? ordered[2]! : bullet![1]!, format);
      list.append(li);
      nextNumber = number === undefined ? undefined : number + 1;
    } else {
      list = undefined;
      paragraph.push(line);
    }
  }
  flushParagraph();
  return normalizeHtml(
    root.innerHTML,
    title.trim().slice(0, 120) || "我的文字筆記",
  );
}
