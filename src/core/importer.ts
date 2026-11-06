import { normalizeHtml } from "./normalize";
import type { Notebook } from "./model";
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export async function importDocx(file: File): Promise<Notebook> {
  if (!/\.docx$/i.test(file.name))
    throw new Error("目前只支援 .docx 格式，請在 Word 另存為 .docx 文件。");
  if (file.size > MAX_FILE_SIZE)
    throw new Error("檔案超過 10MB，請縮小或拆分文件後再匯入。");
  if (!file.size)
    throw new Error("這個檔案是空的，請選擇有內容的 .docx 文件。");
  const buffer = await file.arrayBuffer();
  const parsed = await new Promise<{ html: string; warnings: string[] }>(
    (resolve, reject) => {
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
    },
  );
  return normalizeHtml(
    parsed.html,
    file.name.replace(/\.docx$/i, ""),
    parsed.warnings,
  );
}
