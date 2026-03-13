/* global Config, COL, LockService */
/** @fileoverview Training data repository. */

var TrainingRepoBindings_ = null;
if (typeof module !== 'undefined') {
  TrainingRepoBindings_ = require('./SheetClient.gs');
}
function trainingCol_() {
  if (typeof COL !== 'undefined' && COL) return COL;
  if (TrainingRepoBindings_ && TrainingRepoBindings_.COL) return TrainingRepoBindings_.COL;
  return { TRAINING: { EMPLOYEE_ID: 1, MODULE_CODE: 2, TRAINING_STATUS: 7, REMINDER_COUNT: 9, LAST_REMINDER_AT: 10, LAST_UPDATED_AT: 11, CELEBRATION_POSTED: 13 } };
}

function TrainingRepository(sheetClient) {
  this.sheetClient = sheetClient;
}

TrainingRepository.prototype.withWriteLock_ = function (operation) {
  if (typeof LockService === 'undefined' || !LockService || typeof LockService.getDocumentLock !== 'function') return operation();
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try { return operation(); } finally { lock.releaseLock(); }
};

TrainingRepository.prototype.getRows = function () {
  if (this.sheetClient.getDataRows_ && this.sheetClient.getTrainingSheet_) return this.sheetClient.getDataRows_(this.sheetClient.getTrainingSheet_());
  return this.sheetClient.getTrainingRows ? this.sheetClient.getTrainingRows() : [];
};

TrainingRepository.prototype.findByEmployeeAndModule = function (employeeId, moduleCode) {
  if (!this.sheetClient.getTrainingSheet_ || !this.sheetClient.findRowIndexByValues_) {
    return this.sheetClient.findTrainingByEmployeeAndModule ? this.sheetClient.findTrainingByEmployeeAndModule(employeeId, moduleCode) : null;
  }
  var c = trainingCol_();
  var sheet = this.sheetClient.getTrainingSheet_();
  var rowIndex = this.sheetClient.findRowIndexByValues_(sheet, c.TRAINING.EMPLOYEE_ID, employeeId, c.TRAINING.MODULE_CODE, moduleCode);
  if (rowIndex < 0) return null;
  return { rowIndex: rowIndex, values: sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0] };
};

TrainingRepository.prototype.appendAssignment = function (rowValues) {
  var self = this;
  return this.withWriteLock_(function () {
    if (!self.sheetClient.getTrainingSheet_ || !self.sheetClient.findRowIndexByValues_) return self.sheetClient.appendTrainingRow(rowValues);
    var c = trainingCol_();
    return self.sheetClient.safeWrite_(Config.getTrainingSheetName(), function () {
      var sheet = self.sheetClient.getTrainingSheet_();
      var existing = self.sheetClient.findRowIndexByValues_(sheet, c.TRAINING.EMPLOYEE_ID, rowValues[c.TRAINING.EMPLOYEE_ID - 1], c.TRAINING.MODULE_CODE, rowValues[c.TRAINING.MODULE_CODE - 1]);
      if (existing > -1) {
        self.sheetClient.writeRow_(sheet, existing, rowValues);
        return existing;
      }
      return self.sheetClient.appendRow_(sheet, rowValues);
    }, { operation: 'appendTrainingRow' });
  });
};

TrainingRepository.prototype.upsertRow = function (employeeId, moduleCode, rowValues) {
  var self = this;
  return this.withWriteLock_(function () {
    if (!self.sheetClient.getTrainingSheet_ || !self.sheetClient.findRowIndexByValues_) return self.sheetClient.upsertTrainingRow(employeeId, moduleCode, rowValues);
    var c = trainingCol_();
    return self.sheetClient.safeWrite_(Config.getTrainingSheetName(), function () {
      var sheet = self.sheetClient.getTrainingSheet_();
      var rowIndex = self.sheetClient.findRowIndexByValues_(sheet, c.TRAINING.EMPLOYEE_ID, employeeId, c.TRAINING.MODULE_CODE, moduleCode);
      if (rowIndex < 0) return self.sheetClient.appendRow_(sheet, rowValues);
      self.sheetClient.writeRow_(sheet, rowIndex, rowValues);
      return rowIndex;
    }, { operation: 'upsertTrainingRow', employeeId: employeeId, moduleCode: moduleCode });
  });
};

TrainingRepository.prototype.updateStatus = function (employeeId, moduleCode, status) {
  var self = this;
  return this.withWriteLock_(function () {
    if (!self.sheetClient.getTrainingSheet_ || !self.sheetClient.findRowIndexByValues_) return self.sheetClient.updateTrainingStatus(employeeId, moduleCode, status);
    var c = trainingCol_();
    return self.sheetClient.safeWrite_(Config.getTrainingSheetName(), function () {
      var sheet = self.sheetClient.getTrainingSheet_();
      var rowIndex = self.sheetClient.findRowIndexByValues_(sheet, c.TRAINING.EMPLOYEE_ID, employeeId, c.TRAINING.MODULE_CODE, moduleCode);
      if (rowIndex < 0) return false;
      sheet.getRange(rowIndex, c.TRAINING.TRAINING_STATUS).setValue(status);
      return true;
    }, { operation: 'updateTrainingStatus', employeeId: employeeId, moduleCode: moduleCode });
  });
};

TrainingRepository.prototype.updateReminderMetadata = function (employeeId, moduleCode, reminderCount, lastReminderAt) {
  var self = this;
  return this.withWriteLock_(function () {
    if (!self.sheetClient.getTrainingSheet_ || !self.sheetClient.findRowIndexByValues_) return self.sheetClient.updateTrainingReminderMetadata(employeeId, moduleCode, reminderCount, lastReminderAt);
    var c = trainingCol_();
    var sheet = self.sheetClient.getTrainingSheet_();
    var rowIndex = self.sheetClient.findRowIndexByValues_(sheet, c.TRAINING.EMPLOYEE_ID, employeeId, c.TRAINING.MODULE_CODE, moduleCode);
    if (rowIndex < 0) return false;
    sheet.getRange(rowIndex, c.TRAINING.REMINDER_COUNT).setValue(Number(reminderCount || 0));
    sheet.getRange(rowIndex, c.TRAINING.LAST_REMINDER_AT).setValue(lastReminderAt || new Date());
    return true;
  });
};

TrainingRepository.prototype.updateRecognitionMetadata = function (employeeId, moduleCode, celebrationPosted, lastUpdatedAt) {
  var self = this;
  return this.withWriteLock_(function () {
    if (!self.sheetClient.getTrainingSheet_ || !self.sheetClient.findRowIndexByValues_) return self.sheetClient.updateTrainingRecognitionMetadata(employeeId, moduleCode, celebrationPosted, lastUpdatedAt);
    var c = trainingCol_();
    var sheet = self.sheetClient.getTrainingSheet_();
    var rowIndex = self.sheetClient.findRowIndexByValues_(sheet, c.TRAINING.EMPLOYEE_ID, employeeId, c.TRAINING.MODULE_CODE, moduleCode);
    if (rowIndex < 0) return false;
    sheet.getRange(rowIndex, c.TRAINING.CELEBRATION_POSTED).setValue(Boolean(celebrationPosted));
    if (c.TRAINING.LAST_UPDATED_AT) sheet.getRange(rowIndex, c.TRAINING.LAST_UPDATED_AT).setValue(lastUpdatedAt || new Date());
    return true;
  });
};

if (typeof module !== 'undefined') module.exports = { TrainingRepository: TrainingRepository };
