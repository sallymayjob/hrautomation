/* global Config, SpreadsheetApp, MailApp, Session, HRLib, console, WorkflowSheetRepository, runWorkflowController_, runOnboardingBusinessHours_, runWorkflowRunner_, SheetClient */
/**
 * @fileoverview Thin spreadsheet wrappers around shared HR library entry points.
 */

var DEFAULT_BATCH_LIMIT = 200;
var DEFAULT_MAX_RUNTIME_MS = 5 * 60 * 1000;
var DEFAULT_LOCK_WAIT_MS = 5000;
var EXCEPTIONS_SHEET_NAME = 'Exceptions';
var HANDOFF_DASHBOARD_SHEET_NAME = 'Handoff Dashboard';
var HANDOFF_SLA_DAYS = {
  onboarding_to_training: 2,
  training_to_audit: 7
};

var WorkflowRunBindings_ = null;
if (typeof require === 'function') {
  WorkflowRunBindings_ = {
    repository: require('./WorkflowSheetRepository.gs'),
    controller: require('./WorkflowRunController.gs'),
    onboardingController: require('./OnboardingController.gs'),
    runnerService: require('./WorkflowRunnerService.gs')
  };
}

function getWorkflowSheetRepositoryCtor_() {
  if (typeof WorkflowSheetRepository !== 'undefined') {
    return WorkflowSheetRepository;
  }
  return WorkflowRunBindings_ && WorkflowRunBindings_.repository && WorkflowRunBindings_.repository.WorkflowSheetRepository;
}

function getWorkflowControllerFn_() {
  if (typeof runWorkflowController_ !== 'undefined') {
    return runWorkflowController_;
  }
  return WorkflowRunBindings_ && WorkflowRunBindings_.controller && WorkflowRunBindings_.controller.runWorkflowController_;
}

function getWorkflowRunnerFn_() {
  if (typeof runWorkflowRunner_ !== 'undefined') {
    return runWorkflowRunner_;
  }
  return WorkflowRunBindings_ && WorkflowRunBindings_.runnerService && WorkflowRunBindings_.runnerService.runWorkflowRunner_;
}

function getWorkflowRunnerService_() {
  return WorkflowRunBindings_ && WorkflowRunBindings_.runnerService;
}

function resolveRunnerHelper_(helperName) {
  if (typeof globalThis !== 'undefined' && typeof globalThis[helperName] === 'function') {
    return globalThis[helperName];
  }
  var service = getWorkflowRunnerService_();
  return service && service[helperName];
}

function getOnboardingBusinessHoursRunner_() {
  if (typeof runOnboardingBusinessHours_ !== 'undefined') {
    return runOnboardingBusinessHours_;
  }
  return WorkflowRunBindings_ && WorkflowRunBindings_.onboardingController && WorkflowRunBindings_.onboardingController.runOnboardingBusinessHours_;
}

function runOnboardingBusinessHours() {
  var runner = getOnboardingBusinessHoursRunner_();
  return runner(runOnboarding);
}

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

function runTrainingAssignments() {
  return runLibraryWorkflow_({
    workflowName: 'Training Assignments',
    spreadsheetId: Config.getTrainingSpreadsheetId(),
    sheetName: Config.getTrainingSheetName(),
    libraryMethodName: 'processTrainingAssignments',
    statusColumnName: 'training_status',
    batchLimit: 200,
    maxRuntimeMs: 5 * 60 * 1000,
    dateWindowMinutes: 24 * 60,
    logSheetName: 'Logs'
  });
}

function runTrainingReminders() {
  return runLibraryWorkflow_({
    workflowName: 'Training Reminders',
    spreadsheetId: Config.getTrainingSpreadsheetId(),
    sheetName: Config.getTrainingSheetName(),
    libraryMethodName: 'runTrainingReminders',
    statusColumnName: 'training_status',
    batchLimit: 200,
    maxRuntimeMs: 5 * 60 * 1000,
    dateWindowMinutes: 24 * 60,
    logSheetName: 'Logs'
  });
}

function runTrainingSync() {
  return runLibraryWorkflow_({
    workflowName: 'Training Sync',
    spreadsheetId: Config.getTrainingSpreadsheetId(),
    sheetName: Config.getTrainingSheetName(),
    libraryMethodName: 'syncTrainingCompletion',
    statusColumnName: 'training_status',
    batchLimit: 500,
    maxRuntimeMs: 7 * 60 * 1000,
    dateWindowMinutes: 4 * 60,
    logSheetName: 'Logs'
  });
}

