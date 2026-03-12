/* global Config, SpreadsheetApp, MailApp, Session, HRLib, console, LockService */
/**
 * @fileoverview Thin spreadsheet wrappers around shared HR library entry points.
 */

var DEFAULT_BATCH_LIMIT = 200;
var DEFAULT_MAX_RUNTIME_MS = 5 * 60 * 1000;
var DEFAULT_LOCK_WAIT_MS = 5000;

function runOnboarding() {
  return runLibraryWorkflow_({
    workflowName: 'Onboarding',
    spreadsheetId: Config.getOnboardingSpreadsheetId(),
    sheetName: Config.getOnboardingSheetName(),
    libraryMethodName: 'processOnboardingBatch',
    statusColumnName: 'status',
    batchLimit: 100,
    maxRuntimeMs: 3 * 60 * 1000,
    dateWindowMinutes: 15
  });
}

function runAudit() {
  return runLibraryWorkflow_({
    workflowName: 'Audit',
    spreadsheetId: Config.getAuditSpreadsheetId(),
    sheetName: Config.getAuditSheetName(),
    libraryMethodName: 'runAuditChecks',
    statusColumnName: '',
    batchLimit: 500,
    maxRuntimeMs: 5 * 60 * 1000,
    dateWindowMinutes: 24 * 60
  });
}

function runAuditDeepWeekly() {
  return runLibraryWorkflow_({
    workflowName: 'Audit Deep Weekly',
    spreadsheetId: Config.getAuditSpreadsheetId(),
    sheetName: Config.getAuditSheetName(),
    libraryMethodName: 'runAuditChecks',
    statusColumnName: '',
    batchLimit: 1000,
    maxRuntimeMs: 10 * 60 * 1000,
    dateWindowMinutes: 7 * 24 * 60,
    runMode: 'deep_weekly'
  });
}

function runLibraryWorkflow_(options) {
  var opts = options || {};
  assertLibraryAvailable_();
  var runId = createRunId_();
  var startedAtMs = new Date().getTime();
  var lock = acquireWorkflowLock_(opts.workflowName, runId, opts.lockWaitMs || DEFAULT_LOCK_WAIT_MS);

  try {
    var spreadsheet = SpreadsheetApp.openById(opts.spreadsheetId);
    var sheet = spreadsheet.getSheetByName(opts.sheetName);
    if (!sheet) {
      throw new Error('Sheet not found: ' + opts.sheetName);
    }

    var rowPayload = readSheetRows_(sheet, opts.batchLimit || DEFAULT_BATCH_LIMIT);
    var dateWindow = createDateWindow_(opts.dateWindowMinutes, new Date());
    applyIdempotencyKeys_(rowPayload.rows, dateWindow);
    writeWorkflowExecutionLog_(spreadsheet, opts, runId, 'STARTED', {
      rowCount: rowPayload.rows.length,
      result: null,
      errors: []
    });
    logWorkflowEvent_(opts.workflowName, runId, 'STARTED', 'rows=' + rowPayload.rows.length);

    enforceRuntimeBudget_(opts.workflowName, startedAtMs, opts.maxRuntimeMs || DEFAULT_MAX_RUNTIME_MS);
    var result = HRLib[opts.libraryMethodName](rowPayload.rows, {
      sourceSheet: opts.sheetName,
      sourceWorkflow: opts.workflowName,
      runId: runId,
      runMode: opts.runMode || 'standard',
      dateWindowStartIso: dateWindow.startIso,
      dateWindowEndIso: dateWindow.endIso
    });
    enforceRuntimeBudget_(opts.workflowName, startedAtMs, opts.maxRuntimeMs || DEFAULT_MAX_RUNTIME_MS);

    writeRowStatuses_(sheet, rowPayload, result, opts.statusColumnName);
    writeWorkflowExecutionLog_(spreadsheet, opts, runId, 'COMPLETED', {
      rowCount: rowPayload.rows.length,
      result: result,
      errors: []
    });
    logWorkflowEvent_(opts.workflowName, runId, 'COMPLETED', 'success=' + Number(result.successCount || 0) + ', errors=' + Number(result.errorCount || 0));
    sendWorkflowSummaryEmail_(opts.workflowName, rowPayload.rows.length, result, runId);

    return result;
  } catch (err) {
    if (opts && opts.spreadsheetId) {
      var failedSpreadsheet = SpreadsheetApp.openById(opts.spreadsheetId);
      writeWorkflowExecutionLog_(failedSpreadsheet, opts, runId, 'FAILED', {
        rowCount: 0,
        result: null,
        errors: [{ code: 'WORKFLOW_FAILED', rowIndex: 0, message: String(err && err.message ? err.message : err), technicalDetails: '' }]
      });
    }
    logWorkflowEvent_(opts.workflowName, runId, 'FAILED', String(err && err.message ? err.message : err));
    throw err;
  } finally {
    if (lock) {
      lock.releaseLock();
    }
  }
}

