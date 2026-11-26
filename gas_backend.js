/**
 * Google Apps Script 後端程式碼 (Google 試算表待辦事項資料庫 + LINE Bot 智慧主動推播)
 * 
 * ====================================================================
 * ⚙️ 【安全性設計：金鑰與環境變數 (防 GitHub 外洩)】
 * ====================================================================
 * 本程式碼優先由 Google 雲端的「指令碼屬性 (Script Properties)」讀取金鑰。
 * 本地檔案完全「留空」，推送到 GitHub 也不會有任何金鑰洩漏風險！
 * 
 * 💡 如何在 Google 雲端設定金鑰（只需設定一次）：
 * 1. 進入 Google Apps Script，點擊左側 ⚙️「專案設定」
 * 2. 往下滑找到「指令碼屬性」-> 點擊「新增指令碼屬性」：
 *    - 屬性：LINE_CHANNEL_ACCESS_TOKEN，值：[您的 LINE Access Token]
 *    - 屬性：LINE_USER_ID，值：[您的 LINE User ID]
 * 3. 點擊「儲存指令碼屬性」即完成！
 */

var scriptProperties = PropertiesService.getScriptProperties();
var LINE_CHANNEL_ACCESS_TOKEN = scriptProperties.getProperty("LINE_CHANNEL_ACCESS_TOKEN") || "";
var LINE_USER_ID = scriptProperties.getProperty("LINE_USER_ID") || "";

/**
 * ====================================================================
 * 🚀 【排程與 LINE 測試工具函式】
 * ====================================================================
 */

// 【重要！初次解鎖外部網路連線權限函式】
// 請在頂端函式選單選擇「authorizeExternalRequest」並點擊「執行」一次以解鎖權限
function authorizeExternalRequest() {
  UrlFetchApp.fetch("https://api.line.me");
}

// 【測試函式 1】：測試 LINE Bot 是否能成功發送訊息到手機
function testSendLine() {
  sendLineMessage("📋【雲端待辦清單】LINE Bot 連線測試成功！🎉\n恭喜您已順利完成雲端推播設定！");
}

// 【設定函式 2】：一鍵建立每分鐘自動於 Google 背景檢查到期待辦的排程
function setupAutoNotifyTrigger() {
  // 清除舊有的排程避免重複
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var func = triggers[i].getHandlerFunction();
    if (func === 'checkDueTodosAndNotify' || func === 'sendDailyMorningDigest') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // 1. 每分鐘背景到期檢查
  ScriptApp.newTrigger('checkDueTodosAndNotify')
    .timeBased()
    .everyMinutes(1)
    .create();

  // 2. 每天早上 08:30 晨間待辦清單智慧整理推播
  ScriptApp.newTrigger('sendDailyMorningDigest')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .create();

  Logger.log("✅ 成功建立每分鐘到期檢查與每天早晨 08:30 待辦提醒排程！");
}

/**
 * ====================================================================
 * ⏰ 【背景定時觸發器 1】：每分鐘檢查是否有指定時間的待辦到期
 * ====================================================================
 */
function checkDueTodosAndNotify() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    initSheetHeader(sheet);
    var rawData = sheet.getDataRange().getValues();
    var displayData = sheet.getDataRange().getDisplayValues();
    if (rawData.length <= 1) return;

    var now = new Date();
    var todayStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
    var currentHour = now.getHours();
    var currentMin = now.getMinutes();
    var currentTimeMinutes = currentHour * 60 + currentMin;

    for (var i = 1; i < rawData.length; i++) {
      var isCompleted = Boolean(rawData[i][4]);
      if (isCompleted) continue; // 已完成的事項不提醒

      var targetDate = String(displayData[i][2] || rawData[i][2] || '').trim();
      var targetTime = String(displayData[i][3] || rawData[i][3] || '').trim();
      var notified = Boolean(rawData[i][11]); // 第 12 欄為已推播

      // 檢查是否為今天且有設定時間
      if (targetDate === todayStr && targetTime && !notified) {
        var timeParts = targetTime.split(':');
        if (timeParts.length >= 2) {
          var dueMinutes = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);
          
          // 到期判斷：當前分鐘數 >= 預定時間分鐘數
          if (currentTimeMinutes >= dueMinutes) {
            var title = String(displayData[i][1] || rawData[i][1] || '').trim();
            var priority = String(rawData[i][5] || 'medium');
            var category = String(rawData[i][6] || '個人');
            var isDaily = Boolean(rawData[i][9]);

            var pText = priority === 'high' ? '🔴 高優先' : (priority === 'low' ? '🟢 低' : '🟡 普通');
            
            var msg = "⏰【待辦提醒時間到了！】\n" +
                      "📌 事項：" + title + "\n" +
                      "⏰ 預定時間：" + targetTime + "\n" +
                      "🏷️ 分類：" + category + " (" + pText + ")" +
                      (isDaily ? "\n🔁 類型：每日例行習慣" : "");
            
            sendLineMessage(msg);
            // 標記試算表第 12 欄 (已推播) 為 TRUE
            sheet.getRange(i + 1, 12).setValue(true);
          }
        }
      }
    }
  } catch (err) {
    Logger.log("checkDueTodosAndNotify 錯誤: " + err.toString());
  } finally {
    lock.releaseLock();
  }
}

