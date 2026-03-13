/* global Config, computeHash, generateId */
/**
 * @fileoverview Repository adapters for onboarding, training, and audit writes.
 */

function OnboardingRepository(sheetClient) {
  this.sheetClient = sheetClient;
}

OnboardingRepository.prototype.getHeaderMap = function (sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i += 1) {
    var key = String(headers[i] || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (key) {
      map[key] = i + 1;
    }
  }
  return map;
};

OnboardingRepository.prototype.getRowObject = function (sheet, rowIndex, headerMap) {
  var rowValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = {};
  Object.keys(headerMap).forEach(function (key) {
    row[key] = rowValues[headerMap[key] - 1];
  });
  return row;
};

OnboardingRepository.prototype.setValueIfPresent = function (sheet, rowIndex, headerMap, key, value) {
  if (headerMap[key]) {
    sheet.getRange(rowIndex, headerMap[key]).setValue(value);
  }
};

OnboardingRepository.prototype.setStatus = function (sheet, rowIndex, headerMap, statusValue) {
  if (!headerMap.status) {
    return;
  }
  sheet.getRange(rowIndex, headerMap.status).setValue(statusValue);
  this.setValueIfPresent(sheet, rowIndex, headerMap, 'last_updated_at', new Date());
};

OnboardingRepository.prototype.setBlockedReason = function (sheet, rowIndex, headerMap, message) {
  this.setValueIfPresent(sheet, rowIndex, headerMap, 'blocked_reason', message || '');
};

OnboardingRepository.prototype.findDuplicateByRowHash = function (rowHash, rowIndex) {
  return this.sheetClient.checkDuplicate(Config.getOnboardingSheetName(), 'row_hash', rowHash, rowIndex);
};

OnboardingRepository.prototype.ensureChecklistHeaders = function (headers) {
  this.sheetClient.ensureSheetWithHeaders(Config.getChecklistSheetName(), headers);
};

OnboardingRepository.prototype.appendChecklistTask = function (rowValues) {
  return this.sheetClient.appendChecklistTask(rowValues);
};

OnboardingRepository.prototype.getChecklistRows = function () {
  return this.sheetClient.getChecklistRows();
};

OnboardingRepository.prototype.getChecklistRowLink = function (rowIndex) {
  return this.sheetClient.getSheetRowLink(Config.getChecklistSheetName(), rowIndex);
};

function TrainingRepository(sheetClient) {
  this.sheetClient = sheetClient;
}

TrainingRepository.prototype.appendAssignment = function (rowValues) {
  return this.sheetClient.appendTrainingRow(rowValues);
};

function AuditRepository(sheetClient, auditLogger) {
  this.sheetClient = sheetClient;
  this.auditLogger = auditLogger;
}

AuditRepository.prototype.log = function (entry) {
  if (this.auditLogger && typeof this.auditLogger.log === 'function') {
    this.auditLogger.log(entry);
  }
};

AuditRepository.prototype.error = function (entry, err) {
  if (this.auditLogger && typeof this.auditLogger.error === 'function') {
    this.auditLogger.error(entry, err);
  }
};

AuditRepository.prototype.logLifecycle = function (eventPayload) {
  if (this.auditLogger && typeof this.auditLogger.logWorkflowLifecycle === 'function') {
    this.auditLogger.logWorkflowLifecycle(eventPayload);
    return;
  }
  if (this.sheetClient && typeof this.sheetClient.appendWorkflowLifecycleEvent === 'function') {
    this.sheetClient.appendWorkflowLifecycleEvent(eventPayload);
  }
};

AuditRepository.prototype.logOnce = function (eventHash, rowValues) {
  return this.sheetClient.appendAuditIfNotExists(eventHash, rowValues);
};

AuditRepository.prototype.isDuplicateEvent = function (eventHash) {
  return this.sheetClient.checkDuplicate(Config.getAuditSheetName(), 'event_hash', eventHash) > -1;
};

AuditRepository.prototype.newAuditRow = function (entityType, entityId, action, details, eventHash) {
  return [
    generateId('AUD'),
    new Date(),
    'system',
    entityType,
    entityId,
    action,
    details,
    eventHash
  ];
};

if (typeof module !== 'undefined') {
  module.exports = {
    OnboardingRepository: OnboardingRepository,
    TrainingRepository: TrainingRepository,
    AuditRepository: AuditRepository
  };
}
