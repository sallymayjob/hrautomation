/* global SheetClient, COL, getDaysUntilDue, Utils, AuditRepository, ReportingRepository, generateId, CoreConstants, normalizeTrainingStatus, normalizeOnboardingStatus, isChecklistDoneStatus */
/**
 * @fileoverview Weekly reporting for HR alerting.
 */

var WEEKLY_REPORT_SHEETS = {
  BY_EMPLOYEE: 'Summary - By Employee',
  BY_TEAM_OWNER: 'Summary - By Team Owner',
  BY_CATEGORY: 'Summary - By Category',
  BLOCKED: 'Summary - Blocked Onboarding'
};


function appendWorkflowLifecycleRow_(sheetClient, event) {
  return sheetClient.appendWorkflowLifecycleEvent(event);
}

function postWeeklyMetrics() {
  var sheetClient = new SheetClient();
  var auditRepository = new AuditRepository(sheetClient);
  var trainingRows = sheetClient.getTrainingRows();
  var onboardingRows = sheetClient.getOnboardingRows();
  var checklistRows = sheetClient.getChecklistRows();

  var trainingMetrics = buildTrainingMetrics_(trainingRows);
  var onboardingMetrics = buildOnboardingMetrics_(onboardingRows, checklistRows);

  syncSummaryViews_(sheetClient, onboardingRows, checklistRows, onboardingMetrics.byOnboardingId);

  var completionRate = trainingMetrics.total ? Math.round((trainingMetrics.completed / trainingMetrics.total) * 100) : 0;
  var message = [
    'Weekly Training Metrics',
    'Total items: ' + trainingMetrics.total,
    'Completed: ' + trainingMetrics.completed + ' (' + completionRate + '%)',
    'Overdue: ' + trainingMetrics.overdue,
    'Due in next 7 days: ' + trainingMetrics.dueThisWeek
  ].join('\n');
  auditRepository.log({
    auditId: typeof generateId === 'function' ? generateId('AUD') : '',
    entityType: 'Reporting',
    entityId: 'weekly_metrics',
    action: 'SUMMARY_REFRESH',
    details: message
  });

  logWeeklyDigestSummary_(auditRepository, trainingMetrics, onboardingMetrics);

  return {
    training: trainingMetrics,
    onboarding: onboardingMetrics
  };
}

function buildTrainingMetrics_(rows) {
  var metrics = {
    total: rows.length,
    completed: 0,
    overdue: 0,
    dueThisWeek: 0
  };

  for (var i = 0; i < rows.length; i += 1) {
    var status = normalizeTrainingStatus(rows[i][COL.TRAINING.TRAINING_STATUS - 1]);
    var daysUntil = getDaysUntilViaUtilsForReporting_(rows[i][COL.TRAINING.DUE_DATE - 1]);

    if (status === CoreConstants.STATUSES.COMPLETED) {
      metrics.completed += 1;
    }
    if (daysUntil !== null && daysUntil < 0 && status !== CoreConstants.STATUSES.COMPLETED) {
      metrics.overdue += 1;
    }
    if (daysUntil !== null && daysUntil >= 0 && daysUntil <= 7) {
      metrics.dueThisWeek += 1;
    }
  }

  return metrics;
}

