/* global AuditRepository, generateId, computeHash, sanitizeTextForLog, sanitizeErrorForLog */
/**
 * @fileoverview Service wrapper for structured audit event composition.
 */

var AuditServiceBindings_ = null;
if (typeof module !== 'undefined') {
  AuditServiceBindings_ = {
    AuditRepository: require('./AuditRepository.gs').AuditRepository
  };
}

function getAuditRepositoryCtor_() {
  if (typeof AuditRepository !== 'undefined' && AuditRepository) {
    return AuditRepository;
  }
  return AuditServiceBindings_ ? AuditServiceBindings_.AuditRepository : null;
}

function AuditService(sheetClient) {
  var AuditRepositoryCtor = getAuditRepositoryCtor_();
  this.auditRepository = AuditRepositoryCtor ? new AuditRepositoryCtor(sheetClient) : null;
}

AuditService.prototype.logEvent = function (payload) {
  if (!this.auditRepository || typeof this.auditRepository.log !== 'function') {
    return;
  }
  this.auditRepository.log({
    auditId: payload.auditId || generateId('AUD'),
    timestamp: payload.timestamp || new Date(),
    actorEmail: payload.actorEmail,
    entityType: String(payload.entityType || 'System'),
    entityId: String(payload.entityId || ''),
    action: String(payload.action || 'UPDATE'),
    details: typeof sanitizeTextForLog === 'function' ? sanitizeTextForLog(payload.details || '') : String(payload.details || '')
  });
};

AuditService.prototype.logError = function (payload, error) {
  var errorText = typeof sanitizeErrorForLog === 'function'
    ? sanitizeErrorForLog(error)
    : (error && error.message ? error.message : String(error));
  this.logEvent({
    auditId: payload && payload.auditId,
    timestamp: payload && payload.timestamp,
    actorEmail: payload && payload.actorEmail,
    entityType: payload && payload.entityType,
    entityId: payload && payload.entityId,
    action: payload && payload.action,
    details: String((payload && payload.details) || '') + ' | ERROR: ' + errorText
  });
};

AuditService.prototype.logRetry = function (payload, attempt, maxAttempts) {
  this.logEvent({
    auditId: payload && payload.auditId,
    timestamp: payload && payload.timestamp,
    actorEmail: payload && payload.actorEmail,
    entityType: payload && payload.entityType,
    entityId: payload && payload.entityId,
    action: (payload && payload.action) || 'UPDATE',
    details: 'Retry attempt ' + attempt + ' of ' + maxAttempts + '. ' + String((payload && payload.details) || '')
  });
};

AuditService.prototype.logWorkflowLifecycle = function (event) {
  if (!this.auditRepository || typeof this.auditRepository.logLifecycle !== 'function') {
    return;
  }
  this.auditRepository.logLifecycle({
    event_id: event.event_id || generateId('WFL'),
    workflow_name: event.workflow_name || 'onboarding_workflow',
    workflow_run_key: event.workflow_run_key,
    event_type: event.event_type,
    event_ts: event.event_ts || new Date(),
    actor: event.actor || 'system',
    source_trigger: event.source_trigger || 'unknown',
    onboarding_id: event.onboarding_id || ''
  });
};

AuditService.prototype.logRecognitionAction = function (payload) {
  this.logEvent({
    entityType: 'Training',
    entityId: String(payload && payload.entityId ? payload.entityId : ''),
    action: String((payload && payload.action) || 'UPDATE'),
    details: String((payload && payload.details) || 'Recognition action')
  });
};

AuditService.prototype.logUniqueEvent = function (entityType, entityId, action, details, hashParts) {
  if (!this.auditRepository || typeof this.auditRepository.logOnce !== 'function') {
    return;
  }
  var eventHash = computeHash(hashParts || [entityType, entityId, action, details]);
  this.auditRepository.logOnce(eventHash, this.auditRepository.newAuditRow(entityType, entityId, action, details, eventHash));
};

if (typeof module !== 'undefined') {
  module.exports = {
    AuditService: AuditService
  };
}
