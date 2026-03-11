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
    TASK_NAME: 4,
    OWNER_TEAM: 5,
    OWNER_SLACK_ID: 6,
    STATUS: 7,
    DUE_DATE: 8,
    COMPLETED_AT: 9,
    COMPLETED_BY: 10,
    NOTES: 11,
    EVENT_HASH: 12
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

SheetClient.prototype.openSpreadsheet_ = function () {
  return SpreadsheetApp.openById(Config.getSpreadsheetId());
};

SheetClient.prototype.getSheet_ = function (name) {
  var sheet = this.openSpreadsheet_().getSheetByName(name);
  if (!sheet) {
    throw new Error('Sheet not found: ' + name);
  }
  return sheet;
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
  var spreadsheet = this.openSpreadsheet_();
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
  var sheet = this.getSheet_(sheetName);
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
  var sheet = this.getSheet_(Config.getOnboardingSheetName());
  return this.getDataRows_(sheet);
};

SheetClient.prototype.findOnboardingByEmployeeId = function (employeeId) {
  var sheet = this.getSheet_(Config.getOnboardingSheetName());
  var idColumn = this.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
  var rowIndex = this.findRowIndexByValue_(sheet, idColumn, employeeId);
  if (rowIndex < 0) {
    return null;
  }
  return { rowIndex: rowIndex, values: sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0] };
};

SheetClient.prototype.appendOnboardingRow = function (rowValues) {
  var sheet = this.getSheet_(Config.getOnboardingSheetName());
  var idColumn = this.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
  var existing = this.findRowIndexByValue_(sheet, idColumn, rowValues[idColumn - 1]);
  if (existing > -1) {
    this.writeRow_(sheet, existing, rowValues);
    return existing;
  }
  return this.appendRow_(sheet, rowValues);
};

SheetClient.prototype.upsertOnboardingRow = function (employeeId, rowValues) {
  var sheet = this.getSheet_(Config.getOnboardingSheetName());
  var idColumn = this.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
  var rowIndex = this.findRowIndexByValue_(sheet, idColumn, employeeId);
  if (rowIndex < 0) {
    return this.appendRow_(sheet, rowValues);
  }
  this.writeRow_(sheet, rowIndex, rowValues);
  return rowIndex;
};

SheetClient.prototype.updateOnboardingStatus = function (employeeId, status) {
  var sheet = this.getSheet_(Config.getOnboardingSheetName());
  var idColumn = this.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
  var statusColumn = this.getColumnIndexByHeaderKey_(sheet, 'status', true);
  var rowIndex = this.findRowIndexByValue_(sheet, idColumn, employeeId);
  if (rowIndex < 0) {
    return false;
  }
  sheet.getRange(rowIndex, statusColumn).setValue(status);
  return true;
};

SheetClient.prototype.getTrainingRows = function () {
  var sheet = this.getSheet_(Config.getTrainingSheetName());
  return this.getDataRows_(sheet);
};

SheetClient.prototype.findTrainingByEmployeeAndModule = function (employeeId, moduleCode) {
  var sheet = this.getSheet_(Config.getTrainingSheetName());
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
  var sheet = this.getSheet_(Config.getTrainingSheetName());
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
  var sheet = this.getSheet_(Config.getTrainingSheetName());
  var rowIndex = this.findRowIndexByValues_(sheet, COL.TRAINING.EMPLOYEE_ID, employeeId, COL.TRAINING.MODULE_CODE, moduleCode);
  if (rowIndex < 0) {
    return this.appendRow_(sheet, rowValues);
  }
  this.writeRow_(sheet, rowIndex, rowValues);
  return rowIndex;
};

SheetClient.prototype.updateTrainingStatus = function (employeeId, moduleCode, status) {
  var sheet = this.getSheet_(Config.getTrainingSheetName());
  var rowIndex = this.findRowIndexByValues_(sheet, COL.TRAINING.EMPLOYEE_ID, employeeId, COL.TRAINING.MODULE_CODE, moduleCode);
  if (rowIndex < 0) {
    return false;
  }
  sheet.getRange(rowIndex, COL.TRAINING.TRAINING_STATUS).setValue(status);
  return true;
};

SheetClient.prototype.markCelebrationPosted = function (employeeId, moduleCode, posted) {
  var sheet = this.getSheet_(Config.getTrainingSheetName());
  var rowIndex = this.findRowIndexByValues_(sheet, COL.TRAINING.EMPLOYEE_ID, employeeId, COL.TRAINING.MODULE_CODE, moduleCode);
  if (rowIndex < 0) {
    return false;
  }
  sheet.getRange(rowIndex, COL.TRAINING.CELEBRATION_POSTED).setValue(Boolean(posted));
  return true;
};

SheetClient.prototype.getChecklistRows = function () {
  var sheet = this.getSheet_(Config.getChecklistSheetName());
  return this.getDataRows_(sheet);
};

SheetClient.prototype.findChecklistTask = function (taskId, onboardingId) {
  var sheet = this.getSheet_(Config.getChecklistSheetName());
  var rowIndex = this.findRowIndexByValues_(sheet, COL.CHECKLIST.TASK_ID, taskId, COL.CHECKLIST.ONBOARDING_ID, onboardingId);
  if (rowIndex < 0) {
    return null;
  }
  return { rowIndex: rowIndex, values: sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0] };
};

SheetClient.prototype.appendChecklistTask = function (rowValues) {
  var sheet = this.getSheet_(Config.getChecklistSheetName());
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
  var sheet = this.getSheet_(Config.getChecklistSheetName());
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

SheetClient.prototype.getAuditRows = function () {
  var sheet = this.getSheet_(Config.getAuditSheetName());
  return this.getDataRows_(sheet);
};

SheetClient.prototype.appendAuditRow = function (rowValues) {
  var sheet = this.getSheet_(Config.getAuditSheetName());
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
  var sheet = this.getSheet_(Config.getAuditSheetName());
  var rowIndex = this.findRowIndexByValue_(sheet, COL.AUDIT.EVENT_HASH, eventHash);
  if (rowIndex > -1) {
    return rowIndex;
  }
  return this.appendRow_(sheet, rowValues);
};

if (typeof module !== 'undefined') module.exports = { SheetClient: SheetClient, COL: COL };
