import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { Notebook } from "./model";
import { acquirePdf, pdfjs } from "./pdf";
import { prepareImage, validateBookMedia } from "./media";
import { normalizeHtml } from "./normalize";
export type ReflowMode = "top" | "left" | "text";
export interface RegionText {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ReflowPage {
  page: number;
  title: string;
  body: string;
  image?: Blob;
}
export const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function renderReflowPage(
  assetId: string,
  pageNumber: number,
  canvas: HTMLCanvasElement,
) {
  const lease = await acquirePdf(assetId);
  try {
    const page = await lease.document.getPage(pageNumber);
    const original = page.getViewport({ scale: 1 });
    const scale = Math.min(
      2,
      1800 / Math.max(original.width, original.height),
      Math.sqrt(3_000_000 / (original.width * original.height)),
    );
    const viewport = page.getViewport({ scale });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const content = await page.getTextContent();
    const items = content.items
      .filter((i): i is TextItem => "str" in i && !!i.str.trim())
      .map((item) => {
        const matrix = pdfjs.Util.transform(viewport.transform, item.transform);
        const height = Math.hypot(matrix[2]!, matrix[3]!);
        return {
          text: item.str,
          x: matrix[4]! / viewport.width,
          y: (matrix[5]! - height) / viewport.height,
          width: Math.abs(item.width * scale) / viewport.width,
          height: height / viewport.height,
        };
      });
    return items;
  } finally {
    lease.release();
  }
}
export function textFromRegion(
  items: RegionText[],
  mode: ReflowMode,
  fraction: number,
  columns: "auto" | "one" | "two",
) {
  const body = items.filter(
    (item) =>
      mode === "text" ||
      (mode === "top"
        ? item.y + item.height / 2 >= fraction
        : item.x + item.width / 2 >= fraction),
  );
  if (!body.length) return "";
  const left = mode === "left" ? fraction : 0,
    midpoint = (left + 1) / 2;
  const crossing = body.filter(
    (i) => i.x < midpoint - 0.015 && i.x + i.width > midpoint + 0.015,
  ).length;
  const hasColumns =
    body.filter((i) => i.x + i.width / 2 < midpoint).length >= 3 &&
    body.filter((i) => i.x + i.width / 2 >= midpoint).length >= 3;
  const split =
    columns === "two" || (columns === "auto" && hasColumns && crossing === 0);
  const groups = split
    ? [
        body.filter((i) => i.x + i.width / 2 < midpoint),
        body.filter((i) => i.x + i.width / 2 >= midpoint),
      ]
    : [body];
  return groups
    .map((group) => {
      const lines: { y: number; height: number; items: RegionText[] }[] = [];
      for (const item of group.toSorted((a, b) => a.y - b.y || a.x - b.x)) {
        const last = lines.at(-1);
        if (
          last &&
          Math.abs(item.y - last.y) < Math.max(last.height, item.height) * 0.45
        ) {
          last.items.push(item);
          last.height = Math.max(last.height, item.height);
        } else lines.push({ y: item.y, height: item.height, items: [item] });
      }
      const join = (a: string, b: string) =>
        a +
        (/[\u3400-\u9fff]$/.test(a) && /^[\u3400-\u9fff，。、；：]/.test(b)
          ? ""
          : " ") +
        b;
      let text = "";
      lines.forEach((line, n) => {
        const value = line.items
          .sort((a, b) => a.x - b.x)
          .map((i) => i.text.trim())
          .reduce(join);
        const prev = lines[n - 1];
        const newParagraph =
          !prev ||
          line.y - prev.y > Math.max(line.height, prev.height) * 1.85 ||
          /^[•●○\d]+[.、\s]/.test(value) ||
          line.height > prev.height * 1.25;
        text = !text
          ? value
          : newParagraph
            ? text + "\n\n" + value
            : join(text, value);
      });
      return text;
    })
    .filter(Boolean)
    .join("\n\n");
}
export function suggestReflowHeading(
  items: RegionText[],
  mode: ReflowMode,
  fraction: number,
): string | undefined {
  const body = items.filter(
    (item) =>
      mode === "text" ||
      (mode === "top"
        ? item.y + item.height / 2 >= fraction
        : item.x + item.width / 2 >= fraction),
  );
  const sizes = body.map((item) => item.height).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)] || 0;
  const first = body.toSorted((a, b) => a.y - b.y || a.x - b.x).slice(0, 8);
  const candidate = first.find(
    (item) =>
      item.height >= median * 1.25 &&
      item.text.trim().length >= 2 &&
      item.text.trim().length <= 80,
  );
  return candidate?.text.trim();
}
export function suggestReflowMode(items: RegionText[]): ReflowMode {
  const median = (values: number[]) =>
    values.sort((a, b) => a - b)[Math.floor(values.length / 2)] || 0;
  const left = items.filter((i) => i.x < 0.5),
    right = items.filter((i) => i.x >= 0.5);
  if (
    left.length >= 10 &&
    right.length >= 10 &&
    median(left.map((i) => i.height)) > median(right.map((i) => i.height)) * 1.2
  )
    return "left";
  const top = items.filter((i) => i.y < 0.6),
    bottom = items.filter((i) => i.y >= 0.6);
  if (
    top.length >= 10 &&
    bottom.length >= 5 &&
    median(top.map((i) => i.height)) > median(bottom.map((i) => i.height)) * 1.2
  )
    return "top";
  return "text";
}
export async function cropReflowFigure(
  canvas: HTMLCanvasElement,
  mode: ReflowMode,
  fraction: number,
): Promise<Blob | undefined> {
  if (mode === "text") return;
  const output = document.createElement("canvas");
  output.width = Math.max(
    1,
    Math.floor(canvas.width * (mode === "left" ? fraction : 1)),
  );
  output.height = Math.max(
    1,
    Math.floor(canvas.height * (mode === "top" ? fraction : 1)),
  );
  const ctx = output.getContext("2d");
  if (!ctx) throw new Error("這個瀏覽器暫時無法建立圖解，請重試。");
  ctx.drawImage(canvas, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    output.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("圖解無法保存。"))),
      "image/png",
    ),
  );
  output.width = output.height = 0;
  return blob;
}
export async function notebookFromReflow(
  pages: ReflowPage[],
  title: string,
): Promise<Notebook> {
  if (!pages.length || pages.length > 50)
    throw new Error("一次請處理 1–50 頁。");
  const html: string[] = [];
  for (const page of pages) {
    html.push(`<h2>${escapeHtml(page.title || `原檔第 ${page.page} 頁`)}</h2>`);
    if (page.image) {
      const asset = await prepareImage(
        new File([page.image], `第 ${page.page} 頁圖解.png`, {
          type: "image/png",
        }),
      );
      html.push(
        `<figure data-media-id="${asset.id}" data-width="${asset.width}" data-height="${asset.height}" data-layout="stacked" data-alt="${escapeHtml(page.title)}"><div data-figure-body="true"><p></p></div></figure>`,
      );
    }
    html.push(
      ...page.body
        .split(/\n\s*\n/)
        .filter((x) => x.trim())
        .map((p) => `<p>${escapeHtml(p.trim())}</p>`),
    );
  }
  const doc = normalizeHtml(html.join(""), title.trim() || "重排筆記", [
    "這本由 PDF 區塊重排建立，原始 PDF 保留在書架。請確認文字、閱讀順序與主題。",
  ]);
  await validateBookMedia(doc);
  return doc;
}
