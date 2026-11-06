import { database } from "./database";
import type { MediaAsset, Notebook } from "./model";
export const IMAGE_INPUT_LIMIT = 10 * 1024 * 1024;
export const IMAGE_STORED_LIMIT = 2 * 1024 * 1024;
export const BOOK_MEDIA_LIMIT = 50 * 1024 * 1024;
export const pendingMedia = new Map<string, MediaAsset>();
const urls = new Map<string, string>();
const reads = new Map<string, Promise<MediaAsset>>();
export function mediaIds(doc: Notebook): string[] {
  return [
    ...new Set(
      doc.blocks.flatMap((b) =>
        b.image ? [b.image.mediaId] : b.pdf ? [b.pdf.assetId] : [],
      ),
    ),
  ];
}
export async function getMedia(id: string): Promise<MediaAsset> {
  if (pendingMedia.has(id)) return pendingMedia.get(id)!;
  if (reads.has(id)) return reads.get(id)!;
  const job = (async () => {
    const db = await database();
    try {
      return await new Promise<MediaAsset>((resolve, reject) => {
        const r = db
          .transaction("notebook")
          .objectStore("notebook")
          .get(`media:${id}`);
        r.onsuccess = () => {
          const value = r.result;
          if (!value) {
            reject(new Error("圖片或原始文件遺失，請重新匯入備份。"));
            return;
          }
          // Older versions stored Blob directly. New records use stable bytes for Safari.
          if (value.blob instanceof Blob) {
            resolve(value);
            return;
          }
          if (value.data instanceof ArrayBuffer) {
            const { data, ...metadata } = value;
            resolve({
              ...metadata,
              blob: new Blob([data], { type: metadata.mime }),
            });
          } else reject(new Error("圖片或原始文件資料不完整，請從備份還原。"));
        };
        r.onerror = () => reject(r.error);
      });
    } finally {
      db.close();
    }
  })();
  reads.set(id, job);
  try {
    return await job;
  } finally {
    reads.delete(id);
  }
}
export async function mediaUrl(id: string): Promise<string> {
  if (urls.has(id)) {
    const u = urls.get(id)!;
    urls.delete(id);
    urls.set(id, u);
    return u;
  }
  const asset = await getMedia(id);
  const url = URL.createObjectURL(asset.blob);
  urls.set(id, url);
  while (urls.size > 80) {
    const [key, value] = urls.entries().next().value!;
    URL.revokeObjectURL(value);
    urls.delete(key);
  }
  return url;
}
export async function stageAsset(
  blob: Blob,
  name: string,
  kind: "image" | "pdf",
  width = 0,
  height = 0,
): Promise<MediaAsset> {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const id =
    "m-" +
    [...new Uint8Array(hash)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  const asset = {
    id,
    blob,
    name,
    kind,
    width,
    height,
    bytes: blob.size,
    mime: blob.type,
  };
  pendingMedia.set(id, asset);
  return asset;
}
async function declaredPixels(file: File): Promise<number | undefined> {
  const data = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  const v = new DataView(data.buffer);
  if (data.length >= 24 && data[0] === 137 && data[1] === 80)
    return v.getUint32(16) * v.getUint32(20);
  if (data[0] === 255 && data[1] === 216) {
    let p = 2;
    while (p + 9 < data.length) {
      if (data[p] !== 255) break;
      const type = data[p + 1]!;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(type)
      )
        return v.getUint16(p + 5) * v.getUint16(p + 7);
      const n = v.getUint16(p + 2);
      if (n < 2) break;
      p += 2 + n;
    }
  }
  if (
    data.length >= 30 &&
    String.fromCharCode(...data.slice(0, 4)) === "RIFF"
  ) {
    const type = String.fromCharCode(...data.slice(12, 16));
    if (type === "VP8X")
      return (
        (1 + data[24]! + (data[25]! << 8) + (data[26]! << 16)) *
        (1 + data[27]! + (data[28]! << 8) + (data[29]! << 16))
      );
    if (type === "VP8 ")
      return (
        (v.getUint16(26, true) & 0x3fff) * (v.getUint16(28, true) & 0x3fff)
      );
    if (type === "VP8L") {
      const n = v.getUint32(21, true);
      return ((n & 0x3fff) + 1) * (((n >>> 14) & 0x3fff) + 1);
    }
  }
}
export async function prepareImage(file: File): Promise<MediaAsset> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("圖片僅支援 PNG、JPEG、WebP；請先轉換其他格式。");
  if (!file.size || file.size > IMAGE_INPUT_LIMIT)
    throw new Error("每張原始圖片上限 10MB，請選擇較小的圖片。");
  const pixels = await declaredPixels(file);
  if (pixels && pixels > 24_000_000)
    throw new Error("圖片超過 2,400 萬像素，請先縮圖，避免手機記憶體不足。");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("無法讀取圖片，檔案可能已損壞或格式不支援。");
  }
  try {
    let scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    let blob: Blob | undefined;
    for (let pass = 0; pass < 5; pass++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("圖片壓縮失敗。"))),
          "image/webp",
          Math.max(0.6, 0.9 - pass * 0.07),
        ),
      );
      if (blob.size <= IMAGE_STORED_LIMIT) break;
      scale *= 0.85;
    }
    if (!blob || blob.size > IMAGE_STORED_LIMIT)
      throw new Error("壓縮後仍超過 2MB，請先縮小圖片。");
    return await stageAsset(
      blob,
      file.name,
      "image",
      canvas.width,
      canvas.height,
    );
  } finally {
    bitmap.close();
  }
}
export async function validateBookMedia(
  doc: Notebook,
): Promise<{ count: number; bytes: number }> {
  const count = doc.blocks.filter((b) => b.image).length;
  if (count > 50) throw new Error("每本最多 50 張圖片，請拆成多本筆記。");
  let bytes = 0;
  for (const id of mediaIds(doc)) bytes += (await getMedia(id)).bytes;
  if (bytes > BOOK_MEDIA_LIMIT)
    throw new Error("每本圖片與文件合計上限 50MB，請拆成多本。");
  return { count, bytes };
}
export async function storageUsage(): Promise<string> {
  try {
    const s = await navigator.storage?.estimate();
    return s?.quota
      ? `此網站已用 ${((s.usage || 0) / 1048576).toFixed(1)}MB／可用配額約 ${(s.quota / 1048576).toFixed(0)}MB`
      : "實際容量依瀏覽器與裝置而定";
  } catch {
    return "無法取得瀏覽器容量";
  }
}
export function cleanupPending(documents: Notebook[], extraIds: string[] = []) {
  const used = new Set([...documents.flatMap(mediaIds), ...extraIds]);
  for (const id of pendingMedia.keys())
    if (!used.has(id)) {
      pendingMedia.delete(id);
      const url = urls.get(id);
      if (url) {
        URL.revokeObjectURL(url);
        urls.delete(id);
      }
    }
}
