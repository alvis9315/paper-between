# 頁白｜接手與中斷紀錄

最後更新：2026-11-07（Asia/Taipei）。原始碼版本：**1.9.0**。遠端：<https://github.com/alvis9315/paper-between>，分支：`main`。

## 目前接續位置

本輪新增卡組管理層；卡組內保留原搜尋／標籤／閱讀。1.9.0 build、33 情境 × Chrome／WebKit 共 66 個執行個案與 diff 檢查通過，正在同步 GitHub／Sites，線上仍是下方 1.8.1。

- `StudyDecks.vue`：卡組首頁、名稱搜尋／新增／改名／刪除確認；App 的 reviewDecks／activeDeckId 管理組別，進入後只傳該組 cards 給 StudyCards。移動只改 deckId；標籤、內容、收藏與 sourceKey 保留。相同來源允許在不同卡組建卡，同組去重。
- `core/reviewDecks.ts`：舊平放資料完整整理至一組「我的小卡」，不依來源或標籤拆組；新卡組不是來源檔名／主題標籤。`storage.ts` 保存 metadata，`backupBundle.ts` 支援空卡組、舊格式、全量歸屬驗證及 ID 重映射。
- 新卡／檔案匯入／從筆記建立都歸入目前卡組。匯入／分類時透過 working 事件鎖住切換，原始目標 ID 明確傳回 App；媒體清理使用所有卡組的全域引用，避免移除其他組尚未落盤的圖片。偏好依 deckId 保存；頂部「考前小卡」一律回管理首頁。舊的卡組內標籤操作不變。
- 實際指定 HTML 兩引擎驗證 184 卡／18 標籤／兩來源／五張含題圖，加入一組並保留另一空組，ZIP 歸屬一致；私人資料不提交。
- `tests/decks.spec.ts` 新增生命週期、隔離、移動、舊資料遷移、空卡組、備份及錯誤歸屬；既有小卡測試增加進入卡組步驟，備份還原為獨立組，合計數量仍驗證。

- `core/cardTopics.ts` 讀 PDF 字級／座標合併標題，跨頁樣式過濾圖表標籤；依內容／原頁位置分類，無線索用重複縮寫或留空，不使用私人題庫／固定科目詞庫。固定 Word 共用 PDF 路徑；一般 Word 仍依 heading。
- `StudyCards.vue` 生成／舊卡修復接到分類；初次掛載修復只有檔名／空標籤的舊自動卡，生成面板可手動更新自動分類。App 僅批次寫 tags／topicOrigin，不替換卡片正文／ID／sourceKey／收藏；手動標籤與 HTML 原分類排除。解析原檔失敗不部分加入／更新。
- `ReviewCard.topicOrigin` 為可選 auto／manual，編輯標籤才設 manual，ZIP 保留；舊欄位相容。來源檔名不當內容主題，空標籤有未分類入口。
- 指定 HTML 的 184 為卡片數；主題實際 18 個、章節 37 個。HTML 原有分類並未丟失，使用者確認走 PDF／Word 建卡，缺漏在該流程。自動規則不等同這份手工整理的語意分類或分題品質。
- 實際 PDF／固定 Word 在 Chrome／WebKit 分類結果一致：考題 32 個候選主題，9 張未分類；總複習 PDF 16／Word 15 個，Word 2 張未分類。規則式分類仍需校正，不宣稱等同人工整理。
- 新增合成 PDF 直接建卡、舊檔名卡自動修復、手改答案／收藏／標籤保護、ZIP 與 120 個不同標籤匯入測試。私人 PDF／Word 僅本機 QA，不提交。
- 小卡桌機／手機：`StudyCards.vue` + `src/study.css`；>900px 常駐左結果右卡片，≤900px 搜尋後先清單再單卡，其他操作進選單；主畫面沒有重複大標、宣傳／保存說明，側邊與頂部共用 gutter。
- 內容：`cardContent.ts` 清理 HTML／高亮／欄位驗證，`cardImport.ts` 只讀資料匯入。ReviewCard 新可選欄位保留速答、題幹、表格答案、收藏、章節／別名及原文頁，舊版相容。原有 saveLibrary／ZIP 路徑沿用，新欄位還原與圖片參照已驗證。
- 參考 HTML 共 184 張、兩來源、五張含題圖，已在 Chrome／WebKit 匯入及 ZIP 還原。實際資料只用本機隔離瀏覽器驗證，不放 repo／部署；線上用「匯入小卡」選使用者自己的 index.html，不預載。
- `tests/study-layout.spec.ts` 用合成三張卡、原文與 canvas 圖驗證兩套版面、收藏／來源／搜尋交集、字級、來源／題圖／標籤視窗、手機鍵盤可見高度與 320–2560px、表格不換卡、HTML 不執行程式及備份；既有 `study.spec.ts` 配合常駐清單更新選題路徑。
- 使用規則與格式見 [STUDY-CARDS.md](STUDY-CARDS.md)。新功能沒有 AI 自動出題、間隔複習或同步；HTML 原文對照是抽取文字，不是原 PDF。

