import { normalizeHtml } from "./normalize";
import type { Notebook } from "./model";
import { prepareImage, validateBookMedia } from "./media";
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export async function importDocx(file: File): Promise<Notebook> {
  if (!/\.docx$/i.test(file.name))
    throw new Error("目前只支援 .docx 格式，請在 Word 另存為 .docx 文件。");
  if (file.size > MAX_FILE_SIZE)
    throw new Error("檔案超過 10MB，請縮小或拆分文件後再匯入。");
  if (!file.size)
    throw new Error("這個檔案是空的，請選擇有內容的 .docx 文件。");
  const buffer = await file.arrayBuffer();
  const parsed = await new Promise<{
    html: string;
    warnings: string[];
    images: { id: string; buffer: ArrayBuffer; mime: string }[];
  }>((resolve, reject) => {
    const worker = new Worker(new URL("./docx.worker.ts", import.meta.url), {
      type: "module",
    });
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("文件解析超時，請拆成較小的文件再試。"));
    }, 45_000);
    worker.onmessage = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      e.data.error ? reject(new Error(e.data.error)) : resolve(e.data);
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error("文件解析失敗，請確認檔案未損壞或加密。"));
    };
    worker.postMessage(buffer, [buffer]);
  });
  const root = document.createElement("div");
  root.innerHTML = parsed.html;
  for (const image of parsed.images || []) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(image.mime)) {
      root
        .querySelectorAll(`img[src="paper-media:${image.id}"]`)
        .forEach((x) => x.remove());
      parsed.warnings.push(
        "部分圖片格式不支援，已略過；請先在 Word 轉為 PNG 或 JPEG。",
      );
      continue;
    }
    const asset = await prepareImage(
      new File([image.buffer], "Word 圖片", { type: image.mime }),
    );
    for (const img of root.querySelectorAll<HTMLImageElement>(
      `img[src="paper-media:${image.id}"]`,
    )) {
      const figure = document.createElement("figure");
      Object.assign(figure.dataset, {
        mediaId: asset.id,
        width: String(asset.width),
        height: String(asset.height),
        layout: "stacked",
        alt: img.alt || "Word 圖片",
      });
      const copy = document.createElement("div");
      copy.dataset.figureBody = "true";
      const p = document.createElement("p");
      copy.append(p);
      figure.append(copy);
      const paragraph = img.closest("p");
      if (paragraph) {
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        range.setEndBefore(img);
        const before = range.cloneContents();
        range.selectNodeContents(paragraph);
        range.setStartAfter(img);
        const after = range.cloneContents();
        const left = document.createElement("p");
        left.append(before);
        const right = document.createElement("p");
        right.append(after);
        paragraph.replaceWith(left, figure, right);
      } else img.replaceWith(figure);
    }
  }
  const doc = normalizeHtml(
    root.innerHTML,
    file.name.replace(/\.docx$/i, ""),
    parsed.warnings,
  );
  await validateBookMedia(doc);
  return doc;
}
