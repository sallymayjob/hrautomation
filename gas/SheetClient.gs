/* global SpreadsheetApp, Config */
/**
 * @fileoverview Spreadsheet data access helpers.
 */

var COL = {
  ONBOARDING: {
    ONBOARDING_ID: 1,
    EMPLOYEE_NAME: 2,
    SLACK_ID: 3,
    EMAIL: 4,
    ROLE: 5,
    BRAND: 6,
    START_DATE: 7,
    REGION: 8,
    MANAGER_EMAIL: 9,
    MANAGER_SLACK_ID: 10,
    DOB: 11,
    STATUS: 12,
    DM_SENT_AT: 13,
    CHECKLIST_COMPLETED: 14,
    ROW_HASH: 15,
    BLOCKED_REASON: 16,
    // Backward-compatible aliases.
    EMPLOYEE_ID: 1,
    FULL_NAME: 2,
    ROLE_TITLE: 5
  },
  TRAINING: {
    EMPLOYEE_ID: 1,
    MODULE_CODE: 2,
    MODULE_NAME: 3,
    ASSIGNED_DATE: 4,
    DUE_DATE: 5,
    COMPLETION_DATE: 6,
    TRAINING_STATUS: 7,
    OWNER_EMAIL: 8,
    REMINDER_COUNT: 9,
    LAST_REMINDER_AT: 10,
    LAST_UPDATED_AT: 11,
    COMPLETION_HASH: 12,
    CELEBRATION_POSTED: 13
  },
  CHECKLIST: {
    TASK_ID: 1,
    ONBOARDING_ID: 2,
    CATEGORY: 3,
    PHASE: 4,
    TASK_NAME: 5,
    OWNER_TEAM: 6,
    OWNER_SLACK_ID: 7,
    STATUS: 8,
    DUE_DATE: 9,
    OFFSET_TYPE: 10,
    OFFSET_DAYS: 11,
    CRITICALITY: 12,
    REMINDER_COUNT: 13,
    LAST_REMINDER_AT: 14,
    COMPLETED_AT: 15,
    COMPLETED_BY: 16,
    NOTES: 17,
    EVENT_HASH: 18,
    REQUIRED_FOR_COMPLETION: 19
  },
  AUDIT: {
    AUDIT_ID: 1,
    EVENT_TIMESTAMP: 2,
    ACTOR_EMAIL: 3,
    ENTITY_TYPE: 4,
    ENTITY_ID: 5,
    ACTION: 6,
    DETAILS: 7,
    EVENT_HASH: 8
  }
};

function SheetClient() {}

SheetClient.prototype.normalizeKey_ = function (value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
};

SheetClient.prototype.getHeaderMap_ = function (sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerMap = {};
  for (var i = 0; i < headers.length; i += 1) {
    var key = this.normalizeKey_(headers[i]);
    if (key) {
      headerMap[key] = i + 1;
    }
  }
  return headerMap;
};

SheetClient.prototype.getColumnIndexByHeaderKey_ = function (sheet, headerKey, required) {
  var headerMap = this.getHeaderMap_(sheet);
  var normalizedKey = this.normalizeKey_(headerKey);
  var columnIndex = headerMap[normalizedKey] || -1;
  if (columnIndex < 1 && required) {
    throw new Error('Required column not found on sheet "' + sheet.getName() + '": ' + headerKey);
  }
  return columnIndex;
};

SheetClient.prototype.openSpreadsheetById_ = function (spreadsheetId) {
  return SpreadsheetApp.openById(spreadsheetId);
};

SheetClient.prototype.getSheetFromSpreadsheet_ = function (spreadsheetId, sheetName, propertyLabel) {
  var spreadsheet = this.openSpreadsheetById_(spreadsheetId);
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName + ' (configured by ' + propertyLabel + ')');
  }
  return sheet;
};

SheetClient.prototype.getOnboardingSheet_ = function () {
  return this.getSheetFromSpreadsheet_(Config.getOnboardingSpreadsheetId(), Config.getOnboardingSheetName(), 'ONBOARDING_SHEET_NAME');
};