/**
 * ====================================================================
 * 🌅 【背景定時觸發器 2】：每天早晨自動推播今日待辦摘要
 * ====================================================================
 */
function sendDailyMorningDigest() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    initSheetHeader(sheet);
    var rawData = sheet.getDataRange().getValues();
    var displayData = sheet.getDataRange().getDisplayValues();
    if (rawData.length <= 1) return;

    var now = new Date();
    var todayStr = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");

    var todayPending = [];
    var dailyPending = [];

    for (var i = 1; i < rawData.length; i++) {
      var isCompleted = Boolean(rawData[i][4]);
      if (isCompleted) continue;

      var title = String(displayData[i][1] || rawData[i][1] || '').trim();
      var targetDate = String(displayData[i][2] || rawData[i][2] || '').trim();
      var targetTime = String(displayData[i][3] || rawData[i][3] || '').trim();
      var isDaily = Boolean(rawData[i][9]);

      var timeText = targetTime ? " [" + targetTime + "]" : "";
      if (targetDate === todayStr) {
        todayPending.push("• " + title + timeText);
      } else if (isDaily) {
        dailyPending.push("• 🔁 " + title + timeText);
      }
    }

    if (todayPending.length > 0 || dailyPending.length > 0) {
      var msg = "☀️【早安！今日待辦事項清單】\n📅 日期：" + todayStr + "\n\n";
      if (todayPending.length > 0) {
        msg += "📌 今日重點事項：\n" + todayPending.join("\n") + "\n\n";
      }
      if (dailyPending.length > 0) {
        msg += "🌱 每日例行習慣：\n" + dailyPending.join("\n") + "\n\n";
      }
      msg += "💪 祝您今天事事順利、效率滿滿！";
      sendLineMessage(msg);
    }
  } catch (err) {
    Logger.log("sendDailyMorningDigest 錯誤: " + err.toString());
  }
}

/**
 * 透過 LINE Messaging API 發送 Push Message
 */
function sendLineMessage(text) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    Logger.log("⚠️ 尚未設定 LINE_CHANNEL_ACCESS_TOKEN");
    return;
  }
  if (!LINE_USER_ID) {
    Logger.log("⚠️ 尚未設定 LINE_USER_ID");
    return;
  }
  
  var url = 'https://api.line.me/v2/bot/message/push';
  var payload = {
    to: LINE_USER_ID,
    messages: [{
      type: 'text',
      text: text
    }]
  };
  
  var options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + LINE_CHANNEL_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    var res = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    if (code === 200) {
      Logger.log("✅ LINE 訊息推播成功！");
    } else {
      Logger.log("❌ LINE 發送失敗 (" + code + "): " + res.getContentText());
    }
  } catch (e) {
    Logger.log("發送 LINE 請求異常: " + e.toString());
  }
}

