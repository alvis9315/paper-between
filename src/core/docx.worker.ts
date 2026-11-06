/// <reference lib="webworker" />
import * as mammoth from "mammoth";
import { strFromU8, unzipSync } from "fflate";

self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    let expanded = 0;
    const files = unzipSync(new Uint8Array(event.data), {
      filter(file) {
        expanded += file.originalSize;
        if (expanded > 48 * 1024 * 1024)
          throw new Error("文件解壓後超過 48MB，請拆分成較小的文件。");
        return /^(word\/(document|footnotes|endnotes|header\d*|footer\d*)\.xml|\[Content_Types\]\.xml)$/.test(
          file.name,
        );
      },
    });
    if (!files["word/document.xml"] || !files["[Content_Types].xml"])
      throw new Error("這不是有效的 Word .docx 文件。");
    const xml = strFromU8(files["word/document.xml"]);
    const warnings: string[] = [];
    if (/<(?:w:drawing|w:pict|w:object)\b/.test(xml))
      warnings.push("圖片、圖表及嵌入物件已略過。");
    if (/<w:txbxContent\b/.test(xml))
      warnings.push("文字方塊的內容可能無法完整保留，請改用一般段落。");
    if (/<(?:m:oMath|w:altChunk)\b/.test(xml))
      warnings.push("數學公式或外部嵌入內容不支援，已略過。");
    if (
      Object.keys(files).some((name) =>
        /word\/(header|footer)\d*\.xml/.test(name),
      )
    )
      warnings.push("已略過 Word 頁首頁尾，改用筆記本頁碼。");
    if (/<w:(?:vMerge|gridSpan)\b/.test(xml))
      warnings.push("合併儲存格已簡化；複雜表格建議先在 Word 取消合併。");
    if (/<w:(?:ins|del)\b/.test(xml))
      warnings.push(
        "文件含修訂紀錄，請先在 Word 確認修訂；匯入採解析器可讀取的文字。",
      );
    const result = await mammoth.convertToHtml(
      { arrayBuffer: event.data },
      {
        styleMap: [
          "p[style-name='標題 1'] => h1:fresh",
          "p[style-name='標題 2'] => h2:fresh",
          "p[style-name='標題 3'] => h3:fresh",
        ],
        convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
      },
    );
    if (result.messages.length)
      warnings.push(
        `解析器回報 ${result.messages.length} 項格式提醒；不支援的 Word 樣式已統一為閱讀樣式。`,
      );
    if (result.value.length > 4_000_000)
      throw new Error("解析後內容過大，請拆分成較小的文件。");
    self.postMessage({ html: result.value, warnings });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error && /文件|48MB/.test(error.message)
          ? error.message
          : "無法讀取這份 Word 文件，可能已損壞、加密或格式不正確。請另存為未加密的 .docx 再試一次。",
    });
  }
};
