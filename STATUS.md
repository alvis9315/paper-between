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

目前原始碼版本 **1.6.2**。進度正本是本檔；詳盡接續資訊見 [docs/HANDOFF.md](docs/HANDOFF.md)，完成項目的版本歷史見 [CHANGELOG.md](CHANGELOG.md)。

## 最後完成

- 本輪：閱讀器左右間距及書頁內留白減半；桌機翻頁按鈕與封面分離，窄螢幕改頁腳導覽，避免壓正文／放大鏡。
- 保留 1.6.0 的收藏、分頁、指南限高、活動捲軸與備份引導。
- `docs/DOCUMENT-REFLOW.md` 記錄 PDF／Word 現況、範例處理、逐區塊辨識及分頁策略；PDF 智慧重排尚未實作。

## 正在進行

先完成手機搜尋、PDF 顯示與工具列問題，再實作 PDF 重排第一階段與獨立考前小卡。1.6.2 已通過建置與 28 個 Chrome／WebKit 執行個案，已部署成功，開始重排與小卡。

## 下一個明確動作

完成 Chrome／WebKit 回歸與建置，部署 1.6.2 後，開始圖解＋正文重排與小卡。小卡採單卡檢視、主題標籤＋全文搜尋篩選相關卡組、結果清單與前後切換。

## 最新驗證

先前 12 情境為歷史基準。本輪新增 WebKit 引擎及 2 個情境，完整 28 個執行個案已通過；不等同實體 iOS 26.0.1 驗收。

## 已知限制

- [中] 觸控板以瀏覽器 wheel 事件驗證方向、閾值與慣性鎖定，尚未驗證實體 Mac 手感。
- [中] 使用者回報 Safari 26.0.1 從 LINE／iCloud 匯入後 PDF 白頁，未取得原始兩份 PDF；已修繪製／文字層與加入診斷，但個別根因仍未確認。
- [中] 尚未用實體手機與 Safari 驗證；Chrome 的手機尺寸與觸控模擬不等於實機驗收。
- [中] 筆記只保存在瀏覽器；GitHub 不含個人 PDF／筆記。不同網址、瀏覽器或裝置要用書架 ZIP 搬移。
- [低] PDF 掃描頁尚無 OCR，PDF 原文不可直接改寫；其餘匯入與備份限制見 README。

## Site 部署紀錄

- 網址：https://paper-between-alvis9315.javacj02004.chatgpt.site
- project_id：`appgprj_6aed516760108191a427a46f6b0e34a7`

### 最新：1.6.2

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