function buildOnboardingMetrics_(onboardingRows, checklistRows) {
  var byOnboardingId = {};

  for (var i = 0; i < onboardingRows.length; i += 1) {
    var onboardingRow = onboardingRows[i];
    var onboardingId = String(onboardingRow[COL.ONBOARDING.ONBOARDING_ID - 1] || '');
    if (!onboardingId) {
      continue;
    }

    byOnboardingId[onboardingId] = {
      onboarding_id: onboardingId,
      employee_name: onboardingRow[COL.ONBOARDING.EMPLOYEE_NAME - 1],
      status: normalizeOnboardingStatus(onboardingRow[COL.ONBOARDING.STATUS - 1]),
      blocked_reason: onboardingRow[COL.ONBOARDING.BLOCKED_REASON - 1] || '',
      tasks_total: 0,
      tasks_done: 0,
      tasks_overdue: 0,
      completion_pct: 0,
      unresolved_tasks: []
    };
  }

  for (var c = 0; c < checklistRows.length; c += 1) {
    var taskRow = checklistRows[c];
    var taskOnboardingId = String(taskRow[COL.CHECKLIST.ONBOARDING_ID - 1] || '');
    if (!byOnboardingId[taskOnboardingId]) {
      continue;
    }

    var status = taskRow[COL.CHECKLIST.STATUS - 1];
    var daysUntil = getDaysUntilViaUtilsForReporting_(taskRow[COL.CHECKLIST.DUE_DATE - 1]);
    var isDone = isChecklistDoneStatus(status);

    byOnboardingId[taskOnboardingId].tasks_total += 1;
    if (isDone) {
      byOnboardingId[taskOnboardingId].tasks_done += 1;
      continue;
    }

    if (daysUntil !== null && daysUntil < 0) {
      byOnboardingId[taskOnboardingId].tasks_overdue += 1;
    }

    byOnboardingId[taskOnboardingId].unresolved_tasks.push({
      task_name: String(taskRow[COL.CHECKLIST.TASK_NAME - 1] || 'Unnamed task'),
      phase: String(taskRow[COL.CHECKLIST.PHASE - 1] || 'Unassigned'),
      owner_team: String(taskRow[COL.CHECKLIST.OWNER_TEAM - 1] || 'Unassigned'),
      due_date: taskRow[COL.CHECKLIST.DUE_DATE - 1],
      days_until_due: daysUntil
    });
  }

  var onboardingIds = Object.keys(byOnboardingId);
  var blocked = [];
  for (var j = 0; j < onboardingIds.length; j += 1) {
    var id = onboardingIds[j];
    var metrics = byOnboardingId[id];
    metrics.completion_pct = metrics.tasks_total ? Math.round((metrics.tasks_done / metrics.tasks_total) * 100) : 0;
    metrics.unresolved_tasks.sort(function (a, b) {
      var aScore = a.days_until_due === null ? 99999 : a.days_until_due;
      var bScore = b.days_until_due === null ? 99999 : b.days_until_due;
      return aScore - bScore;
    });

    if (metrics.status === CoreConstants.STATUSES.BLOCKED) {
      blocked.push(metrics);
    }
  }

  blocked.sort(function (a, b) {
    return b.tasks_overdue - a.tasks_overdue;
  });

  return {
    byOnboardingId: byOnboardingId,
    blocked: blocked,
    totals: {
      onboarding_records: onboardingIds.length,
      tasks_total: onboardingIds.reduce(function (sum, onboardingId) { return sum + byOnboardingId[onboardingId].tasks_total; }, 0),
      tasks_done: onboardingIds.reduce(function (sum, onboardingId) { return sum + byOnboardingId[onboardingId].tasks_done; }, 0),
      tasks_overdue: onboardingIds.reduce(function (sum, onboardingId) { return sum + byOnboardingId[onboardingId].tasks_overdue; }, 0)
    }
  };
}

function syncSummaryViews_(sheetClient, onboardingRows, checklistRows, byOnboardingId) {
  var reportingRepository = new ReportingRepository(sheetClient);
  writeEmployeeSummarySheet_(reportingRepository, onboardingRows, byOnboardingId);
  writeTeamOwnerSummarySheet_(reportingRepository, checklistRows);
  writePhaseSummarySheet_(reportingRepository, checklistRows);
  writeBlockedSummarySheet_(reportingRepository, byOnboardingId);
}

function writeEmployeeSummarySheet_(reportingRepository, onboardingRows, byOnboardingId) {
  var headers = ['onboarding_id', 'employee_name', 'status', 'tasks_total', 'tasks_done', 'tasks_overdue', 'completion_pct', 'top_unresolved_tasks'];
  var rows = [];

  for (var i = 0; i < onboardingRows.length; i += 1) {
    var onboardingId = String(onboardingRows[i][COL.ONBOARDING.ONBOARDING_ID - 1] || '');
    if (!onboardingId || !byOnboardingId[onboardingId]) {
      continue;
    }

    var metrics = byOnboardingId[onboardingId];
    rows.push([
      onboardingId,
      metrics.employee_name,
      metrics.status,
      metrics.tasks_total,
      metrics.tasks_done,
      metrics.tasks_overdue,
      metrics.completion_pct,
      formatTopTasks_(metrics.unresolved_tasks, 3)
    ]);
  }

  writeSummarySheet_(reportingRepository, WEEKLY_REPORT_SHEETS.BY_EMPLOYEE, headers, rows);
}

function writeTeamOwnerSummarySheet_(reportingRepository, checklistRows) {
  var headers = ['owner_team', 'tasks_total', 'tasks_done', 'tasks_overdue', 'completion_pct'];
  var aggregation = {};

  aggregateChecklist_(checklistRows, function (row) {
    return String(row[COL.CHECKLIST.OWNER_TEAM - 1] || 'Unassigned');
  }, aggregation);

  var rows = mapAggregatesToRows_(aggregation);
  writeSummarySheet_(reportingRepository, WEEKLY_REPORT_SHEETS.BY_TEAM_OWNER, headers, rows);
}

function writePhaseSummarySheet_(reportingRepository, checklistRows) {
  var headers = ['phase', 'tasks_total', 'tasks_done', 'tasks_overdue', 'completion_pct'];
  var aggregation = {};

  aggregateChecklist_(checklistRows, function (row) {
    return String(row[COL.CHECKLIST.PHASE - 1] || 'Unassigned');
  }, aggregation);

  var rows = mapAggregatesToRows_(aggregation);
  writeSummarySheet_(reportingRepository, WEEKLY_REPORT_SHEETS.BY_CATEGORY, headers, rows);
}

