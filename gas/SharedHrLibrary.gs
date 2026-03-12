/* global generateId, MailApp */
/**
 * @fileoverview Shared HR library entry points for onboarding processing and operator-friendly incident handling.
 */

function processOnboardingBatch(rows, options) {
  var normalizedRows = Array.isArray(rows) ? rows : [];
  var opts = options || {};
  var traceId = getTraceId_(opts.traceId);
  var errors = [];
  var successCount = 0;

  for (var i = 0; i < normalizedRows.length; i += 1) {
    var row = normalizedRows[i] || {};
    var rowErrors = validateOnboardingRow_(row, i);
    if (rowErrors.length > 0) {
      errors = errors.concat(rowErrors);
      continue;
    }

    successCount += 1;
  }

  return buildResult_(traceId, successCount, errors);
}

function runAuditChecks(rows, options) {
  var normalizedRows = Array.isArray(rows) ? rows : [];
  var opts = options || {};
  var traceId = getTraceId_(opts.traceId);
  var errors = [];
  var successCount = 0;
  var seenKeys = {};

  for (var i = 0; i < normalizedRows.length; i += 1) {
    var row = normalizedRows[i] || {};
    var rowErrors = validateAuditRow_(row, i, seenKeys);
    if (rowErrors.length > 0) {
      errors = errors.concat(rowErrors);
      continue;
    }

    successCount += 1;
  }

  return buildResult_(traceId, successCount, errors);
}

function writeExecutionLog(runContext, results) {
  var context = runContext || {};
  var normalizedResults = results || {};
  var traceId = getTraceId_(context.traceId || normalizedResults.traceId);
  var errors = [];
  var spreadsheet = context.spreadsheet;
  var logEntries = Array.isArray(context.entries) && context.entries.length > 0
    ? context.entries
    : [buildDefaultLogEntry_(context, normalizedResults, traceId)];

  try {
    if (spreadsheet && typeof spreadsheet.getSheetByName === 'function' && typeof spreadsheet.insertSheet === 'function') {
      writeRowsToLogSheets_(spreadsheet, logEntries, traceId);
    } else if (context.logger && typeof context.logger.log === 'function') {
      for (var i = 0; i < logEntries.length; i += 1) {
        context.logger.log(logEntries[i]);
      }
    } else {
      errors.push(buildOperatorError_('LOGGING_CHANNEL_UNAVAILABLE', 0,
        'We could not save the execution log because no logging channel is configured. Please contact your HR systems admin.'));
    }
  } catch (err) {
    errors.push(buildOperatorError_('LOGGING_WRITE_FAILED', 0,
      'We could not save the execution log. Please retry in a few minutes or contact HR systems support.', err));
  }

  return buildResult_(traceId, errors.length === 0 ? 1 : 0, errors);
}

function buildDefaultLogEntry_(context, normalizedResults, traceId) {
  return {
    timestamp: new Date(),
    spreadsheetType: String(context.spreadsheetType || context.workflowName || context.workflow || 'shared_hr_library'),
    function: String(context.functionName || context.libraryMethodName || 'writeExecutionLog'),
    traceId: traceId,
    recordKey: String(context.recordKey || context.runId || ''),
    result: Number(normalizedResults.errorCount || 0) > 0 ? 'FAILURE' : 'SUCCESS',
    errorMessage: Number(normalizedResults.errorCount || 0) > 0 ? 'One or more records failed validation.' : ''
  };
}

function writeRowsToLogSheets_(spreadsheet, logEntries, traceId) {
  var automationLogSheet = getOrCreateLogSheet_(spreadsheet, 'Automation Logs');
  var exceptionsSheet = getOrCreateLogSheet_(spreadsheet, 'Exceptions');

  for (var i = 0; i < logEntries.length; i += 1) {
    var entry = logEntries[i] || {};
    var normalizedRow = normalizeLogEntry_(entry, traceId);
    automationLogSheet.appendRow(normalizedRow);

    if (String(normalizedRow[5]).toUpperCase() !== 'SUCCESS') {
      exceptionsSheet.appendRow(normalizedRow);
    }
  }
}

function getOrCreateLogSheet_(spreadsheet, sheetName) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.appendRow(['timestamp', 'spreadsheetType', 'function', 'traceId', 'recordKey', 'result', 'errorMessage']);
  }
  return sheet;
}

function normalizeLogEntry_(entry, traceId) {
  return [
    entry.timestamp instanceof Date ? entry.timestamp : new Date(),
    String(entry.spreadsheetType || 'unknown'),
    String(entry.function || entry.functionName || 'unknown'),
    String(entry.traceId || traceId || ''),
    String(entry.recordKey || ''),
    String(entry.result || 'UNKNOWN'),
    String(entry.errorMessage || '')
  ];
}

