---
document_type: project-status
project: paper-between
status: active
stage: implementation
owner: alvis9315
source_of_truth: true
updated: 2026-11-06
tags:
  - notebook
  - reading
  - vue
---

# 頁白｜目前進度

目前原始碼版本 **1.7.1**。進度正本是本檔；詳盡接續資訊見 [docs/HANDOFF.md](docs/HANDOFF.md)，完成項目的版本歷史見 [CHANGELOG.md](CHANGELOG.md)。

## 最後完成

- 修正固定座標 Word 被當成段落拆散：支援原頁圖文、字型、分頁與文字層；一般 Word 仍可編輯，不支援的浮動版面明確引導 PDF。
- 已取得實際兩組 PDF／DOCX，Chrome／WebKit 對照匯入均維持考題 22 頁、總複習 14 頁，檢視第一頁原貌；私人教材未提交。
- 保存定位、官方競品、黏著度與驗證建議到 [docs/PRODUCT-STRATEGY.md](docs/PRODUCT-STRATEGY.md)；Word 修正／限制見 [docs/WORD-IMPORT.md](docs/WORD-IMPORT.md)。
- 手機修正版 1.6.2 已先部署，含搜尋、工具列、PDF 繪圖／文字層分離、書架緊湊排列。
- 新增獨立考前小卡、主題／搜尋相關卡組、結果跳轉、滑動、編輯、來源建卡與 ZIP 保存。
- PDF「圖文重排」第一階段，可保留圖解、重排／校正正文與主題，另建筆記再建小卡；原 PDF 保留。
- 修正 WebKit 媒體 Blob 寫入失敗，以位元組保存、相容舊資料；補上原檔遺失的常駐還原引導。

## 正在進行

1.7.1 修正、build、46 個跨引擎執行個案與 diff 檢查已完成；正在同步 GitHub 並部署既有 Site。

## 下一個明確動作

重新匯入兩份 Word 驗證新原頁閱讀（舊碎段落筆記沒有原 Word，無法自動還原，不自行覆蓋）。由使用者確認 Safari 26.0.1 實機匯入；後續再按實際回饋決定重排／小卡擴充，產品策略文件不是已實作清單。

## 最新驗證

2026-11-06：1.7.1 `npm run build`、完整 `npm test` 23 情境 × Chrome／WebKit 共 46 個執行個案及 `git diff --check` 通過。新增合成 Word 原頁／同列文字座標／搜尋／手機／重新整理／ZIP、不支援版面不加入書架、一般 Word 可編輯；既有閱讀、書架、小卡及重排一併回歸。兩組實際 PDF／Word 的 Chrome／WebKit 匯入及第一頁人工對照已完成。

## 已知限制

- [中] 觸控板以瀏覽器 wheel 事件驗證方向、閾值與慣性鎖定，尚未驗證實體 Mac 手感。
- [中] 使用者回報 Safari 26.0.1 從 LINE／iCloud 匯入後 PDF 白頁；現已取得原 PDF／DOCX 並於 Chrome／WebKit 成功匯入，但實機個別根因與結果仍待確認。
- [中] 尚未用實體手機與 Safari 驗證；Chrome 的手機尺寸與觸控模擬不等於實機驗收。
- [中] 筆記只保存在瀏覽器；GitHub 不含個人 PDF／筆記。不同網址、瀏覽器或裝置要用書架 ZIP 搬移。
- [低] PDF 掃描頁尚無 OCR，PDF 原文不可直接改寫；其餘匯入與備份限制見 README。
- [中] 固定座標 Word 只支援經驗證的原頁結構，不是完整 Word 排版引擎；不支援時引導 PDF，不再直接攤平。原頁閱讀不直接修改原 Word。

## Site 部署紀錄

- 網址：https://paper-between-alvis9315.javacj02004.chatgpt.site
- project_id：`appgprj_6aed516760108191a427a46f6b0e34a7`

### 最新：1.7.0

- 原始碼版本：1.7.0；Sites 版本：13。
- 部署來源 commit：`b18629450e37a81c20260ca66737ba7b573dd337`（與本輪 GitHub 程式版本一致）。
- version_id：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_007b131bb3e88191a581dbc9f6e9695d`
- deployment_id：`appgdep_6aede06855708191a8bc591e3dbf1d2c`
- 結果：`succeeded`，2026-11-06 22:13（Asia/Taipei）。
- 後續純文件 commit 回填證據，不改變實際部署來源。

### 歷史：1.6.2

- 原始碼版本：1.6.2；Sites 版本：12。
- 部署來源 commit：`04f165be0c41b691b92d20012ee756605e54496c`。
- version_id：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_1eda1d2f48b08191962374e80fe83a90`
- deployment_id：`appgdep_6aedd85244548191a6757ea1d01fec72`
- 結果：`succeeded`，2026-11-06 21:38（Asia/Taipei）。
- 後續文件 commit 回填證據，不改變實際部署來源。

### 歷史：1.6.1

- 原始碼版本：1.6.1；Sites 版本：11。
- 部署來源 commit：`45469fe9aa776c3f84ae46512a3acfb34509ae4b`（與本輪 GitHub 程式版本一致）。
- version_id：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_4c79f488ce8881918e463d106381c7d8`
- deployment_id：`appgdep_6aedd2cd1c7881919b3fcf362fdc2757`
- 結果：`succeeded`，2026-11-06 21:15（Asia/Taipei）。
- 部署後的純文件 commit 只回填紀錄，真正部署程式以上述來源 commit 為準。

### 歷史：1.6.0

- 原始碼版本：1.6.0；Sites 版本：10。
- 部署來源 commit：`c293e4a21fa72c0566f6d6f33c99be515eb83e20`（與本輪 GitHub 程式版本一致）。
- version_id：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_6c65d56c12d8819195831629dd79df85`
- deployment_id：`appgdep_6aedd0ddfbc8819199877ed47d4c51f1`
- 結果：`succeeded`，2026-11-06 21:06（Asia/Taipei）。
- 部署後的純文件 commit 只回填紀錄，真正部署程式以上述來源 commit 為準。

### 歷史：1.5.1

- 原始碼版本：1.5.1；Sites 版本：9。
- 部署來源 commit：`282fe63ef00d9ac22868218efd601cd57a74c4c8`。
- version_id：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_f857e59b9e80819192b53a1b684483ce`
- deployment_id：`appgdep_6aedca537e8c81918b11f1aafc601580`
- 結果：`succeeded`，2026-11-06 20:38（Asia/Taipei）。
- 本次紀錄回填為純文件變更，實際部署程式仍以上述來源 commit 為準。

### 歷史：1.5.0

- 原始碼版本：1.5.0；Sites 版本：8。
- 部署來源 commit：`3b45fdcc6584613f9ed506203302a88167bb014e`（GitHub 與 Sites 來源一致）。
- version_id：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_e348a48bb41481919c821ac771e48c57`
- deployment_id：`appgdep_6aedc59f7dfc8191a5a6aabeece34bb6`
- 結果：`succeeded`，2026-11-06 20:18（Asia/Taipei）。
- 第一次發布曾回傳服務暫時無法使用；使用同一個 saved version 重試後成功，未另建 Site 或改變 public 權限。
- 本紀錄的後續文件 commit 只回填發布證據，沒有變更已部署的程式。
