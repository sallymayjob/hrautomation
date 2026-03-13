/* global COL, LockService */
/** @fileoverview Checklist/Lesson repository. */
var LessonRepoBindings_ = null;
if (typeof module !== 'undefined') LessonRepoBindings_ = require('./SheetClient.gs');
function lessonCol_() {
  if (typeof COL !== 'undefined' && COL) return COL;
  if (LessonRepoBindings_ && LessonRepoBindings_.COL) return LessonRepoBindings_.COL;
  return { CHECKLIST: { TASK_ID: 1, ONBOARDING_ID: 2, STATUS: 7, UPDATED_AT: 9, UPDATED_BY: 10, NOTES: 11 } };
}

function LessonRepository(sheetClient) { this.sheetClient = sheetClient; }
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
    var headerMap = self.sheetClient.getHeaderMap_(sheet); var keys = Object.keys(updates || {});
    for (var i = 0; i < keys.length; i += 1) { var key = self.sheetClient.normalizeKey_(keys[i]); var col = headerMap[key]; if (col) sheet.getRange(rowIndex, col).setValue(updates[keys[i]]); }
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
    sheet.getRange(rowIndex, c.CHECKLIST.UPDATED_AT).setValue(timestamp);
    sheet.getRange(rowIndex, c.CHECKLIST.UPDATED_BY).setValue('system:reminder#' + Number(reminderCount || 0));
    return true;
  });
};
if (typeof module !== 'undefined') module.exports = { LessonRepository: LessonRepository };