function writeBlockedSummarySheet_(reportingRepository, byOnboardingId) {
  var headers = ['onboarding_id', 'employee_name', 'tasks_overdue', 'blocked_reason', 'top_unresolved_tasks'];
  var rows = [];
  var ids = Object.keys(byOnboardingId);

  for (var i = 0; i < ids.length; i += 1) {
    var metrics = byOnboardingId[ids[i]];
    if (normalizeOnboardingStatus(metrics.status) !== CoreConstants.STATUSES.BLOCKED) {
      continue;
    }
    rows.push([
      metrics.onboarding_id,
      metrics.employee_name,
      metrics.tasks_overdue,
      metrics.blocked_reason,
      formatTopTasks_(metrics.unresolved_tasks, 5)
    ]);
  }

  rows.sort(function (a, b) {
    return Number(b[2] || 0) - Number(a[2] || 0);
  });

  writeSummarySheet_(reportingRepository, WEEKLY_REPORT_SHEETS.BLOCKED, headers, rows);
}

function aggregateChecklist_(checklistRows, keyResolver, aggregation) {
  for (var i = 0; i < checklistRows.length; i += 1) {
    var row = checklistRows[i];
    var key = keyResolver(row);

    if (!aggregation[key]) {
      aggregation[key] = { total: 0, done: 0, overdue: 0 };
    }

    var status = row[COL.CHECKLIST.STATUS - 1];
    var isDone = isChecklistDoneStatus(status);
    var daysUntil = getDaysUntilViaUtilsForReporting_(row[COL.CHECKLIST.DUE_DATE - 1]);

    aggregation[key].total += 1;
    if (isDone) {
      aggregation[key].done += 1;
    } else if (daysUntil !== null && daysUntil < 0) {
      aggregation[key].overdue += 1;
    }
  }
}

function mapAggregatesToRows_(aggregation) {
  var keys = Object.keys(aggregation).sort();
  var rows = [];

  for (var i = 0; i < keys.length; i += 1) {
    var key = keys[i];
    var row = aggregation[key];
    var pct = row.total ? Math.round((row.done / row.total) * 100) : 0;
    rows.push([key, row.total, row.done, row.overdue, pct]);
  }

  return rows;
}

function writeSummarySheet_(reportingRepository, sheetName, headers, rows) {
  reportingRepository.replaceSummarySheet(sheetName, headers, rows);
}

function formatTopTasks_(tasks, limit) {
  var items = (tasks || []).slice(0, limit || 3);
  if (items.length === 0) {
    return '';
  }
  return items.map(function (task) {
    var dueLabel = task.days_until_due === null ? 'no due date' : (task.days_until_due < 0 ? (Math.abs(task.days_until_due) + 'd overdue') : ('due in ' + task.days_until_due + 'd'));
    return task.task_name + ' [' + task.owner_team + ', ' + dueLabel + ']';
  }).join(' | ');
}

function generateWeeklyDigestMessage_(trainingMetrics, onboardingMetrics) {
  var blockedTop = onboardingMetrics.blocked.slice(0, 5).map(function (item) {
    return '- ' + item.employee_name + ' (' + item.onboarding_id + '): ' + formatTopTasks_(item.unresolved_tasks, 3);
  });

  return [
    '*Weekly HR approvals digest*',
    '',
    '*Training*',
    '- Total: ' + trainingMetrics.total,
    '- Completed: ' + trainingMetrics.completed,
    '- Overdue: ' + trainingMetrics.overdue,
    '- Due in next 7 days: ' + trainingMetrics.dueThisWeek,
    '',
    '*Onboarding tasks*',
    '- Active onboarding records: ' + onboardingMetrics.totals.onboarding_records,
    '- Tasks total: ' + onboardingMetrics.totals.tasks_total,
    '- Tasks done: ' + onboardingMetrics.totals.tasks_done,
    '- Tasks overdue: ' + onboardingMetrics.totals.tasks_overdue,
    '',
    '*Blocked onboarding (top unresolved tasks)*',
    blockedTop.length ? blockedTop.join('\n') : '- None 🎉'
  ].join('\n');
}

function logWeeklyDigestSummary_(auditRepository, trainingMetrics, onboardingMetrics) {
  var digestMessage = generateWeeklyDigestMessage_(trainingMetrics, onboardingMetrics);
  auditRepository.log({
    auditId: typeof generateId === 'function' ? generateId('AUD') : '',
    entityType: 'Reporting',
    entityId: 'weekly_digest',
    action: 'SUMMARY_DIGEST',
    details: digestMessage
  });
}

function getDaysUntilViaUtilsForReporting_(dateValue) {
  if (typeof Utils !== 'undefined' && Utils.getDaysUntilDue) {
    return Utils.getDaysUntilDue(dateValue);
  }
  return getDaysUntilDue(dateValue);
}

if (typeof module !== 'undefined') {
  module.exports = {
    postWeeklyMetrics: postWeeklyMetrics,
    buildOnboardingMetrics_: buildOnboardingMetrics_,
    generateWeeklyDigestMessage_: generateWeeklyDigestMessage_
  };
}