function runLibraryWorkflow_(options) {
  var opts = options || {};
  var WorkflowSheetRepositoryCtor = getWorkflowSheetRepositoryCtor_();
  var workflowController = getWorkflowControllerFn_();
  var workflowRunner = getWorkflowRunnerFn_();

  return workflowRunner({
    workflowName: opts.workflowName,
    spreadsheetId: opts.spreadsheetId,
    sheetName: opts.sheetName,
    batchLimit: opts.batchLimit || DEFAULT_BATCH_LIMIT,
    maxRuntimeMs: opts.maxRuntimeMs || DEFAULT_MAX_RUNTIME_MS,
    lockWaitMs: opts.lockWaitMs || DEFAULT_LOCK_WAIT_MS,
    dateWindowMinutes: opts.dateWindowMinutes,
    rowAdapter: opts.rowAdapter,
    callbacks: {
      assertReady: function () {
        assertLibraryAvailable_();
        var sheetClient = new SheetClient();
        sheetClient.validateWriteSchema_(opts.sheetName, { operation: 'workflow_wrapper_preflight', workflowName: opts.workflowName });
      },
      onTelemetry: function (phase, details) {
        logWorkflowEvent_(opts.workflowName, details.runId, phase, 'elapsed_ms=' + Number(details.elapsedMs || 0));
      },
      onCompleted: function (runnerContext) {
        var executionResult = runnerContext.executionResult;
        var result = executionResult.result;
        var executionPayload = executionResult.executionPayload;
        var workflowRepository = new WorkflowSheetRepositoryCtor(runnerContext.spreadsheet);
        appendRunSummaryToLogsTab_(workflowRepository, opts, runnerContext.runId, executionPayload.rows.length, result, 'COMPLETED');
        sendWorkflowSummaryEmail_(opts.workflowName, executionPayload.rows.length, result, runnerContext.runId);
      },
      onFailed: function (runnerContext) {
        var failedSpreadsheet = SpreadsheetApp.openById(opts.spreadsheetId);
        writeWorkflowExecutionLog_(failedSpreadsheet, opts, runnerContext.runId, 'FAILED', {
          rowCount: 0,
          result: null,
          errors: [{ code: 'WORKFLOW_FAILED', rowIndex: 0, message: String(runnerContext.error && runnerContext.error.message ? runnerContext.error.message : runnerContext.error), technicalDetails: '' }]
        });
        appendRunSummaryToLogsTab_(new WorkflowSheetRepositoryCtor(failedSpreadsheet), opts, runnerContext.runId, 0, null, 'FAILED');
      }
    },
    execute: function (runnerContext) {
      var workflowRepository = new WorkflowSheetRepositoryCtor(runnerContext.spreadsheet);
      return workflowController({
        workflowName: opts.workflowName,
        sheetName: opts.sheetName,
        libraryMethodName: opts.libraryMethodName,
        runMode: opts.runMode,
        runContext: runnerContext.runContext,
        rowPayload: runnerContext.rowPayload,
        dateWindow: runnerContext.dateWindow,
        handoffSlaDays: HANDOFF_SLA_DAYS,
        statusWriterOptions: {
          repository: workflowRepository,
          sheet: runnerContext.sheet,
          statusColumnName: opts.statusColumnName
        },
        appendException: function (entry) {
          appendExceptionLog_(workflowRepository, entry);
        },
        writeHandoffDashboard: function (stage, rows) {
          writeHandoffDashboard_(workflowRepository, stage, rows);
        },
        writeExecutionLog: function (phase, details) {
          writeWorkflowExecutionLog_(runnerContext.spreadsheet, opts, runnerContext.runId, phase, details);
        }
      });
    }
  });
}

function mergeHandoffFailuresIntoResult_(result, handoffFailures, fallbackTraceId) {
  var merged = result || {};
  merged.errors = (merged.errors || []).concat(handoffFailures || []);
  merged.errorCount = Number(merged.errorCount || 0) + Number((handoffFailures || []).length);
  merged.traceId = merged.traceId || fallbackTraceId;
  return merged;
}

function appendExceptionLog_(repository, exceptionEntry) {
  if (repository.getLastRow(EXCEPTIONS_SHEET_NAME) === 0) {
    repository.appendRow(EXCEPTIONS_SHEET_NAME, ['timestamp', 'traceId', 'sheet', 'employeeId', 'reason']);
  }
  repository.appendRow(EXCEPTIONS_SHEET_NAME, [
    new Date(),
    String(exceptionEntry.traceId || ''),
    String(exceptionEntry.sheet || ''),
    String(exceptionEntry.employeeId || ''),
    String(exceptionEntry.reason || '')
  ]);
}

