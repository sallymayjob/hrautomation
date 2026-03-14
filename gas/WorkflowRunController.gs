/* global HRLib, CoreConstants, normalizeTrainingStatus */
/**
 * @fileoverview Controller/services for workflow wrapper execution concerns.
 */

function runWorkflowController_(controllerOptions) {
  var opts = controllerOptions || {};
  var handoffOutcome = applyWorkflowHandoffChecks_(opts);
  var executionPayload = handoffOutcome.payload;
  applyIdempotencyKeysForController_(executionPayload.rows, opts.dateWindow);

  opts.writeExecutionLog('STARTED', {
    rowCount: executionPayload.rows.length,
    result: null,
    errors: []
  });

  var result = HRLib[opts.libraryMethodName](executionPayload.rows, {
    sourceSheet: opts.sheetName,
    sourceWorkflow: opts.workflowName,
    runId: opts.runContext.run_id,
    runMode: opts.runMode || 'standard',
    dateWindowStartIso: opts.dateWindow.startIso,
    dateWindowEndIso: opts.dateWindow.endIso,
    runContext: opts.runContext
  });

  result = mergeHandoffFailuresIntoResultForController_(result, handoffOutcome.failures, opts.runContext.trace_id);
  writeWorkflowStatuses_(opts.statusWriterOptions, executionPayload, result);

  opts.writeExecutionLog('COMPLETED', {
    rowCount: executionPayload.rows.length,
    result: result,
    errors: []
  });

  return buildWorkflowControllerResponse_('completed', {
    result: result,
    executionPayload: executionPayload
  });
}

function buildWorkflowControllerResponse_(status, data, error) {
  var response = {
    ok: !error,
    status: String(status || ''),
    data: data || {},
    error: error || null
  };

  if (response.data && response.data.result) {
    response.result = response.data.result;
  }
  if (response.data && response.data.executionPayload) {
    response.executionPayload = response.data.executionPayload;
  }

  return response;
}

function applyWorkflowHandoffChecks_(options) {
  var opts = options || {};
  var rows = (opts.rowPayload && opts.rowPayload.rows) || [];
  var rowIndexes = (opts.rowPayload && opts.rowPayload.rowIndexes) || [];
  var failures = [];
  var filteredRows = [];
  var filteredIndexes = [];
  var dashboardRows = [];
  var stage = '';

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i] || {};
    var failureReason = '';
    if (opts.workflowName === 'Onboarding') {
      stage = 'Onboarding -> Training';
      var hasWorkEmail = !isMissingCellValueForController_(row.workemail) || !isMissingCellValueForController_(row.work_email) || !isMissingCellValueForController_(row.email);
      var hasStartDate = !isMissingCellValueForController_(row.startdate) || !isMissingCellValueForController_(row.start_date);
      if (!hasWorkEmail || !hasStartDate) {
        failureReason = 'Onboarding -> Training requires WorkEmail and StartDate.';
      }
    } else if (opts.workflowName === 'Training Sync') {
      stage = 'Training -> Audit';
      if (normalizeTrainingStatus(row.trainingstatus || row.training_status) !== CoreConstants.STATUSES.COMPLETED) {
        failureReason = 'Training -> Audit requires TrainingStatus = COMPLETED (alias COMPLETE accepted).';
      }
    }

    if (failureReason) {
      var employeeId = resolveEmployeeIdForController_(row);
      failures.push({
        code: 'HANDOFF_CHECK_FAILED',
        rowIndex: filteredRows.length,
        employeeId: employeeId,
        message: failureReason
      });

      opts.appendException({
        traceId: opts.runContext.trace_id,
        sheet: opts.sheetName,
        employeeId: employeeId,
        reason: failureReason
      });

      var ageDays = getDaysSinceForController_(row.startdate || row.start_date || row.assigned_date || row.trainingassigneddate || row.last_updated_at);
      var slaDays = stage === 'Onboarding -> Training' ? opts.handoffSlaDays.onboarding_to_training : opts.handoffSlaDays.training_to_audit;
      if (ageDays !== null && ageDays > slaDays) {
        dashboardRows.push([stage, employeeId, ageDays, slaDays, failureReason]);
      }
      continue;
    }

    filteredRows.push(row);
    filteredIndexes.push(rowIndexes[i]);
  }

  if (stage) {
    opts.writeHandoffDashboard(stage, dashboardRows);
  }

  return {
    failures: failures,
    payload: {
      headers: opts.rowPayload.headers,
      rows: filteredRows,
      rowIndexes: filteredIndexes
    }
  };
}

