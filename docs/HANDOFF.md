# 頁白｜接手與中斷紀錄

最後更新：2026-11-06（Asia/Taipei）。原始碼版本：**1.7.0**。遠端：<https://github.com/alvis9315/paper-between>，分支：`main`。

## 目前接續位置

依使用者順序，先部署 1.6.2 手機修正，再實作 1.7.0 考前小卡與 PDF 重排第一階段。1.7.0 build／20 情境跨引擎 40 個執行個案／diff 檢查通過，GitHub 同步及 Sites 部署成功。

- 小卡：`StudyCards.vue`、`core/reviewCards.ts`；與書架同層，單卡、主題＋搜尋、相關清單／跳選、滑動、編輯與來源建卡。詳見 [使用與資料規則](STUDY-CARDS.md)。
- 重排：`ReflowDialog.vue`、`core/reflow.ts`；整組圖解保留、可校正正文／主題、區域／欄位設定、多頁佇列、另建筆記。詳見 [重排方案](DOCUMENT-REFLOW.md)。未自動拆解五張卡片，沒有 OCR。
- 資料：`LibraryState.reviewCards` 為可選欄位；索引共同保存、ZIP 帶小卡／媒體／來源對應、純小卡 ZIP 允許零書本。備份驗證完才加入。
- WebKit 已重現 Blob 寫入 UnknownError。`storage.ts` 在交易前把媒體轉 ArrayBuffer，`media.ts` 讀舊 Blob 或新 data 並對外仍回傳 Blob。新寫入不再依賴 Blob 落盤；不要把內部 data 帶進 ZIP。
- 原檔遺失時 layout 會顯示持續的重試／備份還原入口，避免只剩短暫 toast 與空畫面。
- 驗證：`tests/study.spec.ts` 已納版控，合成文件與小卡；Chrome／WebKit。後者無法在此環境 seed 舊 Blob 紀錄，舊 Blob 讀取在 Chrome 驗證，WebKit 驗證正式位元組路徑。

使用者手機是 Safari 26.0.1，沒有取得原兩份 PDF，不能把 WebKit 合成測試等同實機／原檔驗收。下一步由使用者確認實機／原檔與新流程；後續擴充以具體回饋及原檔為準。

## 每輪部署方式與目前狀態

先看 AGENTS 的「每輪完成後直接部署」規則。GitHub 與 Sites 的來源倉庫是兩個同步目的地；推 GitHub 之後仍要透過 Sites 技能的 source helper 同步並打包，使用既有 project_id，不重新建站。

- 線上網址：https://paper-between-alvis9315.javacj02004.chatgpt.site
- project_id：`appgprj_6aed516760108191a427a46f6b0e34a7`
- 現有存取範圍：public；保留既有範圍，不自行改權限。

### 最新部署：1.7.0

- 原始碼版本：1.7.0；Sites 版本：13。
- 部署來源 commit：`b18629450e37a81c20260ca66737ba7b573dd337`（與本輪 GitHub 程式版本一致）。
- version_id：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_007b131bb3e88191a581dbc9f6e9695d`
- deployment_id：`appgdep_6aede06855708191a8bc591e3dbf1d2c`
- 結果：`succeeded`，2026-11-06 22:13（Asia/Taipei）。
- 後續純文件 commit 回填證據，不改變實際部署來源。

### 先前部署：1.6.2

- 原始碼版本：1.6.2；Sites 版本：12。
- 部署來源 commit：`04f165be0c41b691b92d20012ee756605e54496c`。
- version_id：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_1eda1d2f48b08191962374e80fe83a90`
- deployment_id：`appgdep_6aedd85244548191a6757ea1d01fec72`
- 結果：`succeeded`，2026-11-06 21:38（Asia/Taipei）。
- 後續文件 commit 回填證據，不改變實際部署來源。

### 歷史部署：1.6.1

