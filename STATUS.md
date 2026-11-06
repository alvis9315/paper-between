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

目前原始碼版本 **1.6.0**。進度正本是本檔；詳盡接續資訊見 [docs/HANDOFF.md](docs/HANDOFF.md)，完成項目的版本歷史見 [CHANGELOG.md](CHANGELOG.md)。

## 最後完成

- 閱讀指南限高、內容可捲動，位於頂部列之上；全站捲軸只在捲動時顯示。
- 移除頂部重複書架入口，點「頁白」回首頁；書架工具列 hover 才顯示可可棕，搜尋有獨立框線。
- 新增每頁 6／12／24 本、分頁／跳頁，以及我的最愛與星號；收藏支援儲存、回收還原、ZIP／JSON 備份。
- 卡片操作等距、觸控板橫向翻頁、備份匯入引導與格式錯誤彈窗。

## 正在進行

1.6.0 已完成建置與 12 個瀏覽器情境，正在同步 GitHub 並發布；成功前，線上版本仍以部署紀錄為準。

## 下一個明確動作

推送 GitHub 並部署既有 Site；成功後回填來源 commit 與版本／部署 ID。

## 最新驗證

2026-11-06：`npm run build`、完整 `npm test` 12 個情境與 `git diff --check` 通過。涵蓋指南跨尺寸與捲軸活動、書架 6／12／24 分頁與刪除夾頁、收藏儲存與回收還原、ZIP／舊版 JSON、錯誤格式彈窗、320px 觸控操作不裁切，以及觸控板方向／慣性鎖定；原有文字／PDF／主題／控制元件一起回歸。

## 已知限制

- [中] 觸控板以瀏覽器 wheel 事件驗證方向、閾值與慣性鎖定，尚未驗證實體 Mac 手感。
- [中] 尚未用實體手機與 Safari 驗證；Chrome 的手機尺寸與觸控模擬不等於實機驗收。
- [中] 筆記只保存在瀏覽器；GitHub 不含個人 PDF／筆記。不同網址、瀏覽器或裝置要用書架 ZIP 搬移。
- [低] PDF 掃描頁尚無 OCR，PDF 原文不可直接改寫；其餘匯入與備份限制見 README。

## Site 部署紀錄

- 網址：https://paper-between-alvis9315.javacj02004.chatgpt.site
- project_id：`appgprj_6aed516760108191a427a46f6b0e34a7`

### 最新：1.5.1

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
