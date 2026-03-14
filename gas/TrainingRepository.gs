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

TrainingRepository.prototype.prepareRowMutation = function (sheet, rowIndex, requiredColumns) {
  var headerMap = this.sheetClient.getHeaderMap_(sheet);
  var required = requiredColumns || [];
  for (var i = 0; i < required.length; i += 1) {
    if (!headerMap[required[i]]) {
      throw new Error('Required column not found on sheet "' + sheet.getName() + '": ' + required[i]);
    }
  }
  return {
    sheet: sheet,
    rowIndex: rowIndex,
    headerMap: headerMap,
    values: sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0],
    touched: false
  };
};

TrainingRepository.prototype.setMutationValue_ = function (mutation, key, value) {
  var col = mutation.headerMap[key];
  if (!col) return;
  mutation.values[col - 1] = value;
  mutation.touched = true;
};

TrainingRepository.prototype.commitRowMutation = function (mutation) {
  if (!mutation || !mutation.touched) return;
  mutation.sheet.getRange(mutation.rowIndex, 1, 1, mutation.values.length).setValues([mutation.values]);
};

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
      var mutation = self.prepareRowMutation(sheet, rowIndex, ['training_status']);
      self.setMutationValue_(mutation, 'training_status', status);
      self.commitRowMutation(mutation);
      return true;
    }, { operation: 'updateTrainingStatus', employeeId: employeeId, moduleCode: moduleCode });
  });
};

TrainingRepository.prototype.updateReminderMetadata = function (employeeId, moduleCode, reminderCount, lastReminderAt) {
  var self = this;
  return this.withWriteLock_(function () {
    if (!self.sheetClient.getTrainingSheet_ || !self.sheetClient.findRowIndexByValues_) return self.sheetClient.updateTrainingReminderMetadata(employeeId, moduleCode, reminderCount, lastReminderAt);
    return self.sheetClient.safeWrite_(Config.getTrainingSheetName(), function () {
      var c = trainingCol_();
      var sheet = self.sheetClient.getTrainingSheet_();
      var rowIndex = self.sheetClient.findRowIndexByValues_(sheet, c.TRAINING.EMPLOYEE_ID, employeeId, c.TRAINING.MODULE_CODE, moduleCode);
      if (rowIndex < 0) return false;
      var mutation = self.prepareRowMutation(sheet, rowIndex, ['reminder_count', 'last_reminder_at']);
      self.setMutationValue_(mutation, 'reminder_count', Number(reminderCount || 0));
      self.setMutationValue_(mutation, 'last_reminder_at', lastReminderAt || new Date());
      self.commitRowMutation(mutation);
      return true;
    }, { operation: 'updateTrainingReminderMetadata', employeeId: employeeId, moduleCode: moduleCode });
  });
};

TrainingRepository.prototype.updateRecognitionMetadata = function (employeeId, moduleCode, celebrationPosted, lastUpdatedAt) {
  var self = this;
  return this.withWriteLock_(function () {
    if (!self.sheetClient.getTrainingSheet_ || !self.sheetClient.findRowIndexByValues_) return self.sheetClient.updateTrainingRecognitionMetadata(employeeId, moduleCode, celebrationPosted, lastUpdatedAt);
    return self.sheetClient.safeWrite_(Config.getTrainingSheetName(), function () {
      var c = trainingCol_();
      var sheet = self.sheetClient.getTrainingSheet_();
      var rowIndex = self.sheetClient.findRowIndexByValues_(sheet, c.TRAINING.EMPLOYEE_ID, employeeId, c.TRAINING.MODULE_CODE, moduleCode);
      if (rowIndex < 0) return false;
      var mutation = self.prepareRowMutation(sheet, rowIndex, ['celebration_posted']);
      self.setMutationValue_(mutation, 'celebration_posted', Boolean(celebrationPosted));
      self.setMutationValue_(mutation, 'last_updated_at', lastUpdatedAt || new Date());
      self.commitRowMutation(mutation);
      return true;
    }, { operation: 'updateTrainingRecognitionMetadata', employeeId: employeeId, moduleCode: moduleCode });
  });
};

TrainingRepository.prototype.updateReminderMetadataBatch = function (updates) {
  var self = this;
  var items = updates || [];
  if (!items.length) return 0;
  return this.withWriteLock_(function () {
    if (!self.sheetClient.getTrainingSheet_) return 0;
    return self.sheetClient.safeWrite_(Config.getTrainingSheetName(), function () {
      var sheet = self.sheetClient.getTrainingSheet_();
      if (sheet.getLastRow() < 2) return 0;
      var headerMap = self.sheetClient.getHeaderMap_(sheet);
      if (!headerMap.employee_id || !headerMap.module_code || !headerMap.reminder_count || !headerMap.last_reminder_at) return 0;
      var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      var updateMap = {};
      for (var i = 0; i < items.length; i += 1) {
        updateMap[String(items[i].employeeId) + '::' + String(items[i].moduleCode)] = items[i];
      }
      var changed = 0;
      for (var r = 0; r < values.length; r += 1) {
        var key = String(values[r][headerMap.employee_id - 1]) + '::' + String(values[r][headerMap.module_code - 1]);
        var item = updateMap[key];
        if (!item) continue;
        values[r][headerMap.reminder_count - 1] = Number(item.reminderCount || 0);
        values[r][headerMap.last_reminder_at - 1] = item.lastReminderAt || new Date();
        changed += 1;
      }
      if (changed > 0) {
        sheet.getRange(2, 1, values.length, sheet.getLastColumn()).setValues(values);
      }
      return changed;
    }, { operation: 'updateTrainingReminderMetadataBatch', count: items.length });
  });
};

if (typeof module !== 'undefined') module.exports = { TrainingRepository: TrainingRepository };
