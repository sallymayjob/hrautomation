/* global generateId, ValidationService */
/**
 * @fileoverview Pure shared HR library entry points and schema-safe helpers.
 */

var SharedHrLibraryBindings_ = null;
if (typeof require === 'function') {
  SharedHrLibraryBindings_ = {
    validationService: require('./ValidationService.gs')
  };
}

function getValidationService_() {
  if (typeof ValidationService !== 'undefined' && ValidationService) {
    return ValidationService;
  }
  return SharedHrLibraryBindings_ && SharedHrLibraryBindings_.validationService;
}

function processOnboardingBatch(rows, options) {
  var validationService = getValidationService_();
  var normalizedRows = Array.isArray(rows) ? rows : [];
  var opts = options || {};
  var traceId = getTraceId_(opts.traceId);
  var errors = [];
  var successCount = 0;

  for (var i = 0; i < normalizedRows.length; i += 1) {
    var row = normalizedRows[i] || {};
    var rowErrors = validationService.validateOnboardingRow_(row, i);
    if (rowErrors.length > 0) {
      errors = errors.concat(rowErrors);
      continue;
    }

    successCount += 1;
  }

  return buildResult_(traceId, successCount, errors);
}

function runAuditChecks(rows, options) {
  var validationService = getValidationService_();
  var normalizedRows = Array.isArray(rows) ? rows : [];
  var opts = options || {};
  var traceId = getTraceId_(opts.traceId);
  var errors = [];
  var successCount = 0;
  var seenKeys = {};

  for (var i = 0; i < normalizedRows.length; i += 1) {
    var row = normalizedRows[i] || {};
    var rowErrors = validationService.validateAuditRow_(row, i, seenKeys);
    if (rowErrors.length > 0) {
      errors = errors.concat(rowErrors);
      continue;
    }

    successCount += 1;
  }

  return buildResult_(traceId, successCount, errors);
}

function processTrainingAssignments(rows, options) {
  var validationService = getValidationService_();
  var normalizedRows = Array.isArray(rows) ? rows : [];
  var opts = options || {};
  var traceId = getTraceId_(opts.traceId);
  var errors = [];
  var successCount = 0;
  var counts = {
    assigned: 0,
    skipped: 0
  };

  for (var i = 0; i < normalizedRows.length; i += 1) {
    var row = normalizedRows[i] || {};
    var rowErrors = validationService.validateTrainingAssignmentRow_(row, i);
    if (rowErrors.length > 0) {
      errors = errors.concat(rowErrors);
      continue;
    }

    successCount += 1;
    counts.assigned += 1;
  }

  var result = buildResult_(traceId, successCount, errors);
  result.counts = counts;
  return result;
}

function runTrainingReminders(rows, options) {
  var validationService = getValidationService_();
  var normalizedRows = Array.isArray(rows) ? rows : [];
  var opts = options || {};
  var traceId = getTraceId_(opts.traceId);
  var errors = [];
  var successCount = 0;
  var counts = {
    dueSoon: 0,
    overdue: 0,
    notDue: 0
  };
  var reminderWindowDays = Number(opts.reminderWindowDays || 3);
  var now = opts.now instanceof Date ? opts.now : new Date();

  for (var i = 0; i < normalizedRows.length; i += 1) {
    var row = normalizedRows[i] || {};
    var rowErrors = validationService.validateTrainingReminderRow_(row, i);
    if (rowErrors.length > 0) {
      errors = errors.concat(rowErrors);
      continue;
    }

    var dueDate = row.due_date instanceof Date ? row.due_date : new Date(row.due_date);
    var daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    if (daysUntilDue < 0) {
      counts.overdue += 1;
    } else if (daysUntilDue <= reminderWindowDays) {
      counts.dueSoon += 1;
    } else {
      counts.notDue += 1;
    }

    successCount += 1;
  }

  var result = buildResult_(traceId, successCount, errors);
  result.counts = counts;
  return result;
}

function syncTrainingCompletion(rows, options) {
  var validationService = getValidationService_();
  var normalizedRows = Array.isArray(rows) ? rows : [];
  var opts = options || {};
  var traceId = getTraceId_(opts.traceId);
  var errors = [];
  var successCount = 0;
  var counts = {
    completed: 0,
    inProgress: 0,
    pending: 0
  };
  var completionUpdates = [];

  for (var i = 0; i < normalizedRows.length; i += 1) {
    var row = normalizedRows[i] || {};
    var rowErrors = validationService.validateTrainingCompletionRow_(row, i);
    if (rowErrors.length > 0) {
      errors = errors.concat(rowErrors);
      continue;
    }

    var normalizedStatus = String(row.training_status || '').trim().toUpperCase();
    var completionAt = row.completion_date;
    if (normalizedStatus === 'COMPLETED') {
      counts.completed += 1;
      if (!validationService.isValidDate_(completionAt)) {
        completionAt = new Date().toISOString();
      }
    } else if (normalizedStatus === 'IN_PROGRESS') {
      counts.inProgress += 1;
      completionAt = '';
    } else {
      counts.pending += 1;
      completionAt = '';
    }

    completionUpdates.push({
      employeeId: String(row.employee_id),
      moduleCode: String(row.module_code),
      trainingStatus: normalizedStatus,
      completionDate: completionAt
    });
    successCount += 1;
  }

  var result = buildResult_(traceId, successCount, errors);
  result.counts = counts;
  result.updates = completionUpdates;
  return result;
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

function buildResult_(traceId, successCount, errors) {
  var normalizedErrors = Array.isArray(errors) ? errors : [];
  return {
    successCount: successCount,
    errorCount: normalizedErrors.length,
    errors: normalizedErrors,
    traceId: traceId
  };
}

if (typeof module !== 'undefined') module.exports = {
  processOnboardingBatch: processOnboardingBatch,
  runAuditChecks: runAuditChecks,
  processTrainingAssignments: processTrainingAssignments,
  runTrainingReminders: runTrainingReminders,
  syncTrainingCompletion: syncTrainingCompletion,
  getTraceId_: getTraceId_,
  buildResult_: buildResult_
};