function readSheetRows_(sheet, batchLimit) {
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
  var safeBatchLimit = Number(batchLimit || DEFAULT_BATCH_LIMIT);
  for (var row = 1; row < values.length; row += 1) {
    var source = values[row];
    if (isBlankRow_(source)) {
      continue;
    }

    rows.push(mapRowToObject_(headers, source));
    rowIndexes.push(row + 1);

    if (rows.length >= safeBatchLimit) {
      break;
    }
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

function writeWorkflowExecutionLog_(spreadsheet, workflowOptions, runId, phase, details) {
  var opts = workflowOptions || {};
  var log = details || {};
  var result = log.result || {};
  var traceId = String(result.traceId || runId || '');
  var entries = [
    {
      timestamp: new Date(),
      spreadsheetType: String(opts.workflowName || 'Unknown'),
      function: String(opts.libraryMethodName || 'unknown'),
      traceId: traceId,
      recordKey: String(runId || ''),
      result: String(phase || 'COMPLETED'),
      errorMessage: ''
    }
  ];

  var rowErrors = Array.isArray(log.errors) ? log.errors : [];
  var resultErrors = Array.isArray(result.errors) ? result.errors : [];
  var errors = rowErrors.concat(resultErrors);
  for (var i = 0; i < errors.length; i += 1) {
    var entryError = errors[i] || {};
    entries.push({
      timestamp: new Date(),
      spreadsheetType: String(opts.workflowName || 'Unknown'),
      function: String(opts.libraryMethodName || 'unknown'),
      traceId: traceId,
      recordKey: String(entryError.rowIndex || runId || ''),
      result: 'FAILED',
      errorMessage: String(entryError.message || entryError.technicalDetails || 'Unknown failure')
    });
  }

  HRLib.writeExecutionLog({
    spreadsheet: spreadsheet,
    spreadsheetType: opts.workflowName,
    functionName: opts.libraryMethodName,
    traceId: traceId,
    runId: runId,
    entries: entries
  }, {
    traceId: traceId,
    successCount: Number(result.successCount || 0),
    errorCount: Number(result.errorCount || errors.length),
    errors: errors
  });
}

function sendWorkflowSummaryEmail_(workflowName, rowCount, result, runId) {
  var recipient = Config.getHrAlertEmail();
  var actor = Session && Session.getActiveUser && Session.getActiveUser().getEmail ? Session.getActiveUser().getEmail() : 'system';
  var subject = '[HR Automation] ' + workflowName + ' run summary (' + String(result.traceId || 'no-trace') + ')';
  var body = [
    'Workflow: ' + workflowName,
    'Run ID: ' + String(runId || ''),
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

function createDateWindow_(windowMinutes, anchorDate) {
  var effectiveWindowMinutes = Number(windowMinutes || 0);
  if (effectiveWindowMinutes <= 0) {
    effectiveWindowMinutes = 60;
  }
  var windowMs = effectiveWindowMinutes * 60 * 1000;
  var now = anchorDate instanceof Date ? anchorDate : new Date();
  var nowMs = now.getTime();
  var windowEndMs = Math.floor(nowMs / windowMs) * windowMs;
  var windowStartMs = windowEndMs - windowMs;

  return {
    startIso: new Date(windowStartMs).toISOString(),
    endIso: new Date(windowEndMs).toISOString()
  };
}

function applyIdempotencyKeys_(rows, dateWindow) {
  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    row.idempotency_key = buildIdempotencyKey_(row, dateWindow);
  }
}

function buildIdempotencyKey_(row, dateWindow) {
  var entityId = String(row.employee_id || row.employeeid || row.onboarding_id || row.entity_id || 'unknown');
  return entityId + '|' + String(dateWindow.startIso || '') + '|' + String(dateWindow.endIso || '');
}

function createRunId_() {
  return 'RUN-' + new Date().toISOString() + '-' + Math.floor(Math.random() * 1000000);
}

function acquireWorkflowLock_(workflowName, runId, waitMs) {
  if (typeof LockService === 'undefined' || !LockService || typeof LockService.getScriptLock !== 'function') {
    return null;
  }

  var lock = LockService.getScriptLock();
  var locked = lock.tryLock(Number(waitMs || DEFAULT_LOCK_WAIT_MS));
  if (!locked) {
    throw new Error('Skipped ' + workflowName + ' run (' + runId + ') because another run is in progress.');
  }
  return lock;
}

function enforceRuntimeBudget_(workflowName, startedAtMs, maxRuntimeMs) {
  var elapsed = new Date().getTime() - Number(startedAtMs || 0);
  var budget = Number(maxRuntimeMs || DEFAULT_MAX_RUNTIME_MS);
  if (elapsed > budget) {
    throw new Error(workflowName + ' exceeded max runtime budget of ' + budget + 'ms.');
  }
}

function logWorkflowEvent_(workflowName, runId, phase, message) {
  console.log('[Workflow:' + workflowName + '][' + runId + '][' + phase + '] ' + message);
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
  if (typeof HRLib === 'undefined' || !HRLib || typeof HRLib.processOnboardingBatch !== 'function' || typeof HRLib.runAuditChecks !== 'function' || typeof HRLib.writeExecutionLog !== 'function') {
    throw new Error('HRLib library is not available. Add the shared HR library with identifier "HRLib" and pinned version.');
  }
}

if (typeof module !== 'undefined') module.exports = {
  runOnboarding: runOnboarding,
  runAudit: runAudit,
  runAuditDeepWeekly: runAuditDeepWeekly,
  runLibraryWorkflow_: runLibraryWorkflow_,
  readSheetRows_: readSheetRows_,
  mapRowToObject_: mapRowToObject_,
  normalizeHeaderKey_: normalizeHeaderKey_,
  writeRowStatuses_: writeRowStatuses_,
  buildIdempotencyKey_: buildIdempotencyKey_,
  writeWorkflowExecutionLog_: writeWorkflowExecutionLog_,
  indexErrorsByRow_: indexErrorsByRow_,
  buildHeaderMap_: buildHeaderMap_,
  assertLibraryAvailable_: assertLibraryAvailable_
};
