import type { BookRecord, ReviewCard } from "./model";
import { cardDetails } from "./cardContent";
export const MAX_REVIEW_CARDS = 2000;
export function splitReviewText(text: string, limit = 600): string[] {
  const units = [
    ...new Intl.Segmenter("zh-Hant", { granularity: "sentence" }).segment(text),
  ].map((s) => s.segment);
  const chunks: string[] = [];
  let current = "";
  for (const unit of units) {
    if (current && current.length + unit.length > limit) {
      chunks.push(current.trim());
      current = "";
    }
    if (unit.length > limit) {
      const characters = [...unit];
      while (characters.length > limit)
        chunks.push(characters.splice(0, limit).join("").trim());
      current += characters.join("");
    } else current += unit;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}
function fingerprint(value: string) {
  let hash = 2166136261;
  for (const character of value)
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  return (hash >>> 0).toString(36);
}
export function cardsFromBook(
  book: BookRecord,
  mode: "content" | "highlights" = "content",
): ReviewCard[] {
  const result: ReviewCard[] = [];
  let topic = "",
    heading = book.document.title,
    topicLevel = Infinity;
  function add(
    body: string,
    title: string,
    tags: string[],
    image?: ReviewCard["image"],
    sourcePages?: ReviewCard["sourcePages"],
  ) {
    const chunks = splitReviewText(body || (image ? "圖解複習" : ""));
    chunks.forEach((part, n) =>
      result.push({
        id: crypto.randomUUID(),
        sourceBookId: book.document.id,
        sourceTitle: book.document.title,
        sourceKey: `${book.document.id}:${fingerprint(title + "|" + part + "|" + (image?.mediaId || ""))}`,
        title:
          `${title}${chunks.length > 1 ? ` · ${n + 1}/${chunks.length}` : ""}`.slice(
            0,
            160,
          ),
        body: part,
        tags: [
          ...new Set(tags.map((t) => t.trim().slice(0, 60)).filter(Boolean)),
        ].slice(0, 8),
        image: n === 0 ? image : undefined,
        sourcePages,
        topicOrigin: mode === "highlights" ? "manual" : "auto",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
  }
  if (mode === "highlights") {
    for (const note of book.document.annotations || []) {
      add(
        [...note.targets.map((t) => t.exact), note.comment]
          .filter(Boolean)
          .join("\n\n"),
        note.targets[0]?.exact.slice(0, 40) || "重點摘錄",
        note.tags,
      );
    }
  } else {
    let text = "";
    let image: ReviewCard["image"];
    const flush = () => {
      if (text.trim() || image) add(text, heading, [topic], image);
      text = "";
      image = undefined;
    };
    for (const block of book.document.blocks) {
      if (block.kind === "heading") {
        flush();
        heading = block.text;
        const level = block.level || 2;
        if (level <= 2 || topicLevel > 2) {
          topic = block.text;
          topicLevel = level;
        }
      } else if (block.image) {
        flush();
        image = block.image;
        text = block.text;
      } else if (block.kind === "pdfPage") {
        flush();
        add(
          block.text,
          `${book.document.title} · 原檔第 ${block.pdf?.page || 1} 頁`,
          [],
          undefined,
          [
            {
              page: block.pdf?.page || 1,
              text:
                block.text.length > 29000
                  ? block.text.slice(0, 29000) +
                    "\n（原文較長，其餘內容請回到來源筆記。）"
                  : block.text,
            },
          ],
        );
      } else {
        text += `${text ? "\n\n" : ""}${block.text}`;
        if (text.length >= 600) flush();
      }
    }
    flush();
  }
  return result;
}
/** Validate the entire optional deck before restoring any data. */
export function restoreReviewCards(
  value: unknown,
  ids: Map<string, string>,
): ReviewCard[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_REVIEW_CARDS)
    throw new Error("備份小卡數量或格式不正確。");
  return value.map((card: any) => {
    if (
      !card ||
      typeof card.title !== "string" ||
      !card.title.trim() ||
      card.title.length > 160 ||
      typeof card.body !== "string" ||
      !card.body.trim() ||
      card.body.length > 6000 ||
      !Array.isArray(card.tags) ||
      card.tags.length > 8 ||
      card.tags.some(
        (tag: unknown) => typeof tag !== "string" || tag.length > 60,
      )
    )
      throw new Error("備份含有不完整的小卡，尚未加入任何內容。");
    const sourceBookId = ids.get(card.sourceBookId);
    let image: ReviewCard["image"];
    if (card.image) {
      const v = card.image;
      if (
        typeof v.mediaId !== "string" ||
        !/^m-[a-f0-9]{64}$/.test(v.mediaId) ||
        !Number.isFinite(v.width) ||
        !Number.isFinite(v.height) ||
        v.width < 1 ||
        v.height < 1 ||
        v.width > 20000 ||
        v.height > 20000
      )
        throw new Error("小卡圖片資訊不正確。");
      image = {
        mediaId: v.mediaId,
        width: v.width,
        height: v.height,
        alt: typeof v.alt === "string" ? v.alt.slice(0, 200) : "複習圖解",
        layout: "stacked",
      };
    }
    return {
      ...cardDetails(card),
      id: crypto.randomUUID(),
      deckId: typeof card.deckId === "string" ? card.deckId : undefined,
      title: card.title,
      body: card.body,
      tags: [...new Set<string>(card.tags)],
      sourceBookId,
      sourceTitle:
        typeof card.sourceTitle === "string"
          ? card.sourceTitle.slice(0, 120)
          : "匯入的小卡",
      sourceKey:
        sourceBookId && typeof card.sourceKey === "string"
          ? sourceBookId +
            ":" +
            card.sourceKey.split(":").slice(1).join(":").slice(0, 160)
          : typeof card.sourceKey === "string" &&
              /^html:[a-f0-9]{64}:\d{1,4}$/.test(card.sourceKey)
            ? card.sourceKey
            : undefined,
      image,
      createdAt:
        Number.isFinite(card.createdAt) && card.createdAt > 0
          ? card.createdAt
          : Date.now(),
      updatedAt: Date.now(),
    };
  });
}
