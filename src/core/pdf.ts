import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { getMedia, stageAsset } from "./media";
import type { Notebook } from "./model";
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const cache = new Map<
  string,
  {
    promise: Promise<pdfjs.PDFDocumentProxy>;
    users: number;
    task?: ReturnType<typeof loading>;
  }
>();
const base = import.meta.env.BASE_URL + "pdfjs/";
export function loading(data: Uint8Array) {
  return pdfjs.getDocument({
    data,
    cMapUrl: base + "cmaps/",
    cMapPacked: true,
    standardFontDataUrl: base + "standard_fonts/",
    wasmUrl: base + "wasm/",
    enableXfa: false,
    useSystemFonts: true,
    canvasMaxAreaInBytes: 32 * 1024 * 1024,
    verbosity: 0,
  });
}
/** Reference-count shared workers; only visible/turning pages acquire a document. */
export async function acquirePdf(id: string) {
  let entry = cache.get(id);
  if (!entry) {
    entry = {
      promise: Promise.resolve(undefined as unknown as pdfjs.PDFDocumentProxy),
      users: 0,
    };
    const current = entry;
    current.promise = getMedia(id).then(async (a) => {
      current.task = loading(new Uint8Array(await a.blob.arrayBuffer()));
      return current.task.promise;
    });
    cache.set(id, entry);
  }
  entry.users++;
  try {
    const document = await entry.promise;
    let released = false;
    return {
      document,
      release() {
        if (released) return;
        released = true;
        entry!.users--;
        trimCache();
      },
    };
  } catch (e) {
    entry.users--;
    cache.delete(id);
    throw e;
  }
}
function trimCache() {
  for (const [id, entry] of cache) {
    if (cache.size <= 2) break;
    if (entry.users === 0) {
      cache.delete(id);
      void entry.task?.destroy();
    }
  }
}
export async function importPdf(
  file: File,
  progress: (message: string) => void = () => {},
): Promise<Notebook> {
  if (!/\.pdf$/i.test(file.name)) throw new Error("請選擇 .pdf 文件。");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("PDF 超過 10MB，請壓縮或拆成較小的文件。");
  if (
    !new TextDecoder()
      .decode(await file.slice(0, 1024).arrayBuffer())
      .includes("%PDF-")
  )
    throw new Error("這不是有效的 PDF 文件。");
  const task = loading(new Uint8Array(await file.arrayBuffer()));
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    void task.destroy();
  }, 90000);
  try {
    const source = await task.promise;
    if (source.numPages > 200)
      throw new Error("第一版每份 PDF 最多 200 頁，請先拆分文件。");
    const id = crypto.randomUUID();
    const blocks: Notebook["blocks"] = [];
    let empty = 0,
      total = 0;
    for (let n = 1; n <= source.numPages; n++) {
      progress(`正在讀取 PDF 第 ${n}／${source.numPages} 頁…`);
      const page = await source.getPage(n),
        viewport = page.getViewport({ scale: 1 });
      if (
        viewport.width > 20000 ||
        viewport.height > 20000 ||
        viewport.width < 1 ||
        viewport.height < 1
      )
        throw new Error("PDF 紙張尺寸過大或不正確，請另存為一般尺寸後再試。");
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join("");
      total += text.length;
      if (total > 4_000_000)
        throw new Error("PDF 文字量過大，請拆成較小的文件。");
      if (!text.trim()) empty++;
      const p = document.createElement("p");
      p.textContent = text || "（此頁無可搜尋文字）";
      blocks.push({
        id: `${id}-${n}`,
        kind: "pdfPage",
        text,
        html: p.outerHTML,
        pdf: {
          assetId: "",
          page: n,
          width: viewport.width,
          height: viewport.height,
        },
      });
      page.cleanup();
      await new Promise((r) => setTimeout(r, 0));
    }
    // Stage only after all pages have parsed successfully; original book remains until layout commits.
    const asset = await stageAsset(
      new Blob([await file.arrayBuffer()], { type: "application/pdf" }),
      file.name,
      "pdf",
    );
    blocks.forEach((b) => (b.pdf!.assetId = asset.id));
    return {
      id,
      title: file.name.replace(/\.pdf$/i, ""),
      blocks,
      pdfAssetId: asset.id,
      warnings: [
        "PDF 採原貌閱讀，圖片與版面保留；可選取文字、搜尋及畫重點。文字修改請另建圖文筆記。",
        ...(empty
          ? [
              `${empty} 頁沒有可讀取的文字層，可能是掃描頁；圖片仍保留，但這些頁面無法搜尋或選字。第一版尚未提供 OCR。`,
            ]
          : []),
        "PDF 的連結、表單、影片與原有互動註解不啟用；此處保留可見頁面，紙間重點另外保存。",
      ],
    };
  } catch (e) {
    const error = e as Error;
    if (error.name === "PasswordException")
      throw new Error(
        "這份 PDF 需要密碼，請另存為未加密 PDF 再匯入，原筆記已保留。",
      );
    if (/頁|文字量|尺寸/.test(error.message)) throw e;
    throw new Error(
      "無法讀取這份 PDF，可能已損壞、格式不正確或解析逾時。原筆記已保留。",
    );
  } finally {
    clearTimeout(timer);
    timer = undefined;
    await task.destroy();
  }
}
export { pdfjs };
