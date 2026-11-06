# 頁白｜接手與中斷紀錄

最後更新：2026-11-06（Asia/Taipei）。原始碼版本：**1.5.0**。遠端：<https://github.com/alvis9315/paper-between>，分支：`main`。

## 目前接續位置

兩輪閱讀／書架優化及本次文件建立已完成，等待使用者實際觀感回饋。先讀 `../AGENTS.md`、`../STATUS.md` 與 `../CHANGELOG.md`；不要回到 clone 時的 1.4.2 重新做一遍。

最新使用者要求：補版本更新及突然中斷時的紀錄，連同程式保存到 GitHub，讓新電腦可接續。除文件外，前兩輪尚未 push 的程式與 5 個合成資料測試也應包含在同一輪同步中。

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
| 書架卡片／條列、hover、搜尋、書卡操作 | `src/components/Bookshelf.vue` |
| 圖示中文浮動標籤 | `src/components/IconAction.vue` |
| 日夜色票、主題保存 | `src/theme.css`、`src/core/theme.ts` |
| 分頁、位置、儲存、備份格式 | `src/core/pagination.ts`、`navigation.ts`、`storage.ts`、`backupBundle.ts` |

最新決策：日夜共用可可棕 `#88634f` 與書封，夜間使用炭灰；書架頂部「我的書架」是位置標示；卡片／條列切換在搜尋旁。閱讀頁文字說明集中到指南／資訊，不增加常駐上下區塊。

## 最新驗證證據

2026-11-06，`npm run build` 與以下 5 個 Playwright 案例通過：

- `tests/reader.spec.ts`：文字閱讀跨 7 種尺寸的完整容納與零整頁捲動，搜尋、跳頁輸入與首末頁、文字放大逐頁閱讀。
- 同檔：合成 6 頁 PDF 的完整顯示、放大捲動與逐頁切換、關閉回到對應位置、手機單頁。
- 同檔：觸控工具列、滑動翻頁、重點面板不擠壓書本、重整後閱讀位置與夜間偏好。
- `tests/shelf.spec.ts`：位置標示、卡片／條列保存、搜尋、重新命名、複製、回收與還原、進出閱讀及重新整理。
- 同檔：兩模式主色／書封相同、hover、減少動態效果、手機無橫向溢出。

測試資料直接在獨立瀏覽器 IndexedDB 建立。若修改測試初始化，先等初始空白書架載入完成，再寫入合成資料，避免和舊格式遷移流程競爭造成假失敗。截圖與報告位於忽略的 `test-results/`，換機請重跑產生。

以上不是實體手機／Safari 或使用者觀感驗收；尚未補做這些項目。建置會依主機平台更新 `public/third-party-notices.txt` 的可選相依授權；無相依變更時檢查並排除無關平台差異。

## 突然做到一半時，更新這一節

目前沒有未完成的程式修改；下次中斷時以實況取代本句，並同步 STATUS。可使用下面格式，未知就寫「未確認」，不得留成看似完成：

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