function writeHandoffDashboard_(repository, stage, rows) {
  repository.clearSheet(HANDOFF_DASHBOARD_SHEET_NAME);
  repository.appendRow(HANDOFF_DASHBOARD_SHEET_NAME, ['stage', 'employee_id', 'days_stuck', 'sla_days', 'reason']);

  if (!rows || rows.length === 0) {
    repository.appendRow(HANDOFF_DASHBOARD_SHEET_NAME, [String(stage || ''), '', 0, 0, 'No employees currently above SLA threshold']);
    return;
  }

  for (var i = 0; i < rows.length; i += 1) {
    repository.appendRow(HANDOFF_DASHBOARD_SHEET_NAME, rows[i]);
  }
}

function resolveEmployeeId_(row) {
  return String(row.employee_id || row.employeeid || row.onboarding_id || row.onboardingid || row.training_id || row.trainingid || 'unknown');
}

function isMissingCellValue_(value) {
  return String(value || '').trim() === '';
}

function getDaysSince_(value) {
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

function appendRunSummaryToLogsTab_(repository, workflowOptions, runId, rowCount, result, phase) {
  var opts = workflowOptions || {};
  var sheetName = String(opts.logSheetName || 'Logs');
  if (repository.getLastRow(sheetName) === 0) {
    repository.appendRow(sheetName, ['timestamp', 'workflow', 'function', 'run_id', 'trace_id', 'rows_read', 'success_count', 'error_count', 'status']);
  }

  var normalizedResult = result || {};
  repository.appendRow(sheetName, [
    new Date(),
    String(opts.workflowName || 'Unknown'),
    String(opts.libraryMethodName || 'unknown'),
    String(runId || ''),
    String(normalizedResult.traceId || runId || ''),
    Number(rowCount || 0),
    Number(normalizedResult.successCount || 0),
    Number(normalizedResult.errorCount || 0),
    String(phase || 'COMPLETED')
  ]);
}





function readSheetRows_(sheet, batchLimit) {
  return resolveRunnerHelper_('readSheetRows_')(sheet, batchLimit);
}

function mapRowToObject_(headers, values) {
  return resolveRunnerHelper_('mapRowToObject_')(headers, values);
}

function normalizeHeaderKey_(headerValue) {
  return resolveRunnerHelper_('normalizeHeaderKey_')(headerValue);
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
  if (typeof HRLib === 'undefined' ||
    !HRLib ||
    typeof HRLib.processOnboardingBatch !== 'function' ||
    typeof HRLib.runAuditChecks !== 'function' ||
    typeof HRLib.processTrainingAssignments !== 'function' ||
    typeof HRLib.runTrainingReminders !== 'function' ||
    typeof HRLib.syncTrainingCompletion !== 'function' ||
    typeof HRLib.writeExecutionLog !== 'function') {
    throw new Error('HRLib library is not available. Add the shared HR library with identifier "HRLib" and pinned version.');
  }
}

if (typeof module !== 'undefined') module.exports = {
  runOnboardingBusinessHours: runOnboardingBusinessHours,
  runOnboarding: runOnboarding,
  runAudit: runAudit,
  runAuditDeepWeekly: runAuditDeepWeekly,
  runTrainingAssignments: runTrainingAssignments,
  runTrainingReminders: runTrainingReminders,
  runTrainingSync: runTrainingSync,
  runLibraryWorkflow_: runLibraryWorkflow_,
  readSheetRows_: readSheetRows_,
  mapRowToObject_: mapRowToObject_,
  normalizeHeaderKey_: normalizeHeaderKey_,
  buildIdempotencyKey_: buildIdempotencyKey_,
  writeWorkflowExecutionLog_: writeWorkflowExecutionLog_,
  appendRunSummaryToLogsTab_: appendRunSummaryToLogsTab_,
  mergeHandoffFailuresIntoResult_: mergeHandoffFailuresIntoResult_,
  appendExceptionLog_: appendExceptionLog_,
  writeHandoffDashboard_: writeHandoffDashboard_,
  indexErrorsByRow_: indexErrorsByRow_,
  buildHeaderMap_: buildHeaderMap_,
  assertLibraryAvailable_: assertLibraryAvailable_
};