- 原始碼版本：1.6.1；Sites 版本：11。
- 部署來源 commit：`45469fe9aa776c3f84ae46512a3acfb34509ae4b`（與本輪 GitHub 程式版本一致）。
- version_id：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_4c79f488ce8881918e463d106381c7d8`
- deployment_id：`appgdep_6aedd2cd1c7881919b3fcf362fdc2757`
- 結果：`succeeded`，2026-11-06 21:15（Asia/Taipei）。
- 部署後的純文件 commit 只回填紀錄，真正部署程式以上述來源 commit 為準。

### 先前部署：1.6.0

- 原始碼版本：1.6.0；Sites 版本：10。
- 部署來源 commit：`c293e4a21fa72c0566f6d6f33c99be515eb83e20`（與本輪 GitHub 程式版本一致）。
- version_id：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_6c65d56c12d8819195831629dd79df85`
- deployment_id：`appgdep_6aedd0ddfbc8819199877ed47d4c51f1`
- 結果：`succeeded`，2026-11-06 21:06（Asia/Taipei）。
- 部署後的純文件 commit 只回填紀錄，真正部署程式以上述來源 commit 為準。

### 先前部署：1.5.1

- 原始碼版本：1.5.1；Sites 版本：9。
- 部署來源 commit：`282fe63ef00d9ac22868218efd601cd57a74c4c8`。
- version_id：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_f857e59b9e80819192b53a1b684483ce`
- deployment_id：`appgdep_6aedca537e8c81918b11f1aafc601580`
- 結果：`succeeded`，2026-11-06 20:38（Asia/Taipei）。
- 本次紀錄回填為純文件變更，實際部署程式仍以上述來源 commit 為準。

### 先前部署：1.5.0

- 本輪原始碼 1.5.0，Sites 版本 8：`succeeded`，2026-11-06 20:18（Asia/Taipei）。
- 實際部署來源：`3b45fdcc6584613f9ed506203302a88167bb014e`；與當時 GitHub main 相同。
- saved version ID：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_e348a48bb41481919c821ac771e48c57`
- deployment ID：`appgdep_6aedc59f7dfc8191a5a6aabeece34bb6`
- 第一次發布 `appgdep_6aedc5752ce08191b59eb0cfe5fec7bd` 因服務暫時無法使用而失敗；同版本重試後成功。不要再重試已成功的部署。
- 這次發布證據回填為純文件變更，不需要重新發布同一套程式。
- `.sites-checkout/` 是被忽略的部署暫存 checkout，可重建；不要把憑證或其 Git metadata 放進 GitHub。

部署成功後回填的純文字紀錄可以再 commit／push，不必為相同的程式重複部署。所有紀錄都應指出真正部署的來源 commit。

## 新電腦開始

首次取得：

```sh
git clone https://github.com/alvis9315/paper-between.git ~/Projects/paper-between
cd ~/Projects/paper-between
npm ci
npm run dev -- --port 4112 --strictPort
```

已有 clone：先 `git status` 確認本機有無未保存修改，再 `git pull --ff-only origin main`；依賴變動後重跑 `npm ci`。遇到 diverged／衝突先保留本機工作並查看雙方變更，不以 reset／force push 清掉。

入口：http://127.0.0.1:4112/ 。本工作區已將 port 4112 登記於 WORKSPACE-SETUP；workbench-nexus 有 LOCAL 入口。這兩個 repo 的登記變更此前仍有未 push 內容，需各自保存；單獨 clone 本 repo 仍可用上方指令啟動。

Chrome 是目前 Playwright 指定的瀏覽器，新機需先安裝。驗證：

```sh
npm run build
npm test
git diff --check
```

Playwright 會自行啟動 4112 的 dev server；若該 port 已有服務，確認跑的是這個 checkout。測試用獨立瀏覽器環境與合成資料，不需要個人筆記。

程式放在 GitHub 不代表筆記同步。換機前在原網址的書架下載 ZIP 備份；新瀏覽器／網址匯入後才有原筆記、圖片、重點及進度。主題與顯示偏好屬瀏覽器設定；卡片／條列偏好不隨 Git clone 搬移。

## 這輪改動入口

