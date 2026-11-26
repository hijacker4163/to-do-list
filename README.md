# 雲端待辦清單 (To-Do & Calendar App)

一個質感現代、輕量且支援 **GitHub Pages** 靜態託管的待辦事項網頁應用。
參考 [TimeHelper](file:///Users/marslin/Documents/GitHub/TimeHelper) 的 Google Apps Script 架構，支援 **Google 試算表（Google Sheets）作為免費雲端資料庫**，同時支援瀏覽器本機離線儲存（LocalStorage）。

---

## ✨ 核心特色與功能規劃

1. **左側：待辦事項清單管理**
   - 快速新增待辦事項，支援設定**目標日期、時間、分類標籤（工作/個人/生活/學習/緊急）與優先度**。
   - 互動勾選核對框，一鍵切換完成狀態。
   - 頁籤快速篩選（全部 / 待處理 / 已完成），以及一鍵清除已完成項目。
   - 支援單筆事項刪除。

2. **右側：月曆 (Monthly Calendar) 與統計**
   - 智慧月曆檢視：當天以醒目框線標示，每個日期下方具備「狀態指示燈」（藍點：有待辦事項；綠點：當日事項全數完成）。
   - 點擊日曆日期即可一鍵篩選出該日期的所有待辦事項。
   - 視覺化完成率進度條與分類統計（工作、個人、生活、緊急）。

3. **雙模態儲存 (Hybrid Storage)**
   - **本機模式**：無需任何後端設定，開箱即用，所有操作直接儲存於瀏覽器 LocalStorage。
   - **Google 試算表雲端同步**：參考 `TimeHelper` 架構，透過 Google Apps Script (GAS) Web App API 進行即時雲端讀寫，跨裝置存取不遺失。

---

## 🚀 部署至 GitHub Pages 步驟

1. **推送到 GitHub**：
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit for to-do-list app"
   git branch -M main
   git remote add origin <您的 GitHub 儲存庫網址>
   git push -u origin main
   ```
2. **開啟 GitHub Pages**：
   - 進入您的 GitHub 倉庫 -> **Settings** -> **Pages**。
   - 在 **Branch** 選擇 `main` 分支，資料夾選擇 `/ (root)`，點擊 **Save**。
   - 稍候 1~2 分鐘即可由 GitHub 提供之專屬網址瀏覽！

---

## ☁️ Google 試算表資料庫設定教學 (GAS)

若您希望在多裝置或手機電腦間雙向同步：

1. 開啟 [Google 試算表](https://sheets.google.com)，新建一個空白試算表。
2. 點選頂端選單 **擴充功能 ➔ Apps Script**。
3. 清空編輯器預設程式碼，將專案中的 [`gas_backend.js`](file:///Users/marslin/Documents/GitHub/to-do-list/gas_backend.js) 內容完整複製貼入並存檔。
4. 點選右上角 **部署 ➔ 新增部署作業**：
   - 種類選擇：**網頁應用程式 (Web App)**
   - 說明：可填寫 `To-Do API`
   - 誰可以存取：選擇 **任何人 (Anyone)** *(重要，確保前端能正常存取)*
5. 點擊「部署」，授權 Google 帳號後複製產生的 **網頁應用程式網址 (Web App URL)**。
6. 打開您的待辦事項網頁，點選右上角「**雲端資料庫設定**」，貼上該網址並儲存即可完成雙向連動！
