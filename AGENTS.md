# 頁白｜Agent 開發規則

## 接手順序

使用繁體中文。先讀 `README.md` → `STATUS.md` → `docs/HANDOFF.md`，再讀工作所需的程式；版本歷史見 `CHANGELOG.md`。不要只靠對話紀錄或某台電腦的 agent memory 接續。

## 專案與既有決策

- Vue 3 + TypeScript + Vite，純前端；只用 npm 與既有 `package-lock.json`。
- 文件、圖片、PDF 與閱讀位置使用瀏覽器 IndexedDB；主題與書架顯示偏好使用 localStorage。GitHub 不保存使用者筆記。
- 不預載私人文件。不要提交 `.env`、憑證、個人筆記、書架備份、`node_modules/`、`dist/` 或測試產物。
- 保留 `paper-between` 的儲存識別及舊備份相容性；對外品牌是「頁白」。
- 閱讀頁書本依視窗可用寬高排版，固定頂部圖示工具列，不產生整頁捲動。細節放大視窗可捲動並逐頁切換。
- 頁碼在書頁底部，點擊開啟跳頁與首末頁面板；桌機前後箭頭完整置於書本外側，窄螢幕放在頁腳頁碼兩旁，不得跨封面或壓正文。說明收進閱讀指南／資訊。
- 書架支援卡片／條列、我的最愛與每頁 6／12／24 本（預設 12），記住顯示偏好；超過每頁數量才顯示分頁。點「頁白」回書架，回筆記使用「回到閱讀」，不另加重複書架入口。
- 所有捲軸只在實際捲動時顯示，停止後隱藏；沿用 `trackScrollActivity`。閱讀指南／備份引導用 `ModalShell` 保持在頂部列之上及視窗內。
- 收藏為 BookRecord 的可選 favorite 欄位，須保留 IndexedDB 與 ZIP／舊版 JSON 相容性；備份匯入前完整驗證，錯誤用主題彈窗引導。
- 日夜共用可可棕主色與原書封；夜間使用炭灰背景。hover 輕抬／傾斜，尊重 `prefers-reduced-motion`。
- 可見控制元件必須符合主題樣式；下拉用 `ChoiceSelect`、圖示提示用 `IconAction`、展開區用 `DisclosurePanel`，不要加入原生 select／title 提示／未設計的勾選或展開外觀。保留語意化 HTML 與鍵盤能力；完整盤點見 `docs/UI-CONTROLS.md`。
- 本機固定 `npm run dev -- --port 4112 --strictPort`；port 正本在 WORKSPACE-SETUP。不要另佔預設 port 當常用入口。
- 本 repo 沿用 `main`；不要自行建立新分支。GitHub 原始碼同步與網站部署分開，未實際部署就不要宣稱線上版已更新。

## 每輪完成後直接部署（使用者已授權）

- 2026-11-06 起，每輪優化完成並通過驗證後，必須 commit／push GitHub 並直接部署到既有 Site，不停在本機或只推 GitHub，也不再重問部署許可。
- 沿用 `.openai/hosting.json` 的 project_id、既有網址與存取範圍；Site：<https://paper-between-alvis9315.javacj02004.chatgpt.site>。
- 使用 Sites 技能／工具同步實際部署來源、建置打包、儲存版本與發布；GitHub push 不會自動更新 Site。不得另建 Site 取代既有站。
- 部署後等到終態，記錄 URL、來源 commit、Site 版本 ID 與部署 ID 到 STATUS／交接。失敗或等待中必須如實標記，不得宣稱已上線。
- 只有使用者當輪明確指定「只改本機／先不要部署／只存版本」時才略過發布。中斷的 WIP 不直接上線。
- 部署成功後回填結果的純文件 commit 可單獨 push，不重複部署；文件須保留真正部署的來源 commit，避免把紀錄 commit 誤當部署來源。

## 驗證與版本

- 交付前執行 `npm run build`（含 typecheck）；互動、版面、主題或測試變動再執行 `npm test`。
- Playwright 同時測 Chrome 與 WebKit（後者仍非實體 Safari 26.0.1）；新機先執行 `npm exec playwright install webkit`。瀏覽器測試使用合成資料；報告與截圖可重建，不是接手的必要檔案。
- 檢查 `git diff --check`。授權檔會依建置平台生成；沒有變更依賴時，避免混入無關的平台授權檔差異。
- 完成一個版本時同步 `package.json`、`package-lock.json` 與 `CHANGELOG.md`。修 bug 用 patch、新增相容功能用 minor；尚未完成的項目放 `Unreleased` 或狀態文件，不冒充已發布。
- Conventional Commits，例如 `feat: ...`、`fix: ...`、`docs: ...`。不 force push，不覆蓋使用者既有修改。

## 收工與中斷時必做

1. 更新 `STATUS.md`：最後完成、正在進行、下一個明確動作、已知限制與最新驗證結果。
2. 更新 `docs/HANDOFF.md`：正在處理的需求、改到哪些檔案、尚未完成／失敗之處，以及下一步的檔案或指令。
3. 將使用者可感知的完成項目記入 `CHANGELOG.md`；需要改啟動方式時同步 README。
4. 使用者要求備份／換機／上 GitHub 時，將本次相關程式、文件與可重現測試一起 commit 並 push；未完成工作可以明確標記 WIP，不把未通過測試寫成通過。
5. 以 `git status`、`git log -1` 與遠端 commit 確認同步結果。若未 commit／未 push／無法 push，在交接及回覆中明說；只有本機檔案不足以換機接續。

上述交接要求在收到暫停／換模型／換裝置要求時也適用；緊急終止前來不及完成的部分，下次接手先比對 Git diff。

- PDF 已提供圖解＋正文的可校正重排第一階段，另建筆記並保留原檔／註記；OCR、色塊自動拆解仍未提供，見 `docs/DOCUMENT-REFLOW.md`。
- 考前小卡與書架同層：>900px 左側常駐結果、右側單卡；≤900px 搜尋後清單選題、再讀卡，搜尋獨立、其他操作進選單。左右與頂部共用 gutter，不加第二層限寬／padding。說明集中在彈窗，見 `docs/STUDY-CARDS.md`。
- 小卡可保留速答、rich HTML、原文頁、題圖、收藏與 ZIP；匯入小卡 HTML 只讀資料不執行程式，答案必須清理。舊欄位／備份相容，不預載指定私人範例。原文分段不冒充 AI 摘要／出題。
- `library-index.reviewCards` 與筆記共同儲存，ZIP 必須保留小卡、來源對應與圖片，舊備份缺欄位視為空。原始儲存識別不改。
- 媒體新的 IndexedDB 紀錄使用 `data: ArrayBuffer` 避開 WebKit Blob 寫入錯誤；`getMedia` 必須繼續讀舊 Blob 並對外回傳 MediaAsset，不把內部 data 欄位帶進 ZIP。
- Word 須區分一般段落與固定座標圖文；文字方塊不能直接攤平成段落。支援的定位版面用本機原頁閱讀，不支援則明確引導 PDF，不能假成功後丟失版面；見 `docs/WORD-IMPORT.md`。私人教材／字型不納入 repo。
- 產品定位與競品建議保存在 `docs/PRODUCT-STRATEGY.md`，均為待驗證方向，不能當作已完成或自動擴大當輪需求。

- 小卡來源檔名不當內容標籤；PDF／固定 Word 以 cardTopics 規則分類，無可靠線索留未分類。topicOrigin 為 manual 的卡與 HTML 原分類不得自動覆寫；舊檔名卡修復僅更新分類，不改答案／ID／去重鍵／收藏。
