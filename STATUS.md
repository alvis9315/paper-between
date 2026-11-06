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

目前原始碼版本 **1.7.0**。進度正本是本檔；詳盡接續資訊見 [docs/HANDOFF.md](docs/HANDOFF.md)，完成項目的版本歷史見 [CHANGELOG.md](CHANGELOG.md)。

## 最後完成

- 手機修正版 1.6.2 已先部署，含搜尋、工具列、PDF 繪圖／文字層分離、書架緊湊排列。
- 新增獨立考前小卡、主題／搜尋相關卡組、結果跳轉、滑動、編輯、來源建卡與 ZIP 保存。
- PDF「圖文重排」第一階段，可保留圖解、重排／校正正文與主題，另建筆記再建小卡；原 PDF 保留。
- 修正 WebKit 媒體 Blob 寫入失敗，以位元組保存、相容舊資料；補上原檔遺失的常駐還原引導。

## 正在進行

1.7.0 build 與 40 個 Chrome／WebKit 執行個案已通過，正在推送與部署。發布成功前，以部署紀錄中的 1.6.2 為線上版。

## 下一個明確動作

推送與部署 1.7.0，回填來源及版本／部署 ID。後續由使用者確認原兩份 PDF 在 Safari 26.0.1 的實際結果。

## 最新驗證

2026-11-06：`npm run build`、完整 `npm test` 20 情境 × Chrome／WebKit 共 40 個執行個案通過；`git diff --check` 通過。涵蓋既有閱讀、手機搜尋、PDF 文字層失敗／快速 resize／媒體恢復、舊 Blob／新位元組、小卡標籤／搜尋／編輯／滑動／大量結果／純小卡 ZIP、圖解重排與含圖小卡重新整理及備份。

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
