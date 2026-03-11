/* global SheetClient, SlackClient, AuditLogger, BlockKit, COL, generateId */
/**
 * @fileoverview Recognition workflow for completed training.
 */

function handleTrainingComplete(trainingId) {
  var sheetClient = new SheetClient();
  var resolved = resolveTrainingRecord_(sheetClient, trainingId);
  if (!resolved) {
    throw new Error('Training record not found for ' + trainingId);
  }
  if (Boolean(resolved.row[COL.TRAINING.CELEBRATION_POSTED - 1])) return false;

  var auditLogger = new AuditLogger(sheetClient);
  var slackClient = new SlackClient(auditLogger);
  var onboarding = sheetClient.findOnboardingByEmployeeId(resolved.employeeId);
  var employeeName = onboarding ? onboarding.values[COL.ONBOARDING.FULL_NAME - 1] : resolved.employeeId;

  slackClient.postMessage('#hr-alerts', BlockKit.recognitionPost({
    employeeName: employeeName,
    moduleName: resolved.row[COL.TRAINING.MODULE_NAME - 1]
  }));

  resolved.row[COL.TRAINING.CELEBRATION_POSTED - 1] = true;
  resolved.row[COL.TRAINING.LAST_UPDATED_AT - 1] = new Date();
  sheetClient.upsertTrainingRow(resolved.employeeId, resolved.moduleCode, resolved.row);

  auditLogger.log({
    auditId: generateId('AUD'),
    entityType: 'Training',
    entityId: String(trainingId),
    action: 'UPDATE',
    details: 'Recognition posted'
  });

  return true;
}

function resolveTrainingRecord_(sheetClient, trainingId) {
  var parts = String(trainingId || '').split(':');
  if (parts.length !== 2) {
    return null;
  }
  var found = sheetClient.findTrainingByEmployeeAndModule(parts[0], parts[1]);
  if (!found) {
    return null;
  }
  return {
    employeeId: parts[0],
    moduleCode: parts[1],
    row: found.values
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    handleTrainingComplete: handleTrainingComplete
  };
}
