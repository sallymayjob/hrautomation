/* global Session, MailApp, Config, SheetClient, generateId, computeHash, console */
/**
 * @fileoverview Logging helpers and alert notifications.
 */

var LoggerUtilsBindings_ = null;
if (typeof module !== 'undefined') {
  LoggerUtilsBindings_ = require('./Utils.gs');
}

function loggerGenerateId_(prefix) {
  if (typeof generateId === 'function') return generateId(prefix);
  return LoggerUtilsBindings_ && LoggerUtilsBindings_.generateId ? LoggerUtilsBindings_.generateId(prefix) : '';
}

function loggerComputeHash_(parts) {
  if (typeof computeHash === 'function') return computeHash(parts);
  return LoggerUtilsBindings_ && LoggerUtilsBindings_.computeHash ? LoggerUtilsBindings_.computeHash(parts) : '';
}

function AuditLogger(sheetClient) {
  this.sheetClient = sheetClient || new SheetClient();
}

AuditLogger.prototype.log = function (event) {
  var auditId = event.auditId || loggerGenerateId_('AUD');
  var timestamp = event.timestamp || new Date();
  var actor = event.actorEmail || Session.getActiveUser().getEmail() || 'system';
  var details = event.details || '';
  var eventHash = loggerComputeHash_([event.entityType, event.entityId, event.action, details]);

  return this.sheetClient.appendAuditRow([
    auditId,
    timestamp,
    actor,
    event.entityType,
    event.entityId,
    event.action,
    details,
    eventHash
  ]);
};

AuditLogger.prototype.error = function (event, error) {
  var details = (event.details || '') + ' | ERROR: ' + (error && error.message ? error.message : String(error));
  return this.log({
    auditId: event.auditId,
    timestamp: event.timestamp,
    actorEmail: event.actorEmail,
    entityType: event.entityType || 'Onboarding',
    entityId: event.entityId || 'unknown',
    action: 'UPDATE',
    details: details
  });
};

AuditLogger.prototype.retry = function (event, attempt, maxAttempts) {
  var details = 'Retry attempt ' + attempt + ' of ' + maxAttempts + '. ' + (event.details || '');
  return this.log({
    auditId: event.auditId,
    timestamp: event.timestamp,
    actorEmail: event.actorEmail,
    entityType: event.entityType,
    entityId: event.entityId,
    action: event.action || 'UPDATE',
    details: details
  });
};

AuditLogger.prototype.logWorkflowLifecycle = function (event) {
  return this.sheetClient.appendWorkflowLifecycleEvent({
    event_id: event.event_id || loggerGenerateId_('WFL'),
    workflow_name: event.workflow_name || 'onboarding_workflow',
    workflow_run_key: event.workflow_run_key,
    event_type: event.event_type,
    event_ts: event.event_ts || new Date(),
    actor: event.actor || Session.getActiveUser().getEmail() || 'system',
    source_trigger: event.source_trigger || 'unknown',
    onboarding_id: event.onboarding_id || ''
  });
};

function verifyRequiredNamedFunctions(sheetClient) {
  var client = sheetClient || new SheetClient();
  var auditLogger = new AuditLogger(client);
  return client.validateRequiredNamedFunctions(auditLogger);
}

function notifyHrAlerts(message) {
  try {
    MailApp.sendEmail({
      to: Config.getHrAlertEmail(),
      subject: 'HR Automation Alert',
      body: String(message)
    });
  } catch (err) {
    console.error('Failed to send HR alert: ' + err);
  }
}

if (typeof module !== 'undefined') module.exports = {
  AuditLogger: AuditLogger,
  notifyHrAlerts: notifyHrAlerts,
  verifyRequiredNamedFunctions: verifyRequiredNamedFunctions
};