function writeWorkflowStatuses_(options, rowPayload, result) {
  var opts = options || {};
  var headerMap = buildHeaderMapForController_(rowPayload.headers);
  var statusColumnIndex = headerMap[normalizeHeaderKeyForController_(opts.statusColumnName)] || 0;
  var traceColumnIndex = headerMap.trace_id || 0;
  if (!statusColumnIndex && !traceColumnIndex) {
    return;
  }

  var rowIndexes = rowPayload.rowIndexes;
  var successCount = Number(result.successCount || 0);
  var errorByRow = indexErrorsByRowForController_(result.errors || []);
  for (var i = 0; i < rowIndexes.length; i += 1) {
    var rowNumber = rowIndexes[i];
    var rowError = errorByRow[i];

    if (statusColumnIndex) {
      var status = rowError ? CoreConstants.STATUSES.BLOCKED : (i < successCount ? CoreConstants.STATUSES.COMPLETE : CoreConstants.STATUSES.PENDING);
      opts.repository.setCellValue(opts.sheet, rowNumber, statusColumnIndex, status);
    }
    if (traceColumnIndex) {
      opts.repository.setCellValue(opts.sheet, rowNumber, traceColumnIndex, result.traceId || '');
    }
  }
}

function applyIdempotencyKeysForController_(rows, dateWindow) {
  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    row.idempotency_key = buildIdempotencyKeyForController_(row, dateWindow);
  }
}

function buildIdempotencyKeyForController_(row, dateWindow) {
  var entityId = String(row.employee_id || row.employeeid || row.onboarding_id || row.entity_id || 'unknown');
  return entityId + '|' + String(dateWindow.startIso || '') + '|' + String(dateWindow.endIso || '');
}

function mergeHandoffFailuresIntoResultForController_(result, handoffFailures, fallbackTraceId) {
  var merged = result || {};
  merged.errors = (merged.errors || []).concat(handoffFailures || []);
  merged.errorCount = Number(merged.errorCount || 0) + Number((handoffFailures || []).length);
  merged.traceId = merged.traceId || fallbackTraceId;
  return merged;
}

function resolveEmployeeIdForController_(row) {
  return String(row.employee_id || row.employeeid || row.onboarding_id || row.onboardingid || row.training_id || row.trainingid || 'unknown');
}

function isMissingCellValueForController_(value) {
  return String(value || '').trim() === '';
}

function getDaysSinceForController_(value) {
  if (!value) {
    return null;
  }
  var parsedDate = value instanceof Date ? value : new Date(value);
  if (!(parsedDate instanceof Date) || isNaN(parsedDate.getTime())) {
    return null;
  }
  var elapsedMs = new Date().getTime() - parsedDate.getTime();
  return Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
}

function indexErrorsByRowForController_(errors) {
  var indexed = {};
  for (var i = 0; i < errors.length; i += 1) {
    var rowIndex = Number(errors[i] && errors[i].rowIndex);
    if (!isNaN(rowIndex)) {
      indexed[rowIndex] = true;
    }
  }
  return indexed;
}

function buildHeaderMapForController_(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i += 1) {
    map[normalizeHeaderKeyForController_(headers[i])] = i + 1;
  }
  return map;
}

function normalizeHeaderKeyForController_(headerValue) {
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

if (typeof module !== 'undefined') module.exports = {
  runWorkflowController_: runWorkflowController_,
  applyWorkflowHandoffChecks_: applyWorkflowHandoffChecks_,
  writeWorkflowStatuses_: writeWorkflowStatuses_
};
