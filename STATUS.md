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

目前原始碼版本 **1.5.0**。進度正本是本檔；詳盡接續資訊見 [docs/HANDOFF.md](docs/HANDOFF.md)，完成項目的版本歷史見 [CHANGELOG.md](CHANGELOG.md)。

## 最後完成

- 閱讀頁固定頂部圖示工具列、接近滿版書本、不整頁捲動；搜尋、跳頁、首末頁與放大逐頁閱讀完成。
- 書架邊距對齊頂部列；卡片／條列切換與偏好保存完成；「我的書架」與「回到閱讀」行為分開。
- 夜間炭灰背景與淺色版共用可可棕主色／書封；書封 hover 及減少動態效果支援完成。
- 補齊版本、進度、交接及 agent 入口，測試程式隨 repo 保存，支援換機接續。

## 正在進行

1.5.0 已部署至既有 Site，平台回傳 succeeded。之後每輪優化完成、驗證通過後直接部署的規則已加入 AGENTS；目前等待使用者的下一個優化回饋。

## 下一個明確動作

1. 換機後照交接文件 clone／pull、`npm ci`，閱讀本檔與 `docs/HANDOFF.md`。
2. 以 `npm run dev -- --port 4112 --strictPort` 開啟本機版；需要原有筆記時，從舊瀏覽器匯出書架 ZIP，再匯入新網址／裝置。
3. 由使用者確認新版閱讀空間、夜間配色、卡片／條列與拿書動畫的實際觀感，再依具體回饋修改。

## 最新驗證

2026-11-06：`npm run build`（含 TypeScript）與 `npm test` 共 5 個瀏覽器情境通過；涵蓋尺寸適配、搜尋／跳頁、PDF 放大逐頁閱讀、觸控／閱讀位置、書架操作、兩種顯示方式及日夜主色一致性。具體測試入口與限制見交接文件。

## 已知限制

- [中] 尚未用實體手機與 Safari 驗證；Chrome 的手機尺寸與觸控模擬不等於實機驗收。
- [中] 筆記只保存在瀏覽器；GitHub 不含個人 PDF／筆記。不同網址、瀏覽器或裝置要用書架 ZIP 搬移。
- [低] PDF 掃描頁尚無 OCR，PDF 原文不可直接改寫；其餘匯入與備份限制見 README。

## Site 部署紀錄

- 網址：https://paper-between-alvis9315.javacj02004.chatgpt.site
- project_id：`appgprj_6aed516760108191a427a46f6b0e34a7`
- 原始碼版本：1.5.0；Sites 版本：8。
- 部署來源 commit：`3b45fdcc6584613f9ed506203302a88167bb014e`（GitHub 與 Sites 來源一致）。
- version_id：`appgprj_6aed516760108191a427a46f6b0e34a7~appgver_e348a48bb41481919c821ac771e48c57`
- deployment_id：`appgdep_6aedc59f7dfc8191a5a6aabeece34bb6`
- 結果：`succeeded`，2026-11-06 20:18（Asia/Taipei）。
- 第一次發布曾回傳服務暫時無法使用；使用同一個 saved version 重試後成功，未另建 Site 或改變 public 權限。
- 本紀錄的後續文件 commit 只回填發布證據，沒有變更已部署的程式。
