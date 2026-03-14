/* global SpreadsheetGovernancePolicy, SheetClient, Config, AuditLogger, Session, console */
/**
 * @fileoverview Optional write guard for manual edits to automation-owned identity columns.
 */

var SpreadsheetWriteGuardBindings_ = null;
if (typeof require === 'function') {
  SpreadsheetWriteGuardBindings_ = {
    policy: require('./SpreadsheetGovernancePolicy.gs').SpreadsheetGovernancePolicy,
    sheetClient: require('./SheetClient.gs').SheetClient,
    logger: require('./Logger.gs')
  };
}

function getGovernancePolicy_() {
  if (typeof SpreadsheetGovernancePolicy !== 'undefined' && SpreadsheetGovernancePolicy) {
    return SpreadsheetGovernancePolicy;
  }
  return SpreadsheetWriteGuardBindings_ && SpreadsheetWriteGuardBindings_.policy;
}

function getSheetClientCtor_() {
  if (typeof SheetClient !== 'undefined' && SheetClient) {
    return SheetClient;
  }
  return SpreadsheetWriteGuardBindings_ && SpreadsheetWriteGuardBindings_.sheetClient;
}

function getAuditLoggerCtor_() {
  if (typeof AuditLogger !== 'undefined' && AuditLogger) {
    return AuditLogger;
  }
  return SpreadsheetWriteGuardBindings_ && SpreadsheetWriteGuardBindings_.logger && SpreadsheetWriteGuardBindings_.logger.AuditLogger;
}

function isWriteGuardEnabled_() {
  if (typeof Config !== 'undefined' && Config && typeof Config.KEYS === 'object') {
    try {
      var props = PropertiesService.getScriptProperties();
      var value = String(props.getProperty('MANAGED_WRITE_GUARD_ENABLED') || 'false').trim().toLowerCase();
      return value === '1' || value === 'true' || value === 'yes';
    } catch (err) {
      return false;
    }
  }
  return false;
}

function getWriteGuardMode_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var mode = String(props.getProperty('MANAGED_WRITE_GUARD_MODE') || 'log').trim().toLowerCase();
    return mode === 'reject' ? 'reject' : 'log';
  } catch (err) {
    return 'log';
  }
}

function getHeaderValueByColumn_(sheet, columnIndex) {
  if (!sheet || !columnIndex || columnIndex < 1) {
    return '';
  }
  return String(sheet.getRange(1, columnIndex).getValue() || '').trim();
}

function tryResolveActiveUserEmail_() {
  try {
    return Session.getActiveUser().getEmail();
  } catch (err) {
    return 'unknown';
  }
}

function logGuardEvent_(event) {
  var ctor = getAuditLoggerCtor_();
  if (ctor) {
    try {
      var logger = new ctor();
      logger.log({
        entityType: 'SheetGovernance',
        entityId: event.sheetName + '#R' + event.row + 'C' + event.column,
        action: event.action,
        details: event.message,
        actorEmail: event.actorEmail
      });
      return;
    } catch (err) {
      // fall through to console log
    }
  }
  if (typeof console !== 'undefined' && console && typeof console.log === 'function') {
    console.log('[SpreadsheetWriteGuard] ' + event.message);
  }
}

function applyManagedIdentityWriteGuard(e, options) {
  var opts = options || {};
  var enabled = typeof opts.enabled === 'boolean' ? opts.enabled : isWriteGuardEnabled_();
  if (!enabled) {
    return { ok: true, skipped: true, reason: 'guard_disabled' };
  }

  var range = e && e.range;
  var sheet = range && range.getSheet ? range.getSheet() : null;
  if (!sheet) {
    return { ok: true, skipped: true, reason: 'no_sheet_context' };
  }

  var policy = getGovernancePolicy_();
  var sheetPolicy = policy && typeof policy.getPolicyForSheetName === 'function'
    ? policy.getPolicyForSheetName(sheet.getName())
    : null;
  if (!sheetPolicy) {
    return { ok: true, skipped: true, reason: 'sheet_not_managed' };
  }

  if (range.getNumRows() !== 1 || range.getNumColumns() !== 1 || range.getRow() === 1) {
    return { ok: true, skipped: true, reason: 'range_not_supported' };
  }

  var headerValue = getHeaderValueByColumn_(sheet, range.getColumn());
  if (!policy.isManagedIdentityColumn(sheet.getName(), headerValue)) {
    return { ok: true, skipped: true, reason: 'field_not_managed_identity' };
  }

  var mode = String(opts.mode || getWriteGuardMode_()).toLowerCase() === 'reject' ? 'reject' : 'log';
  var actorEmail = opts.actorEmail || tryResolveActiveUserEmail_();
  var message = 'Manual edit detected in managed identity field "' + headerValue + '" on sheet "' + sheet.getName() + '" row ' + range.getRow() + '. Mode=' + mode + '.';

  if (mode === 'reject' && Object.prototype.hasOwnProperty.call(e || {}, 'oldValue')) {
    var SheetClientCtor = getSheetClientCtor_();
    if (SheetClientCtor) {
      var client = new SheetClientCtor();
      if (typeof client.writeCellValue === 'function') {
        client.writeCellValue(sheet, range.getRow(), range.getColumn(), e.oldValue);
      }
    }
    logGuardEvent_({
      action: 'MANUAL_EDIT_REJECTED',
      sheetName: sheet.getName(),
      row: range.getRow(),
      column: range.getColumn(),
      actorEmail: actorEmail,
      message: message + ' Reverted to previous value.'
    });

    return {
      ok: false,
      blocked: true,
      mode: mode,
      field: headerValue,
      row: range.getRow(),
      column: range.getColumn(),
      message: message
    };
  }

  logGuardEvent_({
    action: 'MANUAL_EDIT_LOGGED',
    sheetName: sheet.getName(),
    row: range.getRow(),
    column: range.getColumn(),
    actorEmail: actorEmail,
    message: message
  });

  return {
    ok: true,
    logged: true,
    mode: mode,
    field: headerValue,
    row: range.getRow(),
    column: range.getColumn(),
    message: message
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    applyManagedIdentityWriteGuard: applyManagedIdentityWriteGuard,
    getWriteGuardMode_: getWriteGuardMode_,
    isWriteGuardEnabled_: isWriteGuardEnabled_
  };
}