SheetClient.prototype.getTrainingSheet_ = function () {
  return this.getSheetFromSpreadsheet_(Config.getTrainingSpreadsheetId(), Config.getTrainingSheetName(), 'TRAINING_SHEET_NAME');
};

SheetClient.prototype.getAuditSheet_ = function () {
  return this.getSheetFromSpreadsheet_(Config.getAuditSpreadsheetId(), Config.getAuditSheetName(), 'AUDIT_SHEET_NAME');
};

SheetClient.prototype.getChecklistSheet_ = function () {
  return this.getSheetFromSpreadsheet_(Config.getOnboardingSpreadsheetId(), Config.getChecklistSheetName(), 'CHECKLIST_SHEET_NAME');
};

SheetClient.prototype.resolveSheetByName_ = function (sheetName) {
  if (sheetName === Config.getOnboardingSheetName()) {
    return this.getOnboardingSheet_();
  }
  if (sheetName === Config.getTrainingSheetName()) {
    return this.getTrainingSheet_();
  }
  if (sheetName === Config.getAuditSheetName()) {
    return this.getAuditSheet_();
  }
  if (sheetName === Config.getChecklistSheetName()) {
    return this.getChecklistSheet_();
  }

  return this.getSheetFromSpreadsheet_(Config.getOnboardingSpreadsheetId(), sheetName, 'ONBOARDING_SPREADSHEET_ID');
};


SheetClient.prototype.resolveSpreadsheetIdBySheetName_ = function (sheetName) {
  if (sheetName === Config.getTrainingSheetName()) {
    return Config.getTrainingSpreadsheetId();
  }
  if (sheetName === Config.getAuditSheetName()) {
    return Config.getAuditSpreadsheetId();
  }
  return Config.getOnboardingSpreadsheetId();
};

SheetClient.prototype.getDataRows_ = function (sheet) {
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) {
    return [];
  }
  return sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
};

SheetClient.prototype.findRowIndexByValue_ = function (sheet, column, value) {
  var rows = this.getDataRows_(sheet);
  for (var i = 0; i < rows.length; i += 1) {
    if (rows[i][column - 1] === value) {
      return i + 2;
    }
  }
  return -1;
};

SheetClient.prototype.findRowIndexByValues_ = function (sheet, firstColumn, firstValue, secondColumn, secondValue) {
  var rows = this.getDataRows_(sheet);
  for (var i = 0; i < rows.length; i += 1) {
    if (rows[i][firstColumn - 1] === firstValue && rows[i][secondColumn - 1] === secondValue) {
      return i + 2;
    }
  }
  return -1;
};

SheetClient.prototype.writeRow_ = function (sheet, rowIndex, rowValues) {
  sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
};

SheetClient.prototype.appendRow_ = function (sheet, rowValues) {
  sheet.appendRow(rowValues);
  return sheet.getLastRow();
};

SheetClient.prototype.ensureSheetWithHeaders = function (sheetName, headers) {
  var spreadsheet = this.openSpreadsheetById_(Config.getOnboardingSpreadsheetId());
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return sheet;
  }

  var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (existingHeaders.length !== headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  for (var i = 0; i < headers.length; i += 1) {
    if (this.normalizeKey_(existingHeaders[i]) !== this.normalizeKey_(headers[i])) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      break;
    }
  }
  return sheet;
};

SheetClient.prototype.checkDuplicate = function (sheetName, columnKeyOrIndex, value, excludeRowIndex) {
  var sheet = this.resolveSheetByName_(sheetName);
  var columnIndex = columnKeyOrIndex;

  if (typeof columnKeyOrIndex === 'string') {
    columnIndex = this.getColumnIndexByHeaderKey_(sheet, columnKeyOrIndex, false);
  }

  if (!columnIndex || columnIndex < 1) {
    throw new Error('Invalid duplicate check column: ' + columnKeyOrIndex);
  }

  var rows = this.getDataRows_(sheet);
  for (var row = 0; row < rows.length; row += 1) {
    var rowIndex = row + 2;
    if (excludeRowIndex && rowIndex === excludeRowIndex) {
      continue;
    }
    if (rows[row][columnIndex - 1] === value) {
      return rowIndex;
    }
  }
  return -1;
};

