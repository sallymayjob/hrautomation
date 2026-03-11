/* global SheetClient, COL, notifyHrAlerts, getDaysUntilDue, Utils */
/**
 * @fileoverview Weekly reporting for HR alerting.
 */

function postWeeklyMetrics() {
  var sheetClient = new SheetClient();
  var rows = sheetClient.getTrainingRows();
  var metrics = {
    total: rows.length,
    completed: 0,
    overdue: 0,
    dueThisWeek: 0
  };

  for (var i = 0; i < rows.length; i += 1) {
    var status = String(rows[i][COL.TRAINING.TRAINING_STATUS - 1] || '').toUpperCase();
    var daysUntil = getDaysUntilViaUtilsForReporting_(rows[i][COL.TRAINING.DUE_DATE - 1]);

    if (status === 'COMPLETED') {
      metrics.completed += 1;
    }
    if (daysUntil !== null && daysUntil < 0 && status !== 'COMPLETED') {
      metrics.overdue += 1;
    }
    if (daysUntil !== null && daysUntil >= 0 && daysUntil <= 7) {
      metrics.dueThisWeek += 1;
    }
  }

  var completionRate = metrics.total ? Math.round((metrics.completed / metrics.total) * 100) : 0;
  var message = [
    'Weekly Training Metrics',
    'Total items: ' + metrics.total,
    'Completed: ' + metrics.completed + ' (' + completionRate + '%)',
    'Overdue: ' + metrics.overdue,
    'Due in next 7 days: ' + metrics.dueThisWeek
  ].join('\n');

  notifyHrAlerts(message);
  return metrics;
}

function getDaysUntilViaUtilsForReporting_(dateValue) {
  if (typeof Utils !== 'undefined' && Utils.getDaysUntilDue) {
    return Utils.getDaysUntilDue(dateValue);
  }
  return getDaysUntilDue(dateValue);
}

if (typeof module !== 'undefined') {
  module.exports = {
    postWeeklyMetrics: postWeeklyMetrics
  };
}
