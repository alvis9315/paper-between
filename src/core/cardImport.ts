import { cardDetails, cardPlainText, sanitizeCardHtml } from "./cardContent";
import { MAX_REVIEW_CARDS } from "./reviewCards";
import { prepareImage } from "./media";
import type { ReviewCard } from "./model";

/** Read only the reference format's inert JSON data. Never run imported scripts. */
export async function importCardDeck(file: File): Promise<ReviewCard[]> {
  if (
    !/\.(html?|json)$/i.test(file.name) ||
    !file.size ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("請選擇 10MB 以下、含小卡資料的 HTML 或 JSON 檔。");
  const text = await file.text();
  let data: any;
  try {
    if (/\.json$/i.test(file.name)) data = JSON.parse(text);
    else {
      const doc = new DOMParser().parseFromString(text, "text/html");
      const read = (id: string, required = false) => {
        const element = doc.getElementById(id);
        if (!element && required) throw new Error();
        return element ? JSON.parse(element.textContent || "") : {};
      };
      data = {
        cards: read("cards-data", true),
        sources: read("sources-data"),
        images: read("images-data"),
      };
    }
  } catch {
    throw new Error(
      "這份檔案沒有可讀取的小卡資料。請使用含 cards-data 的小卡 HTML，或 cards／sources／images 格式的 JSON；一般網頁請改從筆記建立。",
    );
  }
  if (
    !data ||
    !Array.isArray(data.cards) ||
    !data.cards.length ||
    data.cards.length > MAX_REVIEW_CARDS
  )
    throw new Error("小卡資料為空或超過 2000 張，尚未加入任何內容。");
  const sources = data.sources || {},
    images = data.images || {};
  if (
    typeof sources !== "object" ||
    Array.isArray(sources) ||
    Object.keys(sources).length > 30 ||
    typeof images !== "object" ||
    Array.isArray(images) ||
    Object.keys(images).length > 50
  )
    throw new Error("小卡來源或圖片格式不正確。");
  for (const pages of Object.values(sources)) {
    if (
      !Array.isArray(pages) ||
      pages.length > 200 ||
      pages.some((p) => typeof p !== "string" || p.length > 30000)
    )
      throw new Error("小卡原文頁面格式不正確。");
  }
  const hash = [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const ids = new Set<string>();
  const requestedImages = new Set<string>();
  const cards: ReviewCard[] = data.cards.map((v: any, i: number) => {
    if (
      !v ||
      typeof v.id !== "string" ||
      !v.id ||
      v.id.length > 160 ||
      ids.has(v.id) ||
      typeof v.title !== "string" ||
      !v.title.trim() ||
      v.title.length > 160 ||
      !Array.isArray(v.tags) ||
      v.tags.length > 8 ||
      v.tags.some((t: unknown) => typeof t !== "string" || t.length > 60) ||
      typeof v.answerHtml !== "string"
    )
      throw new Error("小卡標題、標籤或答案不完整，尚未加入任何內容。");
    ids.add(v.id);
    const html = sanitizeCardHtml(v.answerHtml),
      body = cardPlainText(html);
    if (!body || body.length > 6000)
      throw new Error("小卡答案為空或超過 6000 字，請先拆成較小的卡片。");
    const source = typeof v.source === "string" ? v.source : "匯入小卡";
    const label =
      ({ review: "總複習", exam: "考題" } as Record<string, string>)[source] ||
      source;
    if (label.length > 120) throw new Error("小卡來源名稱過長。");
    if (
      v.pages !== undefined &&
      (!Array.isArray(v.pages) ||
        v.pages.length > 20 ||
        v.pages.some(
          (p: unknown) =>
            !Number.isInteger(p) || Number(p) < 1 || Number(p) > 200,
        ))
    )
      throw new Error("小卡頁碼格式不正確。");
    const sourcePages = (v.pages || []).map((page: number) => {
      const original = Object.hasOwn(sources, source)
        ? sources[source]?.[page - 1]
        : undefined;
      return {
        page,
        text:
          typeof original === "string"
            ? original
            : "此頁未附原文，請查看原始文件。",
      };
    });
    if (v.imageKey !== undefined) {
      if (typeof v.imageKey !== "string" || !Object.hasOwn(images, v.imageKey))
        throw new Error("小卡題圖遺失，尚未加入任何內容。");
      requestedImages.add(v.imageKey);
    }
    return {
      id: crypto.randomUUID(),
      title: v.title.trim(),
      body,
      tags: [...new Set<string>(v.tags)],
      sourceTitle: label,
      sourceKey: `html:${hash}:${i}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...cardDetails({ ...v, answerHtml: html, sourcePages }),
    };
  });
  const assets = new Map<string, ReviewCard["image"]>();
  for (const key of requestedImages) {
    const value = images[key];
    if (
      typeof value !== "string" ||
      value.length > 14_000_000 ||
      !/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=\r\n]+$/i.test(value)
    )
      throw new Error(
        "小卡題圖必須是內嵌 PNG、JPEG 或 WebP，尚未加入任何內容。",
      );
    const [head, payload] = value.split(",");
    const bytes = Uint8Array.from(atob(payload!), (c) => c.charCodeAt(0));
    const mime = head!.slice(5, head!.indexOf(";"));
    const asset = await prepareImage(
      new File([bytes], "小卡題圖", { type: mime }),
    );
    assets.set(key, {
      mediaId: asset.id,
      width: asset.width,
      height: asset.height,
      alt: "原題圖",
      layout: "stacked",
    });
  }
  return cards.map((card, i) => ({
    ...card,
    ...(data.cards[i].imageKey
      ? { image: assets.get(data.cards[i].imageKey) }
      : {}),
  }));
}
