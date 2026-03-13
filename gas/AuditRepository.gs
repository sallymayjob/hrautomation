/* global Config, COL, LockService, computeHash, generateId */
/** @fileoverview Audit repository. */
var AuditRepoBindings_ = null;
if (typeof module !== 'undefined') AuditRepoBindings_ = require('./SheetClient.gs');
function auditCol_() {
  if (typeof COL !== 'undefined' && COL) return COL;
  if (AuditRepoBindings_ && AuditRepoBindings_.COL) return AuditRepoBindings_.COL;
  return { AUDIT: { AUDIT_ID: 1, EVENT_HASH: 8 } };
}
function AuditRepository(sheetClient, auditLogger) { this.sheetClient = sheetClient; this.auditLogger = auditLogger; }
AuditRepository.prototype.withWriteLock_ = function (operation) { if (typeof LockService === 'undefined' || !LockService || typeof LockService.getDocumentLock !== 'function') return operation(); var lock = LockService.getDocumentLock(); lock.waitLock(30000); try { return operation(); } finally { lock.releaseLock(); } };
AuditRepository.prototype.log = function (entry) { if (this.auditLogger && typeof this.auditLogger.log === 'function') this.auditLogger.log(entry); };
AuditRepository.prototype.error = function (entry, err) { if (this.auditLogger && typeof this.auditLogger.error === 'function') this.auditLogger.error(entry, err); };
AuditRepository.prototype.getRows = function () { if (this.sheetClient.getDataRows_ && this.sheetClient.getAuditSheet_) return this.sheetClient.getDataRows_(this.sheetClient.getAuditSheet_()); return this.sheetClient.getAuditRows ? this.sheetClient.getAuditRows() : []; };
AuditRepository.prototype.logOnce = function (eventHash, rowValues) { var self = this; return this.withWriteLock_(function () { if (!self.sheetClient.getAuditSheet_ || !self.sheetClient.findRowIndexByValue_) return self.sheetClient.appendAuditIfNotExists(eventHash, rowValues); var sheet = self.sheetClient.getAuditSheet_(); var idx = self.sheetClient.findRowIndexByValue_(sheet, auditCol_().AUDIT.EVENT_HASH, eventHash); if (idx > -1) return idx; return self.sheetClient.appendRow_(sheet, rowValues); }); };
AuditRepository.prototype.checkDuplicate = function (eventHash) { return this.sheetClient.checkDuplicate(Config.getAuditSheetName(), 'event_hash', eventHash) > -1; };
AuditRepository.prototype.isDuplicateEvent = AuditRepository.prototype.checkDuplicate;
AuditRepository.prototype.appendRow = function (rowValues) { var self = this; return this.withWriteLock_(function () { if (!self.sheetClient.getAuditSheet_ || !self.sheetClient.findRowIndexByValue_) return self.sheetClient.appendAuditRow(rowValues); return self.sheetClient.safeWrite_(Config.getAuditSheetName(), function () { var sheet = self.sheetClient.getAuditSheet_(); var id = rowValues[auditCol_().AUDIT.AUDIT_ID - 1]; if (id) { var existing = self.sheetClient.findRowIndexByValue_(sheet, auditCol_().AUDIT.AUDIT_ID, id); if (existing > -1) { self.sheetClient.writeRow_(sheet, existing, rowValues); return existing; } } return self.sheetClient.appendRow_(sheet, rowValues); }, { operation: 'appendAuditRow' }); }); };
AuditRepository.prototype.appendWorkflowLifecycleEvent = function (event) { var eventHash = computeHash([event.workflow_run_key, event.event_type, event.onboarding_id]); var details = JSON.stringify({ event_id: event.event_id, workflow_name: event.workflow_name, workflow_run_key: event.workflow_run_key, event_type: event.event_type, event_ts: event.event_ts, actor: event.actor, source_trigger: event.source_trigger, onboarding_id: event.onboarding_id }); return this.logOnce(eventHash, [event.event_id, event.event_ts, event.actor, 'WorkflowLifecycle', event.onboarding_id || event.workflow_run_key, event.event_type, details, eventHash]); };
AuditRepository.prototype.logLifecycle = function (eventPayload) { if (this.auditLogger && typeof this.auditLogger.logWorkflowLifecycle === 'function') return this.auditLogger.logWorkflowLifecycle(eventPayload); if (this.sheetClient && typeof this.sheetClient.appendWorkflowLifecycleEvent === 'function') return this.sheetClient.appendWorkflowLifecycleEvent(eventPayload); return null; };
AuditRepository.prototype.newAuditRow = function (entityType, entityId, action, details, eventHash) { return [generateId('AUD'), new Date(), 'system', entityType, entityId, action, details, eventHash]; };
if (typeof module !== 'undefined') module.exports = { AuditRepository: AuditRepository };