SheetClient.prototype.getOnboardingRows = function () {
  var sheet = this.getOnboardingSheet_();
  return this.getDataRows_(sheet);
};

SheetClient.prototype.findOnboardingByEmployeeId = function (employeeId) {
  var sheet = this.getOnboardingSheet_();
  var idColumn = this.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
  var rowIndex = this.findRowIndexByValue_(sheet, idColumn, employeeId);
  if (rowIndex < 0) {
    return null;
  }
  return { rowIndex: rowIndex, values: sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0] };
};

SheetClient.prototype.appendOnboardingRow = function (rowValues) {
  var sheet = this.getOnboardingSheet_();
  var idColumn = this.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
  var existing = this.findRowIndexByValue_(sheet, idColumn, rowValues[idColumn - 1]);
  if (existing > -1) {
    this.writeRow_(sheet, existing, rowValues);
    return existing;
  }
  return this.appendRow_(sheet, rowValues);
};

SheetClient.prototype.upsertOnboardingRow = function (employeeId, rowValues) {
  var sheet = this.getOnboardingSheet_();
  var idColumn = this.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
  var rowIndex = this.findRowIndexByValue_(sheet, idColumn, employeeId);
  if (rowIndex < 0) {
    return this.appendRow_(sheet, rowValues);
  }
  this.writeRow_(sheet, rowIndex, rowValues);
  return rowIndex;
};

SheetClient.prototype.updateOnboardingStatus = function (employeeId, status) {
  var sheet = this.getOnboardingSheet_();
  var idColumn = this.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
  var statusColumn = this.getColumnIndexByHeaderKey_(sheet, 'status', true);
  var blockedReasonColumn = this.getColumnIndexByHeaderKey_(sheet, 'blocked_reason', false);
  var rowIndex = this.findRowIndexByValue_(sheet, idColumn, employeeId);
  if (rowIndex < 0) {
    return false;
  }

  var nextStatus = String(status || '').trim().toUpperCase();
  if (nextStatus === 'COMPLETE') {
    var gateResult = this.evaluateOnboardingCompletionGate(employeeId);
    if (!gateResult.canComplete) {
      sheet.getRange(rowIndex, statusColumn).setValue('BLOCKED');
      if (blockedReasonColumn > 0) {
        sheet.getRange(rowIndex, blockedReasonColumn).setValue(gateResult.blockedReason);
      }
      return false;
    }
  }

  sheet.getRange(rowIndex, statusColumn).setValue(status);
  if (blockedReasonColumn > 0 && nextStatus !== 'BLOCKED') {
    sheet.getRange(rowIndex, blockedReasonColumn).setValue('');
  }
  return true;
};

SheetClient.prototype.evaluateOnboardingCompletionGate = function (employeeId) {
  var checklist = this.getChecklistSheet_();
  var rows = this.getDataRows_(checklist);
  var blockedByPhase = {};

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    if (String(row[COL.CHECKLIST.ONBOARDING_ID - 1]) !== String(employeeId)) {
      continue;
    }

    var required = row[COL.CHECKLIST.REQUIRED_FOR_COMPLETION - 1];
    var isRequired = required === '' || required === null || typeof required === 'undefined' ? true : Boolean(required);
    if (!isRequired) {
      continue;
    }

    var status = String(row[COL.CHECKLIST.STATUS - 1] || '').trim().toUpperCase();
    if (status === 'COMPLETE' || status === 'DONE') {
      continue;
    }

    var phase = String(row[COL.CHECKLIST.PHASE - 1] || row[COL.CHECKLIST.CATEGORY - 1] || 'Unassigned').trim() || 'Unassigned';
    if (!blockedByPhase[phase]) {
      blockedByPhase[phase] = [];
    }
    blockedByPhase[phase].push(String(row[COL.CHECKLIST.TASK_NAME - 1] || 'Unnamed task'));
  }

  var phases = Object.keys(blockedByPhase);
  if (phases.length === 0) {
    return { canComplete: true, blockedReason: '' };
  }

  var message = phases.map(function (phase) {
    return phase + ': ' + blockedByPhase[phase].join(', ');
  }).join(' | ');

  return {
    canComplete: false,
    blockedReason: 'Cannot mark onboarding COMPLETE. Missing required tasks by phase -> ' + message
  };
};

