import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { BookRecord, ReviewCard } from "./model";
import { normalizeCardSearch } from "./cardContent";
import { cardsFromBook } from "./reviewCards";

interface Heading {
  text: string;
  page: number;
  offset: number;
  size: number;
}
interface Line extends Heading {
  x: number;
  y: number;
  size: number;
  width: number;
}
const generic =
  /^(?:第?[一二三四五六七八九十百\d]+[部分章节章節頁页]|\d{4}\s*年?.*(?:考|試|试)|(?:目錄|目录|參考答案|参考答案|複習|复习|重點整理|重点整理|考題|考题|答案|解答|說明|说明))$/;
function cleanHeading(value: string, source: string): string {
  const text = value
    .normalize("NFKC")
    .trim()
    .replace(
      /^(?:(?:題組|题组)\s*\d+\s*[|｜:：-]?\s*|第[一二三四五六七八九十百\d]+[章節节]\s*|\d+[、]\s*|\d+\.\s+(?=[^\d.]))/,
      "",
    )
    .replace(/^[•●◆■]\s*/, "")
    .trim();
  if (
    text.length < 2 ||
    text.length > 48 ||
    generic.test(text) ||
    normalizeCardSearch(text) === normalizeCardSearch(source) ||
    /[。；;?？=，,]|\d{4}.*(?:考|試|试)|第[一二三四五六七八九十百\d]+部分/.test(
      text,
    ) ||
    !/[\p{L}]{2}/u.test(text)
  )
    return "";
  return text;
}
/** Read visual heading cues only. No subject-specific dictionary or generated answers. */
export function pdfTopicHeadings(
  items: TextItem[],
  page: number,
  source: string,
): Heading[] {
  const lines: Line[] = [];
  let offset = 0;
  for (const item of items) {
    const start = offset;
    offset += item.str.length;
    if (!item.str.trim()) continue;
    const size = Math.hypot(item.transform[2]!, item.transform[3]!);
    if (size < 1) continue;
    const x = item.transform[4]!,
      y = item.transform[5]!;
    const last = lines.at(-1);
    if (
      last &&
      Math.abs(y - last.y) < Math.min(size, last.size) * 0.3 &&
      Math.abs(size - last.size) < last.size * 0.18 &&
      x >= last.x &&
      x - last.x - last.width < size * 2
    ) {
      const gap = x - last.x - last.width;
      last.text +=
        (gap > size * 0.25 ||
        (/[A-Za-z0-9]$/.test(last.text) && /^[A-Za-z0-9]/.test(item.str))
          ? " "
          : "") + item.str;
      last.width = Math.max(last.width, x + item.width - last.x);
    } else
      lines.push({
        text: item.str,
        page,
        offset: start,
        x,
        y,
        size,
        width: item.width,
      });
  }
  const sizes = new Map<number, number>();
  for (const line of lines) {
    const size = Math.round(line.size * 2) / 2;
    sizes.set(size, (sizes.get(size) || 0) + line.text.length);
  }
  // A prose paragraph is a better body-size anchor than labels in a large diagram.
  const prose = lines.filter(
    (l) => l.text.length >= 28 && /[，。；,.]/.test(l.text),
  );
  const body = prose.length
    ? prose.map((l) => l.size).sort((a, b) => a - b)[
        Math.floor(prose.length / 2)
      ]!
    : [...sizes].sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
  return lines
    .flatMap((line, index) => {
      if (line.size < body * 1.15) return [];
      const text = cleanHeading(line.text, source);
      if (!text || /^[\d\s\p{P}\p{S}]+$/u.test(text)) return [];
      // Require smaller running text below/after the heading, in its own column.
      const follows = lines
        .slice(index + 1, index + 18)
        .some(
          (next) =>
            next.text.length >= 20 &&
            next.size < line.size / 1.12 &&
            Math.abs(next.x - line.x) < Math.max(32, line.size * 3) &&
            next.y <= line.y + line.size &&
            line.y - next.y < line.size * 9,
        );
      return follows
        ? [{ text, page, offset: line.offset, size: line.size }]
        : [];
    })
    .slice(0, 16);
}
function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = normalizeCardSearch(v);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function keywordFallback(body: string): string[] {
  const counts = new Map<string, number>();
  for (const match of body.matchAll(
    /\b[A-Z][A-Z0-9]*(?:[/-][A-Z0-9]+)+\b|\b[A-Z]{3,}(?:\d+)?\b/g,
  )) {
    const term = match[0];
    if (/^(?:PDF|DOCX?|HTML|HTTP|HTTPS|WWW|PAGE|NOTE|CHAPTER)$/.test(term))
      continue;
    counts.set(term, (counts.get(term) || 0) + 1);
  }
  return [...counts]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
}
export function canRetag(
  card: ReviewCard,
  book: BookRecord,
  legacyOnly = false,
): boolean {
  if (
    card.sourceBookId !== book.document.id ||
    card.topicOrigin === "manual" ||
    !card.sourceKey?.startsWith(book.document.id + ":")
  )
    return false;
  if (card.topicOrigin === "auto") return !legacyOnly;
  return (
    !card.section &&
    (card.tags.length === 0 ||
      (card.tags.length === 1 && card.tags[0] === card.sourceTitle))
  );
}
/** IDs, source keys, titles, answers and favorites are never changed by classification. */
export async function classifyBookCards(
  book: BookRecord,
  cards: ReviewCard[],
): Promise<ReviewCard[]> {
  if (!book.document.pdfAssetId) {
    const rebuilt = new Map(
      cardsFromBook(book).map((c) => [c.sourceKey, c.tags]),
    );
    return cards.map((card) => ({
      ...card,
      tags:
        rebuilt.get(card.sourceKey) ||
        card.tags.filter((tag) => tag !== book.document.title),
      topicOrigin: "auto",
    }));
  }
  const { acquirePdf } = await import("./pdf");
  const lease = await acquirePdf(book.document.pdfAssetId);
  const headings: Heading[] = [];
  const pageText = new Map<number, string>();
  try {
    for (const block of book.document.blocks) {
      if (!block.pdf) continue;
      const page = await lease.document.getPage(block.pdf.page);
      const content = await page.getTextContent();
      const items = content.items.filter(
        (item): item is TextItem => "str" in item,
      );
      pageText.set(block.pdf.page, items.map((i) => i.str).join(""));
      headings.push(
        ...pdfTopicHeadings(items, block.pdf.page, book.document.title),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    lease.release();
  }
  // Repeated heading typography across pages filters out enlarged diagram labels.
  const styles = new Map<number, Set<number>>();
  for (const h of headings) {
    const size = Math.round(h.size * 2) / 2;
    if (!styles.has(size)) styles.set(size, new Set());
    styles.get(size)!.add(h.page);
  }
  const required = Math.min(3, pageText.size);
  const reliable = headings.filter(
    (h) => (styles.get(Math.round(h.size * 2) / 2)?.size || 0) >= required,
  );
  const names = unique(reliable.map((h) => h.text));
  return cards.map((card) => {
    const body = normalizeCardSearch(card.body);
    const matches = names
      .map((text) => ({
        text,
        score: body.includes(normalizeCardSearch(text))
          ? normalizeCardSearch(text).length
          : 0,
      }))
      .filter((v) => v.score > 0)
      .sort((a, b) => b.score - a.score);
    const page = card.sourcePages?.[0]?.page;
    const raw = page ? pageText.get(page) || "" : "";
    const start = raw.indexOf(card.body.trim());
    const onPage = reliable.filter((h) => h.page === page);
    const preceding =
      start >= 0 ? onPage.filter((h) => h.offset <= start).at(-1) : undefined;
    // Carry a chapter onto its immediately following page only; avoid leaking a stale
    // chapter into later unrelated sections when the PDF has no reliable heading.
    const inherited = page
      ? reliable.filter((h) => h.page === page - 1).at(-1)
      : undefined;
    const tags = unique([
      ...(preceding ? [preceding.text] : []),
      ...matches.slice(0, 3).map((m) => m.text),
      ...(inherited && !preceding && !matches.length ? [inherited.text] : []),
    ]);
    return {
      ...card,
      tags: tags.length ? tags.slice(0, 4) : keywordFallback(card.body),
      topicOrigin: "auto",
    };
  });
}
