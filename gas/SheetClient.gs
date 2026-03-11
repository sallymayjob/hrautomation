/* global SpreadsheetApp, Config */
/**
 * @fileoverview Spreadsheet data access helpers.
 */

var COL = {
  ONBOARDING: {
    EMPLOYEE_ID: 1,
    FULL_NAME: 2,
    EMAIL: 3,
    START_DATE: 4,
    MANAGER_EMAIL: 5,
    MANAGER_NAME: 6,
    DEPARTMENT: 7,
    ROLE_TITLE: 8,
    LOCATION: 9,
    CHECKLIST_HASH: 10,
    LAST_UPDATED_AT: 11,
    STATUS: 12
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

SheetClient.prototype.getOnboardingRows = function () {
  var sheet = this.getSheet_(Config.getOnboardingSheetName());
  return this.getDataRows_(sheet);
};

SheetClient.prototype.findOnboardingByEmployeeId = function (employeeId) {
  var sheet = this.getSheet_(Config.getOnboardingSheetName());
  var rowIndex = this.findRowIndexByValue_(sheet, COL.ONBOARDING.EMPLOYEE_ID, employeeId);
  if (rowIndex < 0) {
    return null;
  }
  return { rowIndex: rowIndex, values: sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0] };
};

SheetClient.prototype.appendOnboardingRow = function (rowValues) {
  var sheet = this.getSheet_(Config.getOnboardingSheetName());
  var existing = this.findRowIndexByValue_(sheet, COL.ONBOARDING.EMPLOYEE_ID, rowValues[COL.ONBOARDING.EMPLOYEE_ID - 1]);
  if (existing > -1) {
    this.writeRow_(sheet, existing, rowValues);
    return existing;
  }
  return this.appendRow_(sheet, rowValues);
};

SheetClient.prototype.upsertOnboardingRow = function (employeeId, rowValues) {
  var sheet = this.getSheet_(Config.getOnboardingSheetName());
  var rowIndex = this.findRowIndexByValue_(sheet, COL.ONBOARDING.EMPLOYEE_ID, employeeId);
  if (rowIndex < 0) {
    return this.appendRow_(sheet, rowValues);
  }
  this.writeRow_(sheet, rowIndex, rowValues);
  return rowIndex;
};

SheetClient.prototype.updateOnboardingStatus = function (employeeId, status) {
  var sheet = this.getSheet_(Config.getOnboardingSheetName());
  var rowIndex = this.findRowIndexByValue_(sheet, COL.ONBOARDING.EMPLOYEE_ID, employeeId);
  if (rowIndex < 0) {
    return false;
  }
  sheet.getRange(rowIndex, COL.ONBOARDING.STATUS).setValue(status);
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
