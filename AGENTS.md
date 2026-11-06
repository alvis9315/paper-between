# 頁白｜Agent 開發規則

## 接手順序

使用繁體中文。先讀 `README.md` → `STATUS.md` → `docs/HANDOFF.md`，再讀工作所需的程式；版本歷史見 `CHANGELOG.md`。不要只靠對話紀錄或某台電腦的 agent memory 接續。

## 專案與既有決策

- Vue 3 + TypeScript + Vite，純前端；只用 npm 與既有 `package-lock.json`。
- 文件、圖片、PDF 與閱讀位置使用瀏覽器 IndexedDB；主題與書架顯示偏好使用 localStorage。GitHub 不保存使用者筆記。
- 不預載私人文件。不要提交 `.env`、憑證、個人筆記、書架備份、`node_modules/`、`dist/` 或測試產物。
- 保留 `paper-between` 的儲存識別及舊備份相容性；對外品牌是「頁白」。
- 閱讀頁書本依視窗可用寬高排版，固定頂部圖示工具列，不產生整頁捲動。細節放大視窗可捲動並逐頁切換。
- 頁碼在書頁底部，點擊開啟跳頁與首末頁面板；前後箭頭保留在書本兩側。說明收進閱讀指南／資訊。
- 書架支援卡片／條列，記住偏好。「我的書架」在書架頁是目前位置，回筆記使用「回到閱讀」。
- 日夜共用可可棕主色與原書封；夜間使用炭灰背景。hover 輕抬／傾斜，尊重 `prefers-reduced-motion`。
- 本機固定 `npm run dev -- --port 4112 --strictPort`；port 正本在 WORKSPACE-SETUP。不要另佔預設 port 當常用入口。
- 本 repo 沿用 `main`；不要自行建立新分支。GitHub 原始碼同步與網站部署分開，未實際部署就不要宣稱線上版已更新。

## 驗證與版本

- 交付前執行 `npm run build`（含 typecheck）；互動、版面、主題或測試變動再執行 `npm test`。
- Chrome 為目前 Playwright 設定的瀏覽器。5 個測試使用合成資料；報告與截圖可重建，不是接手的必要檔案。
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
