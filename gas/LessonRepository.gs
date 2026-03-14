/* global COL, LockService, Config */
/** @fileoverview Checklist/Lesson repository. */
var LessonRepoBindings_ = null;
if (typeof module !== 'undefined') LessonRepoBindings_ = require('./SheetClient.gs');
function lessonCol_() {
  if (typeof COL !== 'undefined' && COL) return COL;
  if (LessonRepoBindings_ && LessonRepoBindings_.COL) return LessonRepoBindings_.COL;
  return { CHECKLIST: { TASK_ID: 1, ONBOARDING_ID: 2, STATUS: 7, UPDATED_AT: 9, UPDATED_BY: 10, NOTES: 11 } };
}

function LessonRepository(sheetClient) { this.sheetClient = sheetClient; }
LessonRepository.prototype.prepareRowMutation = function (sheet, rowIndex, requiredColumns) {
  var headerMap = this.sheetClient.getHeaderMap_(sheet);
  var required = requiredColumns || [];
  for (var i = 0; i < required.length; i += 1) {
    if (!headerMap[required[i]]) throw new Error('Required column not found on sheet "' + sheet.getName() + '": ' + required[i]);
  }
  return { sheet: sheet, rowIndex: rowIndex, headerMap: headerMap, values: sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0], touched: false };
};
LessonRepository.prototype.setMutationValue_ = function (mutation, key, value) {
  var col = mutation.headerMap[key];
  if (!col) return;
  mutation.values[col - 1] = value;
  mutation.touched = true;
};
LessonRepository.prototype.commitRowMutation = function (mutation) {
  if (!mutation || !mutation.touched) return;
  mutation.sheet.getRange(mutation.rowIndex, 1, 1, mutation.values.length).setValues([mutation.values]);
};
LessonRepository.prototype.withWriteLock_ = function (operation) {
  if (typeof LockService === 'undefined' || !LockService || typeof LockService.getDocumentLock !== 'function') return operation();
  var lock = LockService.getDocumentLock(); lock.waitLock(30000); try { return operation(); } finally { lock.releaseLock(); }
};
LessonRepository.prototype.getRows = function () {
  if (this.sheetClient.getDataRows_ && this.sheetClient.getChecklistSheet_) return this.sheetClient.getDataRows_(this.sheetClient.getChecklistSheet_());
  return this.sheetClient.getChecklistRows ? this.sheetClient.getChecklistRows() : [];
};
LessonRepository.prototype.findTask = function (taskId, onboardingId) {
  if (!this.sheetClient.getChecklistSheet_ || !this.sheetClient.findRowIndexByValues_) return this.sheetClient.findChecklistTask ? this.sheetClient.findChecklistTask(taskId, onboardingId) : null;
  var c = lessonCol_(); var sheet = this.sheetClient.getChecklistSheet_();
  var rowIndex = this.sheetClient.findRowIndexByValues_(sheet, c.CHECKLIST.TASK_ID, taskId, c.CHECKLIST.ONBOARDING_ID, onboardingId);
  if (rowIndex < 0) return null;
  return { rowIndex: rowIndex, values: sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0] };
};
LessonRepository.prototype.appendTask = function (rowValues) {
  var self = this;
  return this.withWriteLock_(function () {
    if (!self.sheetClient.getChecklistSheet_ || !self.sheetClient.findRowIndexByValues_) return self.sheetClient.appendChecklistTask(rowValues);
    var c = lessonCol_(); var sheet = self.sheetClient.getChecklistSheet_();
    var existing = self.sheetClient.findRowIndexByValues_(sheet, c.CHECKLIST.TASK_ID, rowValues[c.CHECKLIST.TASK_ID - 1], c.CHECKLIST.ONBOARDING_ID, rowValues[c.CHECKLIST.ONBOARDING_ID - 1]);
    if (existing > -1) {
      var existingValues = sheet.getRange(existing, 1, 1, sheet.getLastColumn()).getValues()[0];
      rowValues[c.CHECKLIST.STATUS - 1] = existingValues[c.CHECKLIST.STATUS - 1];
      rowValues[c.CHECKLIST.UPDATED_AT - 1] = existingValues[c.CHECKLIST.UPDATED_AT - 1];
      rowValues[c.CHECKLIST.UPDATED_BY - 1] = existingValues[c.CHECKLIST.UPDATED_BY - 1];
      rowValues[c.CHECKLIST.NOTES - 1] = existingValues[c.CHECKLIST.NOTES - 1];
      self.sheetClient.writeRow_(sheet, existing, rowValues);
      return existing;
    }
    return self.sheetClient.appendRow_(sheet, rowValues);
  });
};
LessonRepository.prototype.updateTask = function (taskId, onboardingId, updates) {
  var self = this;
  return this.withWriteLock_(function () {
    if (!self.sheetClient.getChecklistSheet_ || !self.sheetClient.findRowIndexByValues_) return self.sheetClient.updateChecklistTask(taskId, onboardingId, updates);
    var c = lessonCol_(); var sheet = self.sheetClient.getChecklistSheet_();
    var rowIndex = self.sheetClient.findRowIndexByValues_(sheet, c.CHECKLIST.TASK_ID, taskId, c.CHECKLIST.ONBOARDING_ID, onboardingId);
    if (rowIndex < 0) return false;
    var mutation = self.prepareRowMutation(sheet, rowIndex, []); var keys = Object.keys(updates || {});
    for (var i = 0; i < keys.length; i += 1) { var key = self.sheetClient.normalizeKey_(keys[i]); self.setMutationValue_(mutation, key, updates[keys[i]]); }
    self.commitRowMutation(mutation);
    return true;
  });
};
LessonRepository.prototype.updateReminderMetadata = function (taskId, onboardingId, reminderCount, lastReminderAt) {
  var self = this;
  return this.withWriteLock_(function () {
    if (!self.sheetClient.getChecklistSheet_ || !self.sheetClient.findRowIndexByValues_) return self.sheetClient.updateChecklistReminderMetadata(taskId, onboardingId, reminderCount, lastReminderAt);
    var c = lessonCol_(); var sheet = self.sheetClient.getChecklistSheet_();
    var rowIndex = self.sheetClient.findRowIndexByValues_(sheet, c.CHECKLIST.TASK_ID, taskId, c.CHECKLIST.ONBOARDING_ID, onboardingId);
    if (rowIndex < 0) return false;
    var timestamp = lastReminderAt || new Date();
    var mutation = self.prepareRowMutation(sheet, rowIndex, ['updated_at', 'updated_by']);
    self.setMutationValue_(mutation, 'updated_at', timestamp);
    self.setMutationValue_(mutation, 'updated_by', 'system:reminder#' + Number(reminderCount || 0));
    self.commitRowMutation(mutation);
    return true;
  });
};
LessonRepository.prototype.updateReminderMetadataBatch = function (updates) {
  var self = this;
  var items = updates || [];
  if (!items.length) return 0;
  return this.withWriteLock_(function () {
    if (!self.sheetClient.getChecklistSheet_) return 0;
    return self.sheetClient.safeWrite_(Config.getChecklistSheetName(), function () {
      var sheet = self.sheetClient.getChecklistSheet_();
      if (sheet.getLastRow() < 2) return 0;
      var headerMap = self.sheetClient.getHeaderMap_(sheet);
      if (!headerMap.task_id || !headerMap.onboarding_id || !headerMap.updated_at || !headerMap.updated_by) return 0;
      var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      var updateMap = {};
      for (var i = 0; i < items.length; i += 1) {
        updateMap[String(items[i].taskId) + '::' + String(items[i].onboardingId)] = items[i];
      }
      var changed = 0;
      for (var r = 0; r < values.length; r += 1) {
        var key = String(values[r][headerMap.task_id - 1]) + '::' + String(values[r][headerMap.onboarding_id - 1]);
        var item = updateMap[key];
        if (!item) continue;
        values[r][headerMap.updated_at - 1] = item.lastReminderAt || new Date();
        values[r][headerMap.updated_by - 1] = 'system:reminder#' + Number(item.reminderCount || 0);
        changed += 1;
      }
      if (changed > 0) {
        sheet.getRange(2, 1, values.length, sheet.getLastColumn()).setValues(values);
      }
      return changed;
    }, { operation: 'updateChecklistReminderMetadataBatch', count: items.length });
  });
};

if (typeof module !== 'undefined') module.exports = { LessonRepository: LessonRepository };