SheetClient.prototype.getTrainingRows = function () {
  var sheet = this.getTrainingSheet_();
  return this.getDataRows_(sheet);
};

SheetClient.prototype.findTrainingByEmployeeAndModule = function (employeeId, moduleCode) {
  var sheet = this.getTrainingSheet_();
  var rowIndex = this.findRowIndexByValues_(
    sheet,
    COL.TRAINING.EMPLOYEE_ID,
    employeeId,
    COL.TRAINING.MODULE_CODE,
    moduleCode
  );
  if (rowIndex < 0) {
    return null;
  }
  return { rowIndex: rowIndex, values: sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0] };
};

SheetClient.prototype.appendTrainingRow = function (rowValues) {
  var sheet = this.getTrainingSheet_();
  var existing = this.findRowIndexByValues_(
    sheet,
    COL.TRAINING.EMPLOYEE_ID,
    rowValues[COL.TRAINING.EMPLOYEE_ID - 1],
    COL.TRAINING.MODULE_CODE,
    rowValues[COL.TRAINING.MODULE_CODE - 1]
  );
  if (existing > -1) {
    this.writeRow_(sheet, existing, rowValues);
    return existing;
  }
  return this.appendRow_(sheet, rowValues);
};

SheetClient.prototype.upsertTrainingRow = function (employeeId, moduleCode, rowValues) {
  var sheet = this.getTrainingSheet_();
  var rowIndex = this.findRowIndexByValues_(sheet, COL.TRAINING.EMPLOYEE_ID, employeeId, COL.TRAINING.MODULE_CODE, moduleCode);
  if (rowIndex < 0) {
    return this.appendRow_(sheet, rowValues);
  }
  this.writeRow_(sheet, rowIndex, rowValues);
  return rowIndex;
};

SheetClient.prototype.updateTrainingStatus = function (employeeId, moduleCode, status) {
  var sheet = this.getTrainingSheet_();
  var rowIndex = this.findRowIndexByValues_(sheet, COL.TRAINING.EMPLOYEE_ID, employeeId, COL.TRAINING.MODULE_CODE, moduleCode);
  if (rowIndex < 0) {
    return false;
  }
  sheet.getRange(rowIndex, COL.TRAINING.TRAINING_STATUS).setValue(status);
  return true;
};


SheetClient.prototype.updateTrainingReminderMetadata = function (employeeId, moduleCode, reminderCount, lastReminderAt) {
  var sheet = this.getTrainingSheet_();
  var rowIndex = this.findRowIndexByValues_(sheet, COL.TRAINING.EMPLOYEE_ID, employeeId, COL.TRAINING.MODULE_CODE, moduleCode);
  if (rowIndex < 0) {
    return false;
  }
  sheet.getRange(rowIndex, COL.TRAINING.REMINDER_COUNT).setValue(Number(reminderCount || 0));
  sheet.getRange(rowIndex, COL.TRAINING.LAST_REMINDER_AT).setValue(lastReminderAt || new Date());
  return true;
};

SheetClient.prototype.markCelebrationPosted = function (employeeId, moduleCode, posted) {
  var sheet = this.getTrainingSheet_();
  var rowIndex = this.findRowIndexByValues_(sheet, COL.TRAINING.EMPLOYEE_ID, employeeId, COL.TRAINING.MODULE_CODE, moduleCode);
  if (rowIndex < 0) {
    return false;
  }
  sheet.getRange(rowIndex, COL.TRAINING.CELEBRATION_POSTED).setValue(Boolean(posted));
  return true;
};

SheetClient.prototype.getChecklistRows = function () {
  var sheet = this.getChecklistSheet_();
  return this.getDataRows_(sheet);
};

