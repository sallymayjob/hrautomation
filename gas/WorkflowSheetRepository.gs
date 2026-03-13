/* global */
/**
 * @fileoverview Repository for sheet mutations used by workflow wrappers.
 */

function WorkflowSheetRepository(spreadsheet) {
  this.spreadsheet = spreadsheet;
}

WorkflowSheetRepository.prototype.getSheet = function (sheetName) {
  return this.spreadsheet.getSheetByName(sheetName);
};

WorkflowSheetRepository.prototype.getOrCreateSheet = function (sheetName) {
  var sheet = this.getSheet(sheetName);
  if (!sheet && this.spreadsheet && typeof this.spreadsheet.insertSheet === 'function') {
    sheet = this.spreadsheet.insertSheet(sheetName);
  }
  return sheet;
};

WorkflowSheetRepository.prototype.appendRow = function (sheetName, values) {
  var sheet = this.getOrCreateSheet(sheetName);
  if (!sheet || typeof sheet.appendRow !== 'function') {
    return;
  }
  sheet.appendRow(values);
};

WorkflowSheetRepository.prototype.getLastRow = function (sheetName) {
  var sheet = this.getOrCreateSheet(sheetName);
  if (!sheet || typeof sheet.getLastRow !== 'function') {
    return 0;
  }
  return Number(sheet.getLastRow() || 0);
};

WorkflowSheetRepository.prototype.clearSheet = function (sheetName) {
  var sheet = this.getOrCreateSheet(sheetName);
  if (!sheet || typeof sheet.clear !== 'function') {
    return;
  }
  sheet.clear();
};

WorkflowSheetRepository.prototype.setCellValue = function (sheet, rowNumber, columnNumber, value) {
  if (!sheet || typeof sheet.getRange !== 'function') {
    return;
  }
  sheet.getRange(rowNumber, columnNumber).setValue(value);
};

if (typeof module !== 'undefined') module.exports = {
  WorkflowSheetRepository: WorkflowSheetRepository
};
