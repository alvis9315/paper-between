import { zip, unzipSync, strToU8, strFromU8 } from "fflate";
import { exportBackup, importBackup } from "./backup";
import {
  getMedia,
  mediaIds,
  pendingMedia,
  stageAsset,
  validateBookMedia,
} from "./media";
import type { BookRecord, MediaAsset } from "./model";
import { validateAnnotations } from "./annotations";
export async function createBundle(books: BookRecord[]): Promise<Blob> {
  const characters = books.reduce(
    (n, b) => n + b.document.blocks.reduce((m, x) => m + x.html.length, 0),
    0,
  );
  if (characters > 16_000_000)
    throw new Error("整份書架文字量過大，請使用書卡上的「備份此本」分批保存。");
  const metadata = JSON.parse(exportBackup(books));
  const files: Record<string, Uint8Array> = {};
  const assets = [];
  let total = 0;
  for (const id of new Set(books.flatMap((b) => mediaIds(b.document)))) {
    const asset = await getMedia(id);
    total += asset.bytes;
    if (total > 100 * 1024 * 1024)
      throw new Error(
        "完整備份超過 100MB，請使用書卡上的「備份此本」分批保存。",
      );
    const path = `assets/${id}`;
    files[path] = new Uint8Array(await asset.blob.arrayBuffer());
    const { blob, ...entry } = asset;
    assets.push({ ...entry, path });
  }
  const records = metadata.books.map((b: any, i: number) => ({
    ...b,
    annotations: books[i]!.document.annotations || [],
    pdfAssetId: books[i]!.document.pdfAssetId,
    pdfBlocks: books[i]!.document.pdfAssetId
      ? books[i]!.document.blocks
      : undefined,
  }));
  files["manifest.json"] = strToU8(
    JSON.stringify({
      format: "paper-between-bundle",
      version: 2,
      books: records,
      assets,
      settings: { theme: "earth", imageMaxEdge: 2000 },
    }),
  );
  if (files["manifest.json"]!.length > 50 * 1024 * 1024)
    throw new Error("筆記與重點資訊超過 50MB，請使用「備份此本」分批保存。");
  await new Promise((r) => setTimeout(r, 0));
  const zipped = await new Promise<Uint8Array>((resolve, reject) =>
    zip(files, { level: 0 }, (error, data) =>
      error ? reject(error) : resolve(data),
    ),
  );
  return new Blob([zipped as Uint8Array<ArrayBuffer>], {
    type: "application/zip",
  });
}
export async function readBundle(file: File): Promise<BookRecord[]> {
  if (file.size > 110 * 1024 * 1024)
    throw new Error("備份超過 110MB，請選擇較小的紙間備份。");
  if (/\.json$/i.test(file.name)) return importBackup(await file.text());
  let total = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (f) => {
        total += f.originalSize;
        if (total > 150 * 1024 * 1024) throw new Error("備份解壓後過大。");
        return (
          f.name === "manifest.json" || /^assets\/m-[a-f0-9]{64}$/.test(f.name)
        );
      },
    });
  } catch {
    throw new Error("無法讀取 ZIP 備份，檔案可能損壞或過大。");
  }
  let manifest: any;
  try {
    manifest = JSON.parse(strFromU8(files["manifest.json"]!));
  } catch {
    throw new Error("備份缺少有效的書架資訊。");
  }
  if (
    manifest.format !== "paper-between-bundle" ||
    manifest.version !== 2 ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.length > 10000
  )
    throw new Error("這不是支援的紙間完整備份。");
  const books = importBackup(
    JSON.stringify({
      format: "paper-between-bookshelf",
      version: 1,
      books: manifest.books,
    }),
  );
  const staged: MediaAsset[] = [];
  books.forEach((book, i) => {
    const record = manifest.books[i];
    if (record?.pdfAssetId) {
      if (
        !/^m-[a-f0-9]{64}$/.test(record.pdfAssetId) ||
        !Array.isArray(record.pdfBlocks) ||
        !record.pdfBlocks.length ||
        record.pdfBlocks.length > 200
      )
        throw new Error("備份 PDF 頁面資訊不完整。");
      const ids = new Set<string>();
      book.document.pdfAssetId = record.pdfAssetId;
      book.document.blocks = record.pdfBlocks.map((b: any, n: number) => {
        if (
          !b ||
          typeof b.id !== "string" ||
          !/^[A-Za-z0-9_-]{1,180}$/.test(b.id) ||
          ids.has(b.id) ||
          typeof b.text !== "string" ||
          b.text.length > 4_000_000 ||
          b.pdf?.assetId !== record.pdfAssetId ||
          b.pdf?.page !== n + 1 ||
          !Number.isFinite(b.pdf.width) ||
          !Number.isFinite(b.pdf.height) ||
          b.pdf.width < 1 ||
          b.pdf.height < 1 ||
          b.pdf.width > 20000 ||
          b.pdf.height > 20000
        )
          throw new Error("備份 PDF 頁面資訊不正確。");
        ids.add(b.id);
        const p = document.createElement("p");
        p.textContent = b.text || "（此頁無可搜尋文字）";
        return {
          id: b.id,
          kind: "pdfPage",
          text: b.text,
          html: p.outerHTML,
          pdf: {
            assetId: record.pdfAssetId,
            page: n + 1,
            width: b.pdf.width,
            height: b.pdf.height,
          },
        };
      });
    }
    book.document.annotations = validateAnnotations(
      manifest.books[i]?.annotations,
      book.document,
    );
  });
  for (const asset of manifest.assets) {
    if (
      !/^m-[a-f0-9]{64}$/.test(asset.id) ||
      asset.path !== `assets/${asset.id}` ||
      !files[asset.path]
    )
      throw new Error("備份圖片遺失或參照不正確。");
    const bytes = files[asset.path]!;
    let width = 0,
      height = 0;
    if (asset.kind === "pdf") {
      if (
        asset.mime !== "application/pdf" ||
        bytes.length > 10 * 1024 * 1024 ||
        !strFromU8(bytes.slice(0, 1024)).includes("%PDF-")
      )
        throw new Error("備份 PDF 損壞或超過 10MB。");
      const { loading } = await import("./pdf");
      const task = loading(bytes.slice());
      try {
        const pdf = await task.promise;
        const matching = books.filter(
          (b) => b.document.pdfAssetId === asset.id,
        );
        if (
          pdf.numPages > 200 ||
          matching.some((b) => b.document.blocks.length !== pdf.numPages)
        )
          throw new Error();
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n),
            content = await page.getTextContent();
          const text = content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join("");
          if (matching.some((b) => b.document.blocks[n - 1]?.text !== text))
            throw new Error();
          page.cleanup();
        }
      } catch {
        throw new Error(
          "備份 PDF 無法讀取，或文字與原檔不一致。原書架已保留。",
        );
      } finally {
        await task.destroy();
      }
    } else {
      if (
        asset.kind !== "image" ||
        !["image/png", "image/jpeg", "image/webp"].includes(asset.mime) ||
        bytes.length > 2 * 1024 * 1024
      )
        throw new Error("備份含不支援或過大的圖片。");
      let image: ImageBitmap;
      try {
        image = await createImageBitmap(
          new Blob([bytes as Uint8Array<ArrayBuffer>], { type: asset.mime }),
        );
      } catch {
        throw new Error("備份中的圖片已損壞。");
      }
      width = image.width;
      height = image.height;
      image.close();
      if (width > 2000 || height > 2000 || width < 1 || height < 1)
        throw new Error("備份中的圖片尺寸超過限制。");
    }
    const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], {
      type: asset.mime,
    });
    const hash = await crypto.subtle.digest(
      "SHA-256",
      await blob.arrayBuffer(),
    );
    const id =
      "m-" +
      [...new Uint8Array(hash)]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
    if (id !== asset.id) throw new Error("備份圖片完整性檢查失敗。");
    staged.push({
      id,
      blob,
      name: typeof asset.name === "string" ? asset.name : "備份圖片",
      kind: asset.kind,
      width,
      height,
      bytes: blob.size,
      mime: asset.mime,
    });
  }
  const available = new Map(staged.map((a) => [a.id, a]));
  for (const b of books) {
    const ids = mediaIds(b.document);
    if (ids.some((id) => !available.has(id)))
      throw new Error("備份缺少筆記使用的圖片，原書架已保留。");
    if (
      b.document.blocks.some(
        (block) =>
          (block.image &&
            available.get(block.image.mediaId)?.kind !== "image") ||
          (block.pdf && available.get(block.pdf.assetId)?.kind !== "pdf"),
      )
    )
      throw new Error("備份中的媒體類型不正確。");
    if (
      b.document.blocks.filter((x) => x.image).length > 50 ||
      ids.reduce((n, id) => n + available.get(id)!.bytes, 0) > 50 * 1024 * 1024
    )
      throw new Error("備份中的單本圖片超過限制。");
  }
  for (const asset of staged) pendingMedia.set(asset.id, asset);
  return books;
}
