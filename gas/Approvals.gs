/* global SheetClient, SlackClient, AuditService, BlockKit, COL */
/**
 * @fileoverview Approval workflow posting and response handling.
 */

function postApprovalRequest(trainingId, managerEmail, requestSummary) {
  var sheetClient = new SheetClient();
  var auditService = new AuditService(sheetClient);
  var slackClient = new SlackClient();
  var managerLookup = slackClient.lookupUserByEmail(managerEmail);
  var managerSlackId = managerLookup && managerLookup.user ? managerLookup.user.id : '';
  if (!managerSlackId) {
    throw new Error('Could not resolve manager Slack user for email: ' + managerEmail);
  }

  var response = slackClient.postMessage(managerSlackId, BlockKit.approvalCard({
    requestId: String(trainingId),
    requestSummary: requestSummary || 'Please review this training decision.'
  }));

  auditService.logEvent({
    entityType: 'Training',
    entityId: String(trainingId),
    action: 'UPDATE',
    details: 'Approval request posted to manager'
  });

  return response;
}

function handleApprovalResponse(trainingId, decision) {
  var sheetClient = new SheetClient();
  var auditService = new AuditService(sheetClient);
  var resolved = resolveTrainingFromId_(sheetClient, trainingId);
  if (!resolved) {
    throw new Error('Training record not found for ID: ' + trainingId);
  }

  var normalized = String(decision || '').trim().toUpperCase();
  var nextStatus = normalized === 'APPROVE' || normalized === 'APPROVED' ? 'APPROVED' : 'DENIED';
  resolved.row[COL.TRAINING.TRAINING_STATUS - 1] = nextStatus;
  resolved.row[COL.TRAINING.LAST_UPDATED_AT - 1] = new Date();

  sheetClient.upsertTrainingRow(resolved.employeeId, resolved.moduleCode, resolved.row);

  auditService.logEvent({
    entityType: 'Training',
    entityId: String(trainingId),
    action: 'STATUS_CHANGE',
    details: 'Approval response captured: ' + nextStatus
  });

  return nextStatus;
}

function resolveTrainingFromId_(sheetClient, trainingId) {
  var parts = String(trainingId || '').split(':');
  if (parts.length === 2) {
    var match = sheetClient.findTrainingByEmployeeAndModule(parts[0], parts[1]);
    if (!match) {
      return null;
    }
    return {
      employeeId: parts[0],
      moduleCode: parts[1],
      row: match.values
    };
  }

  var rows = sheetClient.getTrainingRows();
  for (var i = 0; i < rows.length; i += 1) {
    var candidateId = rows[i][COL.TRAINING.EMPLOYEE_ID - 1] + ':' + rows[i][COL.TRAINING.MODULE_CODE - 1];
    if (candidateId === String(trainingId)) {
      return {
        employeeId: rows[i][COL.TRAINING.EMPLOYEE_ID - 1],
        moduleCode: rows[i][COL.TRAINING.MODULE_CODE - 1],
        row: rows[i]
      };
    }
  }
  return null;
}

if (typeof module !== 'undefined') {
  module.exports = {
    postApprovalRequest: postApprovalRequest,
    handleApprovalResponse: handleApprovalResponse
  };
}
