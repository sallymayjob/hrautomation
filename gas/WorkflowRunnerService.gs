/* global SpreadsheetApp, LockService */
/**
 * @fileoverview Shared runner orchestration for spreadsheet-backed workflows.
 */

var DEFAULT_BATCH_LIMIT = 200;
var DEFAULT_MAX_RUNTIME_MS = 5 * 60 * 1000;
var DEFAULT_LOCK_WAIT_MS = 5000;

function runWorkflowRunner_(runnerInput) {
  var input = runnerInput || {};
  var callbacks = input.callbacks || {};
  if (!input.workflowName) {
    throw new Error('workflowName is required for runWorkflowRunner_.');
  }
  if (!input.spreadsheetId || !input.sheetName) {
    throw new Error('spreadsheetId and sheetName are required for runWorkflowRunner_.');
  }
  if (typeof input.execute !== 'function') {
    throw new Error('execute callback is required for runWorkflowRunner_.');
  }

  if (typeof callbacks.assertReady === 'function') {
    callbacks.assertReady(input);
  }

  var runId = createRunId_();
  var runContext = {
    trace_id: runId,
    run_id: runId,
    source: String(input.workflowName)
  };
  var startedAtMs = new Date().getTime();
  var lock = acquireWorkflowLock_(input.workflowName, runId, input.lockWaitMs || DEFAULT_LOCK_WAIT_MS);

  try {
    var spreadsheet = SpreadsheetApp.openById(input.spreadsheetId);
    var sheet = spreadsheet.getSheetByName(input.sheetName);
    if (!sheet) {
      throw new Error('Sheet not found: ' + input.sheetName);
    }

    var rowPayload = readSheetRows_(sheet, input.batchLimit || DEFAULT_BATCH_LIMIT);
    var dateWindow = createDateWindow_(input.dateWindowMinutes, new Date());
    if (typeof input.rowAdapter === 'function') {
      rowPayload = input.rowAdapter(rowPayload, {
        workflowName: input.workflowName,
        runContext: runContext,
        spreadsheet: spreadsheet,
        sheet: sheet,
        dateWindow: dateWindow
      }) || rowPayload;
    }

    enforceRuntimeBudget_(input.workflowName, startedAtMs, input.maxRuntimeMs || DEFAULT_MAX_RUNTIME_MS);
    if (typeof callbacks.onTelemetry === 'function') {
      callbacks.onTelemetry('STARTED', {
        workflowName: input.workflowName,
        runId: runId,
        rowCount: rowPayload.rows.length,
        elapsedMs: new Date().getTime() - startedAtMs
      });
    }

    var executionResult = input.execute({
      workflowName: input.workflowName,
      spreadsheet: spreadsheet,
      sheet: sheet,
      runId: runId,
      runContext: runContext,
      rowPayload: rowPayload,
      dateWindow: dateWindow
    }) || {};

    enforceRuntimeBudget_(input.workflowName, startedAtMs, input.maxRuntimeMs || DEFAULT_MAX_RUNTIME_MS);

    if (typeof callbacks.onTelemetry === 'function') {
      callbacks.onTelemetry('COMPLETED', {
        workflowName: input.workflowName,
        runId: runId,
        rowCount: rowPayload.rows.length,
        elapsedMs: new Date().getTime() - startedAtMs,
        result: executionResult.result || null
      });
    }

    if (typeof callbacks.onCompleted === 'function') {
      callbacks.onCompleted({
        input: input,
        spreadsheet: spreadsheet,
        runId: runId,
        rowPayload: rowPayload,
        executionResult: executionResult,
        runContext: runContext
      });
    }

    return executionResult.result;
  } catch (err) {
    if (typeof callbacks.onTelemetry === 'function') {
      callbacks.onTelemetry('FAILED', {
        workflowName: input.workflowName,
        runId: runId,
        elapsedMs: new Date().getTime() - startedAtMs,
        error: String(err && err.message ? err.message : err)
      });
    }
    if (typeof callbacks.onFailed === 'function') {
      callbacks.onFailed({
        input: input,
        runId: runId,
        runContext: runContext,
        error: err
      });
    }
    throw err;
  } finally {
    if (lock) {
      lock.releaseLock();
    }
    if (typeof callbacks.onFinally === 'function') {
      callbacks.onFinally({
        input: input,
        runId: runId,
        runContext: runContext
      });
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

if (typeof module !== 'undefined') module.exports = {
  runWorkflowRunner_: runWorkflowRunner_,
  readSheetRows_: readSheetRows_,
  mapRowToObject_: mapRowToObject_,
  normalizeHeaderKey_: normalizeHeaderKey_,
  createDateWindow_: createDateWindow_,
  createRunId_: createRunId_,
  acquireWorkflowLock_: acquireWorkflowLock_,
  enforceRuntimeBudget_: enforceRuntimeBudget_
};