function notifyExceptions(exceptions, recipients) {
  var normalizedExceptions = Array.isArray(exceptions) ? exceptions : [];
  var normalizedRecipients = Array.isArray(recipients) ? recipients : [];
  var traceId = getTraceId_();
  var errors = [];
  var successCount = 0;

  if (normalizedRecipients.length === 0) {
    errors.push(buildOperatorError_('NO_RECIPIENTS', 0,
      'No recipients were provided for exception alerts. Please add at least one HR inbox email.'));
    return buildResult_(traceId, successCount, errors);
  }

  for (var i = 0; i < normalizedExceptions.length; i += 1) {
    var exceptionItem = normalizedExceptions[i] || {};
    if (!exceptionItem.message) {
      errors.push(buildOperatorError_('EXCEPTION_MESSAGE_MISSING', i,
        'An exception could not be sent because it has no message. Please review the failed row details.'));
      continue;
    }

    try {
      sendExceptionAlert_(exceptionItem, normalizedRecipients, traceId);
      successCount += 1;
    } catch (err) {
      errors.push(buildOperatorError_('EXCEPTION_NOTIFICATION_FAILED', i,
        'An exception alert could not be delivered. Please retry or contact IT support.', err));
    }
  }

  return buildResult_(traceId, successCount, errors);
}

function getTraceId_(candidate) {
  if (candidate) {
    return String(candidate);
  }
  if (typeof generateId === 'function') {
    return generateId('TRACE');
  }
  return 'TRACE_' + new Date().getTime();
}

function validateOnboardingRow_(row, index) {
  var errors = [];
  if (!row.onboarding_id) {
    errors.push(buildOperatorError_('ONBOARDING_ID_MISSING', index,
      'Row ' + (index + 1) + ' is missing onboarding ID. Ask HR Ops to populate the onboarding_id column.'));
  }
  if (!row.employee_name) {
    errors.push(buildOperatorError_('EMPLOYEE_NAME_MISSING', index,
      'Row ' + (index + 1) + ' is missing employee name. Please complete the employee_name cell and rerun.'));
  }
  if (!isValidEmail_(row.email)) {
    errors.push(buildOperatorError_('WORK_EMAIL_INVALID', index,
      'Row ' + (index + 1) + ' has an invalid work email. Use the employee\'s company email address.'));
  }
  if (!isValidDate_(row.start_date)) {
    errors.push(buildOperatorError_('START_DATE_INVALID', index,
      'Row ' + (index + 1) + ' has an unreadable start date. Please use YYYY-MM-DD format.'));
  }
  if (!isValidEmail_(row.manager_email)) {
    errors.push(buildOperatorError_('MANAGER_EMAIL_INVALID', index,
      'Row ' + (index + 1) + ' is missing a valid manager email. Add the manager\'s work email to continue.'));
  }
  return errors;
}

function validateAuditRow_(row, index, seenKeys) {
  var errors = [];
  var entityId = String(row.entity_id || row.onboarding_id || '').trim();
  var action = String(row.action || '').trim();
  var eventTimestamp = row.event_timestamp || row.timestamp;

  if (!entityId) {
    errors.push(buildOperatorError_('AUDIT_ENTITY_MISSING', index,
      'Audit row ' + (index + 1) + ' is missing an entity ID. Please include onboarding_id or entity_id.'));
  }
  if (!action) {
    errors.push(buildOperatorError_('AUDIT_ACTION_MISSING', index,
      'Audit row ' + (index + 1) + ' is missing an action value. Add values like CREATE, UPDATE, or NOTIFY.'));
  }
  if (!isValidDate_(eventTimestamp)) {
    errors.push(buildOperatorError_('AUDIT_TIMESTAMP_INVALID', index,
      'Audit row ' + (index + 1) + ' has an invalid timestamp. Please provide a valid date/time.'));
  }

  var dedupeKey = [entityId, action, String(eventTimestamp || '')].join('|');
  if (seenKeys[dedupeKey]) {
    errors.push(buildOperatorError_('AUDIT_DUPLICATE_EVENT', index,
      'Audit row ' + (index + 1) + ' duplicates an earlier event. Remove duplicate rows before retrying.'));
  }
  seenKeys[dedupeKey] = true;

  return errors;
}

function sendExceptionAlert_(exceptionItem, recipients, traceId) {
  var to = recipients.join(',');
  var subject = '[HR Automation] Exception Alert (' + traceId + ')';
  var body = [
    'Trace ID: ' + traceId,
    'Code: ' + String(exceptionItem.code || 'UNKNOWN_ERROR'),
    'Message: ' + String(exceptionItem.message),
    'Details: ' + String(exceptionItem.details || 'No additional details provided.')
  ].join('\n');

  if (typeof MailApp !== 'undefined' && MailApp && typeof MailApp.sendEmail === 'function') {
    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: body
    });
    return;
  }

  throw new Error('Mail service unavailable');
}

function buildResult_(traceId, successCount, errors) {
  var normalizedErrors = Array.isArray(errors) ? errors : [];
  return {
    successCount: successCount,
    errorCount: normalizedErrors.length,
    errors: normalizedErrors,
    traceId: traceId
  };
}

function buildOperatorError_(code, rowIndex, message, originalError) {
  return {
    code: code,
    rowIndex: rowIndex,
    message: message,
    technicalDetails: originalError && originalError.message ? originalError.message : ''
  };
}

function isValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isValidDate_(value) {
  if (!value) {
    return false;
  }
  var dateValue = value instanceof Date ? value : new Date(value);
  return !isNaN(dateValue.getTime());
}

if (typeof module !== 'undefined') module.exports = {
  processOnboardingBatch: processOnboardingBatch,
  runAuditChecks: runAuditChecks,
  writeExecutionLog: writeExecutionLog,
  notifyExceptions: notifyExceptions
};
