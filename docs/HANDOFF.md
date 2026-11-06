# 頁白｜接手與中斷紀錄

最後更新：2026-11-06（Asia/Taipei）。原始碼版本：**1.6.1**。遠端：<https://github.com/alvis9315/paper-between>，分支：`main`。

## 目前接續位置

1.6.1：修正按鈕跨書框、減半閱讀器與紙頁內左右間距。桌機完整書外導覽，窄螢幕使用頁腳頁碼兩旁。`src/style.css` 同時調整量測頁與實際頁；`tests/controls.spec.ts` 增加 2868／1440／1024／820／819／390／320px 不重疊驗證。build、完整 12 個情境及 diff 檢查通過，正在同步 GitHub／部署，成功前以實際部署紀錄為準。

PDF／Word 的新需求先做技術評估，尚未實作語意重排。詳見 [文件重排評估](DOCUMENT-REFLOW.md)：保留原貌＋可校正區塊，圖解保持群組，正文用可讀字級重排，超高續頁，低信心退回原貌。若後續實作，先取得原始 PDF／DOCX 驗證圖像／文字／向量成分，不能只憑截圖承諾效果。

## 每輪部署方式與目前狀態

先看 AGENTS 的「每輪完成後直接部署」規則。GitHub 與 Sites 的來源倉庫是兩個同步目的地；推 GitHub 之後仍要透過 Sites 技能的 source helper 同步並打包，使用既有 project_id，不重新建站。

- 線上網址：https://paper-between-alvis9315.javacj02004.chatgpt.site
- project_id：`appgprj_6aed516760108191a427a46f6b0e34a7`
- 現有存取範圍：public；保留既有範圍，不自行改權限。

### 最新部署：1.6.0

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

1.6.1 已驗證（build／12 個情境／diff），正在同步 GitHub／部署；程式入口與下一步見本文件頂部。實體 Mac 觸控板手感、Safari 與實體手機仍待使用者確認。下一輪中斷時以實況取代本段，並同步 STATUS。可使用下面格式，未知就寫「未確認」，不得留成看似完成：

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
