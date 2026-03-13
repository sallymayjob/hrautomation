/* global Config, COL, LockService, LessonRepository */
/** @fileoverview Onboarding and checklist data repository. */

var OnboardingRepoBindings_ = null;
if (typeof module !== 'undefined') OnboardingRepoBindings_ = require('./SheetClient.gs');
function onboardingCol_() {
  if (typeof COL !== 'undefined' && COL) return COL;
  if (OnboardingRepoBindings_ && OnboardingRepoBindings_.COL) return OnboardingRepoBindings_.COL;
  return { CHECKLIST: { ONBOARDING_ID: 2, PHASE: 3, STATUS: 7 } };
}

function withOnboardingLock_(operation) {
  if (typeof LockService === 'undefined' || !LockService || typeof LockService.getDocumentLock !== 'function') return operation();
  var lock = LockService.getDocumentLock(); lock.waitLock(30000); try { return operation(); } finally { lock.releaseLock(); }
}

function OnboardingRepository(sheetClient) { this.sheetClient = sheetClient; }
OnboardingRepository.prototype.getRows = function () {
  if (this.sheetClient.getDataRows_ && this.sheetClient.getOnboardingSheet_) return this.sheetClient.getDataRows_(this.sheetClient.getOnboardingSheet_());
  return this.sheetClient.getOnboardingRows ? this.sheetClient.getOnboardingRows() : [];
};
OnboardingRepository.prototype.findByEmployeeId = function (employeeId) {
  if (!this.sheetClient.getOnboardingSheet_ || !this.sheetClient.findRowIndexByValue_) return this.sheetClient.findOnboardingByEmployeeId ? this.sheetClient.findOnboardingByEmployeeId(employeeId) : null;
  var sheet = this.sheetClient.getOnboardingSheet_();
  var idColumn = this.sheetClient.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
  var rowIndex = this.sheetClient.findRowIndexByValue_(sheet, idColumn, employeeId);
  if (rowIndex < 0) return null;
  return { rowIndex: rowIndex, values: sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0] };
};
OnboardingRepository.prototype.appendRow = function (rowValues) {
  var self = this;
  return withOnboardingLock_(function () {
    if (!self.sheetClient.getOnboardingSheet_ || !self.sheetClient.findRowIndexByValue_) return self.sheetClient.appendOnboardingRow(rowValues);
    return self.sheetClient.safeWrite_(Config.getOnboardingSheetName(), function () {
      var sheet = self.sheetClient.getOnboardingSheet_();
      var idColumn = self.sheetClient.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
      var existing = self.sheetClient.findRowIndexByValue_(sheet, idColumn, rowValues[idColumn - 1]);
      if (existing > -1) { self.sheetClient.writeRow_(sheet, existing, rowValues); return existing; }
      return self.sheetClient.appendRow_(sheet, rowValues);
    }, { operation: 'appendOnboardingRow' });
  });
};
OnboardingRepository.prototype.upsertRow = function (employeeId, rowValues) {
  var self = this;
  return withOnboardingLock_(function () {
    if (!self.sheetClient.getOnboardingSheet_ || !self.sheetClient.findRowIndexByValue_) return self.sheetClient.upsertOnboardingRow(employeeId, rowValues);
    return self.sheetClient.safeWrite_(Config.getOnboardingSheetName(), function () {
      var sheet = self.sheetClient.getOnboardingSheet_();
      var idColumn = self.sheetClient.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
      var rowIndex = self.sheetClient.findRowIndexByValue_(sheet, idColumn, employeeId);
      if (rowIndex < 0) return self.sheetClient.appendRow_(sheet, rowValues);
      self.sheetClient.writeRow_(sheet, rowIndex, rowValues);
      return rowIndex;
    }, { operation: 'upsertOnboardingRow', employeeId: employeeId });
  });
};
OnboardingRepository.prototype.evaluateCompletionGate = function (employeeId) {
  if (!this.sheetClient.getChecklistSheet_ || !this.sheetClient.getDataRows_) return this.sheetClient.evaluateOnboardingCompletionGate(employeeId);
  var c = onboardingCol_(); var checklist = this.sheetClient.getChecklistSheet_(); var rows = this.sheetClient.getDataRows_(checklist); var blockedByPhase = {};
  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    if (String(row[c.CHECKLIST.ONBOARDING_ID - 1]) !== String(employeeId)) continue;
    var status = String(row[c.CHECKLIST.STATUS - 1] || '').trim().toUpperCase();
    if (status === 'COMPLETE' || status === 'DONE') continue;
    var phase = String(row[c.CHECKLIST.PHASE - 1] || '').trim() || 'UNKNOWN'; blockedByPhase[phase] = true;
  }
  var blockedPhases = Object.keys(blockedByPhase);
  return { canComplete: blockedPhases.length === 0, blockedReason: blockedPhases.length ? 'Checklist incomplete for phase(s): ' + blockedPhases.join(', ') : '' };
};
OnboardingRepository.prototype.updateStatus = function (employeeId, status) {
  var self = this;
  return withOnboardingLock_(function () {
    if (!self.sheetClient.getOnboardingSheet_ || !self.sheetClient.findRowIndexByValue_) return self.sheetClient.updateOnboardingStatus(employeeId, status);
    return self.sheetClient.safeWrite_(Config.getOnboardingSheetName(), function () {
      var sheet = self.sheetClient.getOnboardingSheet_();
      var idColumn = self.sheetClient.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
      var statusColumn = self.sheetClient.getColumnIndexByHeaderKey_(sheet, 'status', true);
      var blockedReasonColumn = self.sheetClient.getColumnIndexByHeaderKey_(sheet, 'blocked_reason', false);
      var rowIndex = self.sheetClient.findRowIndexByValue_(sheet, idColumn, employeeId); if (rowIndex < 0) return false;
      var nextStatus = String(status || '').trim().toUpperCase();
      if (nextStatus === 'COMPLETE') { var gate = self.evaluateCompletionGate(employeeId); if (!gate.canComplete) { sheet.getRange(rowIndex, statusColumn).setValue('BLOCKED'); if (blockedReasonColumn > 0) sheet.getRange(rowIndex, blockedReasonColumn).setValue(gate.blockedReason); return false; } }
      sheet.getRange(rowIndex, statusColumn).setValue(status); if (blockedReasonColumn > 0 && nextStatus !== 'BLOCKED') sheet.getRange(rowIndex, blockedReasonColumn).setValue(''); return true;
    }, { operation: 'updateOnboardingStatus', employeeId: employeeId });
  });
};
OnboardingRepository.prototype.getHeaderMap = function (sheet) {
  if (this.sheetClient.getHeaderMap_) return this.sheetClient.getHeaderMap_(sheet);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0], map = {};
  for (var i = 0; i < headers.length; i += 1) { var key = String(headers[i] || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); if (key) map[key] = i + 1; }
  return map;
};
OnboardingRepository.prototype.getRowObject = function (sheet, rowIndex, headerMap) { var rowValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0]; var row = {}; Object.keys(headerMap).forEach(function (key) { row[key] = rowValues[headerMap[key] - 1]; }); return row; };
OnboardingRepository.prototype.setValueIfPresent = function (sheet, rowIndex, headerMap, key, value) { if (headerMap[key]) sheet.getRange(rowIndex, headerMap[key]).setValue(value); };
OnboardingRepository.prototype.setStatus = function (sheet, rowIndex, headerMap, statusValue) { if (!headerMap.status) return; sheet.getRange(rowIndex, headerMap.status).setValue(statusValue); this.setValueIfPresent(sheet, rowIndex, headerMap, 'last_updated_at', new Date()); };
OnboardingRepository.prototype.setBlockedReason = function (sheet, rowIndex, headerMap, message) { this.setValueIfPresent(sheet, rowIndex, headerMap, 'blocked_reason', message || ''); };
OnboardingRepository.prototype.findDuplicateByRowHash = function (rowHash, rowIndex) { return this.sheetClient.checkDuplicate(Config.getOnboardingSheetName(), 'row_hash', rowHash, rowIndex); };
OnboardingRepository.prototype.ensureChecklistHeaders = function (headers) { this.sheetClient.ensureSheetWithHeaders(Config.getChecklistSheetName(), headers); };
OnboardingRepository.prototype.appendChecklistTask = function (rowValues) { return (typeof LessonRepository !== 'undefined' ? new LessonRepository(this.sheetClient).appendTask(rowValues) : this.sheetClient.appendChecklistTask(rowValues)); };
OnboardingRepository.prototype.getChecklistRows = function () { return (typeof LessonRepository !== 'undefined' ? new LessonRepository(this.sheetClient).getRows() : this.sheetClient.getChecklistRows()); };
OnboardingRepository.prototype.getChecklistRowLink = function (rowIndex) { return this.sheetClient.getSheetRowLink(Config.getChecklistSheetName(), rowIndex); };
OnboardingRepository.prototype.getRowsWithHeaders = function () { var sheet = this.sheetClient.getOnboardingSheet_(); if (!sheet || sheet.getLastRow() < 2) return { headers: [], rows: [] }; return { headers: sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0], rows: sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues() }; };
if (typeof module !== 'undefined') module.exports = { OnboardingRepository: OnboardingRepository };