/**
 * ====================================================================
 * 🌐 【Web App 請求處理】：前端讀寫 API
 * ====================================================================
 */
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var params = e ? e.parameter : {};
    var action = params ? params.action : null;
    var postData = null;
    
    // 解析 POST 內容 (支援 JSON 與 text/plain)
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
        if (!action && postData.action) {
          action = postData.action;
        }
      } catch (parseErr) {}
    }

    initSheetHeader(sheet);
    var rawData = sheet.getDataRange().getValues();
    var displayData = sheet.getDataRange().getDisplayValues();
    var startIdx = 1; // 第一列為標題
    
    // 動作 1：取得所有待辦項目 (GET 或 action=get)
    if (!action || action === 'get') {
      if (rawData.length <= 1) {
        return jsonResponse({ status: 'success', data: [] });
      }
      
      var todos = [];
      for (var i = startIdx; i < rawData.length; i++) {
        var row = rawData[i];
        var disp = displayData[i] || [];
        if (!row[0] && row[0] !== 0) continue;

        todos.push({
          id: String(row[0]),
          title: String(disp[1] || row[1] || ''),
          date: String(disp[2] || row[2] || ''),
          time: String(disp[3] || row[3] || ''),
          completed: Boolean(row[4]),
          priority: String(row[5] || 'medium'),
          category: String(row[6] || '個人'),
          note: String(disp[7] || row[7] || ''),
          createdAt: Number(row[8]) || 0,
          isDaily: Boolean(row[9]),
          lastCompletedDate: String(disp[10] || row[10] || ''),
          notified: Boolean(row[11])
        });
      }
      return jsonResponse({ status: 'success', data: todos });
    }
    
    // 動作 2：新增待辦項目 (action=add)
    if (action === 'add') {
      var item = postData && postData.data ? postData.data : JSON.parse(params.data || '{}');
      sheet.appendRow([
        "'" + item.id,
        item.title || '',
        "'" + (item.date || ''),
        "'" + (item.time || ''),
        Boolean(item.completed),
        item.priority || 'medium',
        item.category || '個人',
        item.note || '',
        item.createdAt || Date.now(),
        Boolean(item.isDaily),
        "'" + (item.lastCompletedDate || ''),
        false // notified
      ]);
      return jsonResponse({ status: 'success', data: item });
    }

    // 動作 3：更新待辦項目 (action=update)
    if (action === 'update') {
      var updateItem = postData && postData.data ? postData.data : JSON.parse(params.data || '{}');
      var targetId = String(updateItem.id || params.id || '').trim();
      var foundRow = -1;

      for (var i = startIdx; i < rawData.length; i++) {
        if (String(rawData[i][0]).trim() === targetId) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow !== -1) {
        if (updateItem.title !== undefined) sheet.getRange(foundRow, 2).setValue(updateItem.title);
        if (updateItem.date !== undefined) sheet.getRange(foundRow, 3).setValue("'" + updateItem.date);
        if (updateItem.time !== undefined) {
          sheet.getRange(foundRow, 4).setValue("'" + updateItem.time);
          sheet.getRange(foundRow, 12).setValue(false); // 時間有改過時，重新允許推播
        }
        if (updateItem.completed !== undefined) sheet.getRange(foundRow, 5).setValue(Boolean(updateItem.completed));
        if (updateItem.priority !== undefined) sheet.getRange(foundRow, 6).setValue(updateItem.priority);
        if (updateItem.category !== undefined) sheet.getRange(foundRow, 7).setValue(updateItem.category);
        if (updateItem.note !== undefined) sheet.getRange(foundRow, 8).setValue(updateItem.note);
        if (updateItem.isDaily !== undefined) sheet.getRange(foundRow, 10).setValue(Boolean(updateItem.isDaily));
        if (updateItem.lastCompletedDate !== undefined) sheet.getRange(foundRow, 11).setValue("'" + updateItem.lastCompletedDate);
        return jsonResponse({ status: 'success', data: updateItem });
      }
      return jsonResponse({ status: 'error', message: '找不到對應的待辦事項' });
    }

    // 動作 4：切換勾選狀態 (action=toggle)
    if (action === 'toggle') {
      var targetId = String((postData && postData.id) || params.id || '').trim();
      var reqLastCompletedDate = (postData && postData.lastCompletedDate) || params.lastCompletedDate || '';
      for (var i = startIdx; i < rawData.length; i++) {
        if (String(rawData[i][0]).trim() === targetId) {
          var current = Boolean(rawData[i][4]);
          var nextVal = !current;
          sheet.getRange(i + 1, 5).setValue(nextVal);
          if (reqLastCompletedDate) {
            sheet.getRange(i + 1, 11).setValue("'" + reqLastCompletedDate);
          }
          return jsonResponse({ status: 'success', id: targetId, completed: nextVal });
        }
      }
      return jsonResponse({ status: 'error', message: '找不到對應的待辦事項' });
    }
    
    // 動作 5：刪除單筆 (action=delete)
    if (action === 'delete') {
      var targetId = String((postData && postData.id) || params.id || '').trim();
      var deleted = false;
      for (var i = rawData.length - 1; i >= startIdx; i--) {
        if (String(rawData[i][0]).trim() === targetId) {
          sheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }
      return jsonResponse({ status: 'success', deleted: deleted, deleted_id: targetId });
    }

    // 動作 6：清空已完成項目 (action=clear_completed)
    if (action === 'clear_completed') {
      var count = 0;
      for (var i = rawData.length - 1; i >= startIdx; i--) {
        var isDaily = Boolean(rawData[i][9]);
        if (Boolean(rawData[i][4]) && !isDaily) {
          sheet.deleteRow(i + 1);
          count++;
        }
      }
      return jsonResponse({ status: 'success', clearedCount: count });
    }

    // 動作 7：觸發背景檢查 (action=check_due)
    if (action === 'check_due') {
      checkDueTodosAndNotify();
      return jsonResponse({ status: 'success' });
    }
    
    return jsonResponse({ status: 'error', message: '未知的指令 action: ' + action });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * 初始化試算表表頭（如果不存在）
 */
function initSheetHeader(sheet) {
  var range = sheet.getDataRange();
  if (range.getLastRow() === 0) {
    sheet.appendRow([
      'ID (識別碼)',
      '事項名稱',
      '目標日期 (YYYY-MM-DD)',
      '時間 (HH:mm)',
      '已完成 (TRUE/FALSE)',
      '優先度 (high/medium/low)',
      '分類標籤',
      '備註說明',
      '建立時間戳記',
      '是否每日循環 (TRUE/FALSE)',
      '最後完成日期 (YYYY-MM-DD)',
      '已LINE推播 (TRUE/FALSE)'
    ]);
    sheet.getRange("1:1").setFontWeight("bold").setBackground("#e2e8f0");
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
