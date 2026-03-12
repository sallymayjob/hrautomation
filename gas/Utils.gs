/* global Utilities, SheetClient, Session, MailApp, Config, console */
/**
 * @fileoverview Shared utility functions.
 */

function generateId(prefix) {
  var safePrefix = prefix || 'id';
  var ts = Utilities.formatDate(new Date(), 'Etc/UTC', "yyyyMMdd'T'HHmmss'Z'");
  var suffix = Utilities.getUuid().slice(0, 8);
  return safePrefix + '_' + ts + '_' + suffix;
}

function computeHash(parts) {
  var payload = (parts || []).map(function (part) {
    return part === null || part === undefined ? '' : String(part);
  }).join('|');
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payload, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    var value = (b < 0 ? b + 256 : b).toString(16);
    return value.length === 1 ? '0' + value : value;
  }).join('');
}

function getDaysUntilDue(dueDateValue) {
  if (!dueDateValue) {
    return null;
  }
  var dueDate = dueDateValue instanceof Date ? dueDateValue : new Date(dueDateValue);
  if (isNaN(dueDate.getTime())) {
    throw new Error('Invalid due date: ' + dueDateValue);
  }

  function toNzMidnightEpoch(dateValue) {
    var nzDate = Utilities.formatDate(dateValue, 'Pacific/Auckland', 'yyyy-MM-dd');
    var parts = nzDate.split('-');
    return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  var todayEpoch = toNzMidnightEpoch(new Date());
  var dueEpoch = toNzMidnightEpoch(dueDate);
  return Math.floor((dueEpoch - todayEpoch) / 86400000);
}

function AuditLogger(sheetClient) {
  this.sheetClient = sheetClient || new SheetClient();
}

AuditLogger.prototype.log = function (event) {
  var auditId = event.auditId || generateId('AUD');
  var timestamp = event.timestamp || new Date();
  var actor = event.actorEmail || Session.getActiveUser().getEmail() || 'system';
  var details = event.details || '';
  var eventHash = computeHash([event.entityType, event.entityId, event.action, details]);

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
    event_id: event.event_id || generateId('WFL'),
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
  generateId: generateId,
  computeHash: computeHash,
  getDaysUntilDue: getDaysUntilDue,
  AuditLogger: AuditLogger,
  notifyHrAlerts: notifyHrAlerts,
  verifyRequiredNamedFunctions: verifyRequiredNamedFunctions
};