| 要修改的部分 | 主要檔案 |
|---|---|
| 頂部操作、搜尋浮層、閱讀尺寸、狀態與面板 | `src/App.vue`、`src/style.css` |
| 翻頁、書頁頁碼、放大入口 | `src/components/BookView.vue`、`PageLeaf.vue` |
| 跳頁與第一／最後一頁面板 | `src/components/PaginationBar.vue` |
| 放大逐頁閱讀、縮放、獨立捲動 | `src/components/ReaderDetail.vue`、`PdfPage.vue` |
| 書架卡片／條列、收藏、搜尋、書卡操作 | `src/components/Bookshelf.vue` |
| 書架分頁／每頁數／跳頁 | `CollectionPagination.vue`、`Bookshelf.vue` |
| 指南／備份彈窗及活動捲軸 | `ModalShell.vue`、`core/scrollActivity.ts`、`src/style.css` |
| 圖示中文浮動標籤 | `src/components/IconAction.vue` |
| 日夜色票、主題保存 | `src/theme.css`、`src/core/theme.ts` |
| 分頁、位置、儲存、備份格式 | `src/core/pagination.ts`、`navigation.ts`、`storage.ts`、`backupBundle.ts` |

最新決策：日夜共用可可棕 `#88634f` 與書封，夜間使用炭灰；點品牌回書架，移除重複的頂部書架入口；卡片／條列切換在搜尋旁。閱讀頁文字說明集中到指南／資訊，不增加常駐上下區塊。

## 1.5.0 驗證證據（歷史）

2026-11-06，`npm run build` 與以下 5 個 Playwright 案例通過：

- `tests/reader.spec.ts`：文字閱讀跨 7 種尺寸的完整容納與零整頁捲動，搜尋、跳頁輸入與首末頁、文字放大逐頁閱讀。
- 同檔：合成 6 頁 PDF 的完整顯示、放大捲動與逐頁切換、關閉回到對應位置、手機單頁。
- 同檔：觸控工具列、滑動翻頁、重點面板不擠壓書本、重整後閱讀位置與夜間偏好。
- `tests/shelf.spec.ts`：位置標示、卡片／條列保存、搜尋、重新命名、複製、回收與還原、進出閱讀及重新整理。
- 同檔：兩模式主色／書封相同、hover、減少動態效果、手機無橫向溢出。

測試資料直接在獨立瀏覽器 IndexedDB 建立。若修改測試初始化，先等初始空白書架載入完成，再寫入合成資料，避免和舊格式遷移流程競爭造成假失敗。截圖與報告位於忽略的 `test-results/`，換機請重跑產生。

以上不是實體手機／Safari 或使用者觀感驗收；尚未補做這些項目。建置會依主機平台更新 `public/third-party-notices.txt` 的可選相依授權；無相依變更時檢查並排除無關平台差異。

## 突然做到一半時，更新這一節

1.7.0 已完成 build／40 個跨引擎執行個案／diff 檢查、GitHub 同步及部署。沒有未完成的本輪程式工作。OCR、五張色塊自動拆分未提供；實體 Safari 26.0.1 與使用者原兩份 PDF 尚待驗證。下一輪中斷時用實際狀態取代本段，並同步 STATUS：

```text
更新時間：YYYY-MM-DD HH:mm Asia/Taipei
正在處理：使用者需求及範圍
已完成：具體行為與檔案
做到一半：檔案／函式、目前現象、重現指令
下一個動作：接手後第一個可執行步驟
測試：已跑的指令與結果；未跑／失敗的項目
Git：分支、最後一筆 commit、未提交檔案、push 是否成功
資料／環境：必要設定名稱、port、資料備份位置；不寫密鑰
```

更新 Markdown 後，若需要換機接續，要連同未完成但需保留的程式 commit 並 push（可標 WIP），不能只有本機筆記。用 `git status`、`git log -1`、`git ls-remote origin refs/heads/main` 核對；雲端與本機 commit 不一致時，明列尚未同步的部分。