- Word：`core/docx.worker.ts` 分流一般段落／定位圖文；`core/fixedWord.ts` 用文件自己的座標、圖片及嵌入字型建立本機原頁 PDF，`importer.ts` 接回原頁閱讀。考題維持 22 頁、總複習 14 頁，可搜尋、選字、註記、放大及 ZIP。
- 支援範圍見 [WORD-IMPORT.md](WORD-IMPORT.md)，不是通用 Word 排版引擎。遇到混合流式／不支援圖形不回退到攤平；保留舊書架並引導 PDF。舊版碎筆記沒有原 Word，須重新匯入，不自行刪除舊本。
- `tests/word.spec.ts` 以合成 Word 驗證定位、同列字詞、原頁數、搜尋、手機、重新整理、ZIP、一般 Word 可編輯與不支援版面。新增 pdf-lib／fontkit 只在定位文件匯入時動態載入。

- 小卡：`StudyCards.vue`、`core/reviewCards.ts`；與書架同層，單卡、主題＋搜尋、相關清單／跳選、滑動、編輯與來源建卡。詳見 [使用與資料規則](STUDY-CARDS.md)。
- 重排：`ReflowDialog.vue`、`core/reflow.ts`；整組圖解保留、可校正正文／主題、區域／欄位設定、多頁佇列、另建筆記。詳見 [重排方案](DOCUMENT-REFLOW.md)。未自動拆解五張卡片，沒有 OCR。
- 資料：`LibraryState.reviewCards` 為可選欄位；索引共同保存、ZIP 帶小卡／媒體／來源對應、純小卡 ZIP 允許零書本。備份驗證完才加入。
- WebKit 已重現 Blob 寫入 UnknownError。`storage.ts` 在交易前把媒體轉 ArrayBuffer，`media.ts` 讀舊 Blob 或新 data 並對外仍回傳 Blob。新寫入不再依賴 Blob 落盤；不要把內部 data 帶進 ZIP。
- 原檔遺失時 layout 會顯示持續的重試／備份還原入口，避免只剩短暫 toast 與空畫面。
- 驗證：`tests/study.spec.ts` 已納版控，合成文件與小卡；Chrome／WebKit。後者無法在此環境 seed 舊 Blob 紀錄，舊 Blob 讀取在 Chrome 驗證，WebKit 驗證正式位元組路徑。

使用者手機是 Safari 26.0.1。本輪已取得下載資料夾原兩組 PDF／Word，Chrome／WebKit 匯入成功並對照第一頁，私人檔案／字型／截圖不納入 repo 或部署。這仍不等於實體 Safari 驗收；由使用者確認重新匯入 Word、原 PDF 實機結果。

## 每輪部署方式與目前狀態

先看 AGENTS 的「每輪完成後直接部署」規則。GitHub 與 Sites 的來源倉庫是兩個同步目的地；推 GitHub 之後仍要透過 Sites 技能的 source helper 同步並打包，使用既有 project_id，不重新建站。

- 線上網址：https://paper-between-alvis9315.javacj02004.chatgpt.site
- project_id：`appgprj_6aed516760108191a427a46f6b0e34a7`
- 現有存取範圍：public；保留既有範圍，不自行改權限。

### 最新部署：1.8.1

- 原始碼版本：1.8.1；Sites 版本：16。
- 部署來源 commit：`d0ea9e9555be69f1f29ad82d8e09c371302d124a`（與本輪 GitHub 程式版本一致）。
- version_id：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_784bcbaece8081918a96a43f6c88d007`
- deployment_id：`appgdep_6aee18c236e48191ab075a87a579199e`
- 結果：`succeeded`，2026-11-07 02:13（Asia/Taipei）。
- 後續純文件 commit 回填證據，不改變實際部署來源。

### 先前部署：1.8.0

- 原始碼版本：1.8.0；Sites 版本：15。
- 部署來源 commit：`47f4c0747311462378bb572b59ea0f3c4dc3b78b`（與本輪 GitHub 程式版本一致）。
- version_id：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_20b2435f5ce88191954a27e07411125f`
- deployment_id：`appgdep_6aee02508c5c819199551bc288cb1ee9`
- 結果：`succeeded`，2026-11-07 00:37（Asia/Taipei）。
- 後續純文件 commit 回填證據，不改變實際部署來源。

### 先前部署：1.7.1

- 原始碼版本：1.7.1；Sites 版本：14。
- 部署來源 commit：`ac8d26d0e19e07c9bf527f7fb64b4cc5e75868d4`（與本輪 GitHub 程式版本一致）。
- version_id：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_be6a28c1aea08191923a3738bb48a4c9`
- deployment_id：`appgdep_6aede976e7288191b804831060c01b83`
- 結果：`succeeded`，2026-11-06 22:51（Asia/Taipei）。
- 後續純文件 commit 回填證據，不改變實際部署來源。

### 先前部署：1.7.0

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

1.8.0 小卡重做、build、完整 52 個回歸個案與 diff 檢查、GitHub 同步及部署完成。沒有未完成的本輪程式工作。原參考 HTML 已跨引擎匯入、日夜／桌機／手機檢視、ZIP 驗證；實體 Safari 26.0.1 仍待確認。下一輪中斷時用實際狀態取代本段，並同步 STATUS：

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
