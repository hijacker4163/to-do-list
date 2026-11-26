/**
 * Google Apps Script 後端程式碼 (Google 試算表待辦事項資料庫 + 支援每日循環與編輯)
 * 
 * 部署步驟：
 * 1. 建立一個全新的 Google 試算表 (Google Sheets)
 * 2. 點選「擴充功能」->「Apps Script」
 * 3. 貼上此程式碼
 * 4. 點選右上角「部署」->「管理部署作業」或「新增部署作業」
 *    - 種類選擇：「網頁應用程式 (Web App)」
 *    - 執行身分：我 (您的帳號)
 *    - 誰可以存取：任何人 (Anyone)
 * 5. 複製產生的「網頁應用程式網址」，貼回待辦清單前端的「雲端同步設定」中！
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
          lastCompletedDate: String(disp[10] || row[10] || '')
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
        "'" + (item.lastCompletedDate || '')
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
        if (updateItem.time !== undefined) sheet.getRange(foundRow, 4).setValue("'" + updateItem.time);
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
        // 如果是每日循環，不隨意整列刪除，僅清除一般完成事項
        var isDaily = Boolean(rawData[i][9]);
        if (Boolean(rawData[i][4]) && !isDaily) {
          sheet.deleteRow(i + 1);
          count++;
        }
      }
      return jsonResponse({ status: 'success', clearedCount: count });
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
      '最後完成日期 (YYYY-MM-DD)'
    ]);
    sheet.getRange("1:1").setFontWeight("bold").setBackground("#e2e8f0");
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
