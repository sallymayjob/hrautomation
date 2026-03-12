/* global Config, SpreadsheetApp, MailApp, Session, HRLib, console */
/**
 * @fileoverview Thin spreadsheet wrappers around shared HR library entry points.
 */

var LIBRARY_RUN_LOG_SHEET = 'Library Runs';

function runOnboarding() {
  return runLibraryWorkflow_({
    workflowName: 'Onboarding',
    spreadsheetId: Config.getOnboardingSpreadsheetId(),
    sheetName: Config.getOnboardingSheetName(),
    libraryMethodName: 'processOnboardingBatch',
    statusColumnName: 'status'
  });
}

function runAudit() {
  return runLibraryWorkflow_({
    workflowName: 'Audit',
    spreadsheetId: Config.getAuditSpreadsheetId(),
    sheetName: Config.getAuditSheetName(),
    libraryMethodName: 'runAuditChecks',
    statusColumnName: ''
  });
}

function runLibraryWorkflow_(options) {
  var opts = options || {};
  assertLibraryAvailable_();

  var spreadsheet = SpreadsheetApp.openById(opts.spreadsheetId);
  var sheet = spreadsheet.getSheetByName(opts.sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + opts.sheetName);
  }

  var rowPayload = readSheetRows_(sheet);
  var rows = rowPayload.rows;
  var result = HRLib[opts.libraryMethodName](rows, {
    sourceSheet: opts.sheetName,
    sourceWorkflow: opts.workflowName
  });

  writeRowStatuses_(sheet, rowPayload, result, opts.statusColumnName);
  appendWorkflowRunLog_(spreadsheet, opts.workflowName, result, rows.length);
  sendWorkflowSummaryEmail_(opts.workflowName, rows.length, result);

  return result;
}

function readSheetRows_(sheet) {
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (values.length < 2) {
    return {
      headers: values.length === 1 ? values[0] : [],
      rows: [],
      rowIndexes: []
    };
  }

  var headers = values[0];
  var rows = [];
  var rowIndexes = [];
  for (var row = 1; row < values.length; row += 1) {
    var source = values[row];
    if (isBlankRow_(source)) {
      continue;
    }

    rows.push(mapRowToObject_(headers, source));
    rowIndexes.push(row + 1);
  }

  return {
    headers: headers,
    rows: rows,
    rowIndexes: rowIndexes
  };
}

function mapRowToObject_(headers, values) {
  var mapped = {};
  for (var col = 0; col < headers.length; col += 1) {
    var key = normalizeHeaderKey_(headers[col]);
    if (!key) {
      continue;
    }
    mapped[key] = values[col];
  }
  return mapped;
}

function normalizeHeaderKey_(headerValue) {
  var normalized = String(headerValue || '').trim();
  if (!normalized) {
    return '';
  }

  return normalized
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function isBlankRow_(rowValues) {
  for (var i = 0; i < rowValues.length; i += 1) {
    if (String(rowValues[i] || '').trim() !== '') {
      return false;
    }
  }
  return true;
}

function writeRowStatuses_(sheet, rowPayload, result, statusColumnName) {
  var headerMap = buildHeaderMap_(rowPayload.headers);
  var statusColumnIndex = headerMap[normalizeHeaderKey_(statusColumnName)] || 0;
  var traceColumnIndex = headerMap.trace_id || 0;
  if (!statusColumnIndex && !traceColumnIndex) {
    return;
  }

  var rowIndexes = rowPayload.rowIndexes;
  var successCount = Number(result.successCount || 0);
  var errorByRow = indexErrorsByRow_(result.errors || []);
  for (var i = 0; i < rowIndexes.length; i += 1) {
    var rowNumber = rowIndexes[i];
    var rowError = errorByRow[i];

    if (statusColumnIndex) {
      var status = rowError ? 'BLOCKED' : (i < successCount ? 'COMPLETE' : 'PENDING');
      sheet.getRange(rowNumber, statusColumnIndex).setValue(status);
    }
    if (traceColumnIndex) {
      sheet.getRange(rowNumber, traceColumnIndex).setValue(result.traceId || '');
    }
  }
}

function appendWorkflowRunLog_(spreadsheet, workflowName, result, rowCount) {
  var logSheet = spreadsheet.getSheetByName(LIBRARY_RUN_LOG_SHEET);
  if (!logSheet) {
    logSheet = spreadsheet.insertSheet(LIBRARY_RUN_LOG_SHEET);
    logSheet.appendRow(['timestamp', 'workflow', 'rows_read', 'success_count', 'error_count', 'trace_id']);
  }

  logSheet.appendRow([
    new Date(),
    workflowName,
    Number(rowCount || 0),
    Number(result.successCount || 0),
    Number(result.errorCount || 0),
    String(result.traceId || '')
  ]);
}

function sendWorkflowSummaryEmail_(workflowName, rowCount, result) {
  var recipient = Config.getHrAlertEmail();
  var actor = Session && Session.getActiveUser && Session.getActiveUser().getEmail ? Session.getActiveUser().getEmail() : 'system';
  var subject = '[HR Automation] ' + workflowName + ' run summary (' + String(result.traceId || 'no-trace') + ')';
  var body = [
    'Workflow: ' + workflowName,
    'Triggered by: ' + actor,
    'Rows read: ' + Number(rowCount || 0),
    'Successful rows: ' + Number(result.successCount || 0),
    'Errors: ' + Number(result.errorCount || 0)
  ].join('\n');

  MailApp.sendEmail({
    to: recipient,
    subject: subject,
    body: body
  });
}

function indexErrorsByRow_(errors) {
  var indexed = {};
  for (var i = 0; i < errors.length; i += 1) {
    var rowIndex = Number(errors[i] && errors[i].rowIndex);
    if (!isNaN(rowIndex)) {
      indexed[rowIndex] = true;
    }
  }
  return indexed;
}

function buildHeaderMap_(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i += 1) {
    map[normalizeHeaderKey_(headers[i])] = i + 1;
  }
  return map;
}

function assertLibraryAvailable_() {
  if (typeof HRLib === 'undefined' || !HRLib || typeof HRLib.processOnboardingBatch !== 'function' || typeof HRLib.runAuditChecks !== 'function') {
    throw new Error('HRLib library is not available. Add the shared HR library with identifier "HRLib" and pinned version.');
  }
}

if (typeof module !== 'undefined') module.exports = {
  runOnboarding: runOnboarding,
  runAudit: runAudit,
  runLibraryWorkflow_: runLibraryWorkflow_,
  readSheetRows_: readSheetRows_,
  mapRowToObject_: mapRowToObject_,
  normalizeHeaderKey_: normalizeHeaderKey_,
  writeRowStatuses_: writeRowStatuses_,
  indexErrorsByRow_: indexErrorsByRow_,
  buildHeaderMap_: buildHeaderMap_,
  assertLibraryAvailable_: assertLibraryAvailable_
};
