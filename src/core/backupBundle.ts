import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { exportBackup, importBackup } from "./backup";
import {
  getMedia,
  mediaIds,
  pendingMedia,
  stageAsset,
  validateBookMedia,
} from "./media";
import type { BookRecord, MediaAsset } from "./model";
export async function createBundle(books: BookRecord[]): Promise<Blob> {
  const metadata = JSON.parse(exportBackup(books));
  const files: Record<string, Uint8Array> = {};
  const assets = [];
  let total = 0;
  for (const id of new Set(books.flatMap((b) => mediaIds(b.document)))) {
    const asset = await getMedia(id);
    total += asset.bytes;
    if (total > 100 * 1024 * 1024)
      throw new Error("完整備份超過 100MB，請先分批整理大型文件。");
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
  await new Promise((r) => setTimeout(r, 0));
  const zipped = zipSync(files, { level: 0 });
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
  for (const asset of manifest.assets) {
    if (
      !/^m-[a-f0-9]{64}$/.test(asset.id) ||
      asset.path !== `assets/${asset.id}` ||
      !files[asset.path]
    )
      throw new Error("備份圖片遺失或參照不正確。");
    const bytes = files[asset.path]!;
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
    const width = image.width,
      height = image.height;
    image.close();
    if (width > 2000 || height > 2000 || width < 1 || height < 1)
      throw new Error("備份中的圖片尺寸超過限制。");
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
      kind: "image",
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
      b.document.blocks.filter((x) => x.image).length > 50 ||
      ids.reduce((n, id) => n + available.get(id)!.bytes, 0) > 50 * 1024 * 1024
    )
      throw new Error("備份中的單本圖片超過限制。");
  }
  for (const asset of staged) pendingMedia.set(asset.id, asset);
  return books;
}
