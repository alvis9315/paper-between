import type { Notebook, PaperPage, SearchHit } from "./model";
import { pageForAnchor } from "./navigation";
export function searchDocument(
  doc: Notebook,
  query: string,
  pages: PaperPage[],
): SearchHit[] {
  if (!query.trim()) return [];
  const hits: SearchHit[] = [];
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const block of doc.blocks) {
    const regex = new RegExp(escaped, "giu");
    for (const match of block.text.matchAll(regex)) {
      const offset = match.index!;
      hits.push({
        blockId: block.id,
        offset,
        end: offset + match[0].length,
        excerpt: `${offset > 22 ? "…" : ""}${block.text.slice(Math.max(0, offset - 22), Math.min(block.text.length, offset + match[0].length + 42))}${offset + match[0].length + 42 < block.text.length ? "…" : ""}`,
        page: pageForAnchor(pages, { blockId: block.id, offset }),
      });
    }
  }
  return hits;
}
export function highlightPage(
  html: string,
  hits: SearchHit[],
  active?: SearchHit,
): string {
  if (!hits.length) return html;
  const root = document.createElement("div");
  root.innerHTML = html;
  root.querySelectorAll<HTMLElement>(".fragment").forEach((fragment) => {
    const matching = hits.filter((h) => h.blockId === fragment.dataset.block);
    if (!matching.length) return;
    let cursor = Number(fragment.dataset.start);
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode())
      if (!walker.currentNode.parentElement?.closest("[data-repeat]"))
        nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      const value = node.data;
      const base = cursor;
      cursor += value.length;
      const overlap = matching.filter((h) => h.offset < cursor && h.end > base);
      if (!overlap.length) continue;
      const replacement = document.createDocumentFragment();
      let pos = 0;
      for (const hit of overlap) {
        const start = Math.max(0, hit.offset - base);
        const end = Math.min(value.length, hit.end - base);
        if (start > pos) replacement.append(value.slice(pos, start));
        const mark = document.createElement("mark");
        if (active?.blockId === hit.blockId && active.offset === hit.offset)
          mark.className = "active-hit";
        mark.textContent = value.slice(start, end);
        replacement.append(mark);
        pos = end;
      }
      replacement.append(value.slice(pos));
      node.replaceWith(replacement);
    }
  });
  return root.innerHTML;
}