SheetClient.prototype.findChecklistTask = function (taskId, onboardingId) {
  var sheet = this.getChecklistSheet_();
  var rowIndex = this.findRowIndexByValues_(sheet, COL.CHECKLIST.TASK_ID, taskId, COL.CHECKLIST.ONBOARDING_ID, onboardingId);
  if (rowIndex < 0) {
    return null;
  }
  return { rowIndex: rowIndex, values: sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0] };
};

SheetClient.prototype.appendChecklistTask = function (rowValues) {
  var sheet = this.getChecklistSheet_();
  var existing = this.findRowIndexByValues_(
    sheet,
    COL.CHECKLIST.TASK_ID,
    rowValues[COL.CHECKLIST.TASK_ID - 1],
    COL.CHECKLIST.ONBOARDING_ID,
    rowValues[COL.CHECKLIST.ONBOARDING_ID - 1]
  );
  if (existing > -1) {
    this.writeRow_(sheet, existing, rowValues);
    return existing;
  }
  return this.appendRow_(sheet, rowValues);
};

SheetClient.prototype.updateChecklistTask = function (taskId, onboardingId, updates) {
  var sheet = this.getChecklistSheet_();
  var rowIndex = this.findRowIndexByValues_(sheet, COL.CHECKLIST.TASK_ID, taskId, COL.CHECKLIST.ONBOARDING_ID, onboardingId);
  if (rowIndex < 0) {
    return false;
  }

  var headerMap = this.getHeaderMap_(sheet);
  var updateKeys = Object.keys(updates || {});
  for (var i = 0; i < updateKeys.length; i += 1) {
    var key = this.normalizeKey_(updateKeys[i]);
    var columnIndex = headerMap[key];
    if (columnIndex) {
      sheet.getRange(rowIndex, columnIndex).setValue(updates[updateKeys[i]]);
    }
  }

  return true;
};



SheetClient.prototype.updateChecklistReminderMetadata = function (taskId, onboardingId, reminderCount, lastReminderAt) {
  var sheet = this.getChecklistSheet_();
  var rowIndex = this.findRowIndexByValues_(sheet, COL.CHECKLIST.TASK_ID, taskId, COL.CHECKLIST.ONBOARDING_ID, onboardingId);
  if (rowIndex < 0) {
    return false;
  }
  sheet.getRange(rowIndex, COL.CHECKLIST.REMINDER_COUNT).setValue(Number(reminderCount || 0));
  sheet.getRange(rowIndex, COL.CHECKLIST.LAST_REMINDER_AT).setValue(lastReminderAt || new Date());
  return true;
};

SheetClient.prototype.getSheetRowLink = function (sheetName, rowIndex) {
  var sheet = this.resolveSheetByName_(sheetName);
  var spreadsheetId = this.resolveSpreadsheetIdBySheetName_(sheetName);
  return 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit#gid=' + sheet.getSheetId() + '&range=A' + rowIndex;
};

SheetClient.prototype.getAuditRows = function () {
  var sheet = this.getAuditSheet_();
  return this.getDataRows_(sheet);
};

SheetClient.prototype.appendAuditRow = function (rowValues) {
  var sheet = this.getAuditSheet_();
  var auditId = rowValues[COL.AUDIT.AUDIT_ID - 1];
  if (auditId) {
    var existing = this.findRowIndexByValue_(sheet, COL.AUDIT.AUDIT_ID, auditId);
    if (existing > -1) {
      this.writeRow_(sheet, existing, rowValues);
      return existing;
    }
  }
  return this.appendRow_(sheet, rowValues);
};

SheetClient.prototype.appendAuditIfNotExists = function (eventHash, rowValues) {
  var sheet = this.getAuditSheet_();
  var rowIndex = this.findRowIndexByValue_(sheet, COL.AUDIT.EVENT_HASH, eventHash);
  if (rowIndex > -1) {
    return rowIndex;
  }
  return this.appendRow_(sheet, rowValues);
};

if (typeof module !== 'undefined') module.exports = { SheetClient: SheetClient, COL: COL };
