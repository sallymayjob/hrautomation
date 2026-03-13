/* global AuditLogger, generateId */
/**
 * @fileoverview Service wrapper for structured audit events.
 */

function AuditService(sheetClient) {
  this.auditLogger = new AuditLogger(sheetClient);
}

AuditService.prototype.logRecognitionAction = function (payload) {
  if (!this.auditLogger || typeof this.auditLogger.log !== 'function') {
    return;
  }

  var entityId = String(payload && payload.entityId ? payload.entityId : '');
  this.auditLogger.log({
    auditId: generateId('AUD'),
    entityType: 'Training',
    entityId: entityId,
    action: String((payload && payload.action) || 'UPDATE'),
    details: String((payload && payload.details) || 'Recognition action')
  });
};

if (typeof module !== 'undefined') {
  module.exports = {
    AuditService: AuditService
  };
}
