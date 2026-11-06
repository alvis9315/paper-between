# Word 匯入與原頁保留

1.7.1 修正 PDF 還原成 Word 後文字被拆散、圖解移到開頭與頁數膨脹的問題。

## 問題與分流

一般 `.docx` 使用段落、清單與表格；PDF 還原的 Word 可能把一頁做成一張非文字背景，加上上百個依頁面座標放置的文字方塊。同一句的中英文字詞也可能是不同方塊。把這些方塊送入只保留語意的 Mammoth，再一個方塊做一段，會破壞原有關係。

- 一般段落文件：繼續使用 Mammoth → 正規化 → 自動分頁，保留可編輯文字。
- 固定座標圖文：辨識到文字方塊／定位框時，先驗證版面結構。支援的文件按原座標建立本機 PDF 閱讀版本，保留原頁尺寸、圖像、文字大小、顏色、粗體、字型及分頁，再沿用既有原頁閱讀、搜尋、選字、重點、放大、重排與 ZIP。
- 結構不支援或缺字型：提示從 Word 匯出 PDF 後匯入；不默默回退到攤平的文字。原書架不改動。

這是原頁保留修正，**不是全功能 Word 排版引擎，也不是自動智慧重排**。一般段落文件仍採頁白的統一閱讀樣式，並不承諾所有 Word 都與 Microsoft Word 像素一致。

## 支援的固定版面

單一紙張 section、明確 `pageBreakBefore` 分頁、相對 page 的 DrawingML PNG／JPEG 圖片，以及未旋轉、透明且無邊框的 VML 單行文字方塊。文字保留多 run、字級、粗斜體、色彩與水平伸縮。原文件的 ODTTF 嵌入字型依 fontKey 還原，僅用於該文件的閱讀版本，未送到伺服器或作共用字型資產。

混合流式段落、表格、多 section、文字方塊內多段／換行、旋轉、圖片裁切與其他未支援圖形不能直接當成支援版面。一般浮動文字方塊／SmartArt／任意 Word 不能保證原貌，需使用 PDF。

Word 原檔請保留在使用者裝置。書架保存的是本機生成的原頁閱讀 PDF，含真正文字層，不是整頁截圖；ZIP 保存閱讀版本。舊版已匯入的碎段落筆記沒有原始 Word，不能自動還原，須重新匯入原 Word；不自行刪除／覆蓋使用者舊筆記。

## 程式與驗證

- `core/docx.worker.ts`：48MB 解壓上限與 Word 結構辨識；固定版面不送 Mammoth 攤平。
- `core/fixedWord.ts`：OOXML namespace／關聯／頁面／文字方塊／字型驗證，本機動態載入 pdf-lib 及 fontkit 生成原頁閱讀版本。非支援內容停止，不默默丟字。
- `core/importer.ts`：分流及進度，沿用 PDF 媒體與備份，10MB 原檔／生成版本、200 頁上限。
- `tests/word.spec.ts`：合成定位 Word，驗證兩頁維持兩頁、同一行題目位置、搜尋、手機、重新整理及 ZIP；另測不支援結構不改書架、一般 Word 仍可編輯。不得提交私人教材作 fixture。

2026-11-06 已取得使用者下載資料夾兩組 PDF／DOCX，於 Chrome 與 WebKit 對照匯入：考題 22 頁、總複習 14 頁，均維持原頁數；原 PDF 與 Word 原頁閱讀的第一頁截圖已人工檢視。私人檔案與截圖未納入 GitHub／部署。自動化 WebKit 仍不等於實體 Safari 26.0.1 驗證。

## 參考

- [Mammoth](https://github.com/mwilliamson/mammoth.js)：語意轉換，非忠實複製 Word 版面。
- [PDF-lib](https://pdf-lib.js.org/) 與 [嵌入字型](https://github.com/Hopding/pdf-lib#embed-font-and-measure-text)：瀏覽器內建立有字型及文字層的閱讀文件。
