# 可見控制元件盤點

2026-11-06，1.7.0。使用者要求：可見元件不要出現瀏覽器預設的粗糙外觀，尤其是縮放選單。

| 位置 | 原本狀態 | 現在實作 |
|---|---|---|
| 放大閱讀縮放 | 系統 select／option，選項選單隨 OS 改變 | `ChoiceSelect`，適中／150%／200%／300%，主題化選項 |
| 重點範圍、重點篩選、每筆摘錄分類 | 3 處原生 select | 同一個 ChoiceSelect |
| 圖文編輯器版型 | 原生 select | ChoiceSelect，左圖右文／上圖下文 |
| 貼上文字的放置方式與格式辨識 | 原生 radio／checkbox 外觀 | 保留原生鍵盤／表單語意，以 appearance 與主題樣式繪製選取狀態 |
| 文件提醒 | details／summary 預設標記 | DisclosurePanel，明確箭頭與 aria-expanded |
| 放大鏡、圖文刪除提示 | 原生 title 提示 | IconAction，移入／鍵盤聚焦時顯示中文浮層 |
| 載入進度 | 依瀏覽器畫出的 progress | 主題色軌道與進度，含 WebKit／Firefox 樣式 |
| 對話框、文字輸入區與按鈕 | 已有完整應用程式樣式 | 保留語意化 dialog／input／textarea／button，不以 div 破壞焦點與無障礙操作 |
| Word／PDF／圖片／備份選檔 | 隱藏 file input，由設計過的按鈕觸發 | 保留 OS 選檔視窗；畫面不顯示預設 file input |

## 共用選單行為

觸發按鈕以 combobox／aria-expanded／aria-activedescendant 呈現，選項以 listbox／option 呈現。方向鍵、Home／End、Enter／Space、輸入前綴、Esc 與 Tab 可操作；點擊外部關閉。Esc 先關選單，再按才關上層閱讀彈窗。

選項使用完全自訂樣式的 Popover top layer 與 Floating UI 定位，因此可越過閱讀彈窗或圖文編輯器的 overflow 邊界。此處使用瀏覽器的焦點與圖層能力，不使用 OS 原生下拉外觀；無新增 UI 套件。

## 閱讀控制修正

翻頁箭頭在桌機完整位於封面之外，窄螢幕改放頁腳頁碼兩旁；背景只在 hover／focus-visible 出現。書頁 footer 只將頁碼置中，放大操作獨立靠右；已移除會將第二個 span 撐到頁碼上方的舊規則。第一／最後一頁 SVG 的垂直中心已修正。

放大閱讀工具列採等寬左右欄與中央導覽：左縮放、中間前後頁／頁數、右關閉；手機維持同一結構，避免因左右元件寬度不同使頁數偏移。

## 驗證入口

`npm run build`、`npm test`。新增 `tests/controls.spec.ts` 驗證控制元件、彈窗選單、鍵盤、版型切換、提醒展開及 320／390／1440px 工具列定位；原有閱讀／書架測試一起回歸。

Chrome 是目前測試瀏覽器；實體手機與 Safari 仍待實機確認。

## 1.6.0 書架與彈窗

- `ModalShell`：閱讀指南與備份引導採 dialog top layer，標題／關閉鈕固定，內容限高捲動；遮罩與焦點由瀏覽器管理，外觀完全主題化。
- `ChoiceSelect`：書架每頁 6／12／24 本選單；不使用 OS 原生選單。
- `CollectionPagination`：超過每頁本數才顯示，含首末頁、前後頁、精簡頁數與輸入跳頁；篩選／每頁數變更重置，資料縮減自動夾頁。
- 星號沿用 `IconAction`，以填色與 aria-pressed 表達收藏；卡片／條列包含邊界的間距一致。
- `trackScrollActivity` 在 capture 階段監聽所有捲動容器，750ms 無新捲動即隱藏 thumb；不以 hover 顯示。全站 CSS 同時涵蓋標準 scrollbar-color 與 WebKit thumb。
- 頂部書架工具只在 hover／focus-visible 上可可棕底，搜尋欄保有邊框及焦點提示。

1.6.1：閱讀器左右間距 2.55vw（至少 40px 保護書外按鈕）；窄螢幕 10px。紙頁左右留白減半，正文量測與實際頁共用 `--paper-inline`。檢查按鈕完整在視窗內，且與封面／正文／頁碼／放大鏡無交疊。

## 1.6.2 手機與 Safari

手機頂部保留搜尋，其他操作收進 Popover 選單，選單以文字呈現；桌機保留可見工具。搜尋依 visualViewport 與 dvh 的較小高度限制，所有手機文字輸入至少 16px，保留 pinch zoom。ChoiceSelect 開啟時明確 focus，兼容 Safari 點按按鈕不自動聚焦的行為。

PDF 繪製與文字層分離，序列化同畫布取消／重繪，使用相容版核心與 worker、手機較低畫素預算；錯誤區有診斷、重試與原檔預覽。使用 WebKit 自動化補測，但不能當作原始兩份 PDF 在實體 Safari 26.0.1 的重現證據。

## 1.7.0 小卡與重排

- 小卡單張卡面、內部捲動，搜尋與主題按鈕留在上方；手機標籤橫向滑動，結果清單用 ModalShell，箭頭與卡面可滑動。
- 卡片建立／編輯／刪除確認、來源建立、重排都用主題化 ModalShell。來源／模板／欄位選擇用 ChoiceSelect；圖解比例尺明確設計 WebKit／Firefox 軌道與圓形把手。
- 重排是可校正預覽，不把內部解析器／信心分數塞進閱讀介面。保留原貌、另建筆記。
- 圖片／原檔缺失有持續的重試／備份還原引導；PDF 畫圖與選字層各自處理，原檔預覽由使用者點選。
