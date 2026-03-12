/* global SheetClient, SlackClient, AuditLogger, BlockKit, COL, Config, computeHash, generateId, getDaysUntilDue, Utils, SpreadsheetApp */
/**
 * @fileoverview Daily reminder, escalation, and celebration reminder flows.
 */

var REMINDER_THRESHOLDS = {
  REMINDER_DAYS: [3, 0],
  ESCALATE_AFTER_OVERDUE_DAYS: 3
};

function runDailyReminders() {
  var sheetClient = new SheetClient();
  processTrainingReminders_(sheetClient);
  processChecklistReminders_(sheetClient);
}

function processTrainingReminders_(sheetClient) {
  var trainingRows = sheetClient.getTrainingRows();
  for (var i = 0; i < trainingRows.length; i += 1) {
    var row = trainingRows[i];
    var status = String(row[COL.TRAINING.TRAINING_STATUS - 1] || '').toUpperCase();
    if (status === 'COMPLETED') {
      continue;
    }

    var daysUntil = getDaysUntilViaUtils_(row[COL.TRAINING.DUE_DATE - 1]);
    if (daysUntil === null) {
      continue;
    }

    if (REMINDER_THRESHOLDS.REMINDER_DAYS.indexOf(daysUntil) > -1 || daysUntil < 0) {
      sendTrainingReminderDM_(sheetClient, row, daysUntil);
    }

    if (daysUntil <= -REMINDER_THRESHOLDS.ESCALATE_AFTER_OVERDUE_DAYS) {
      escalateTrainingToManager_(sheetClient, row);
    }
  }
}

function processChecklistReminders_(sheetClient) {
  var checklistRows = sheetClient.getChecklistRows();
  for (var i = 0; i < checklistRows.length; i += 1) {
    var row = checklistRows[i];
    var status = String(row[COL.CHECKLIST.STATUS - 1] || '').toUpperCase();
    if (status === 'COMPLETE' || status === 'DONE') {
      continue;
    }

    var daysUntil = getDaysUntilViaUtils_(row[COL.CHECKLIST.DUE_DATE - 1]);
    if (daysUntil === null) {
      continue;
    }

    if (REMINDER_THRESHOLDS.REMINDER_DAYS.indexOf(daysUntil) > -1 || daysUntil < 0) {
      sendChecklistReminderDM_(sheetClient, row, daysUntil);
    }

    if (daysUntil <= -REMINDER_THRESHOLDS.ESCALATE_AFTER_OVERDUE_DAYS) {
      escalateChecklistTask_(sheetClient, row, daysUntil);
    }
  }
}

function sendTrainingReminderDM_(sheetClient, row, daysUntil) {
  var auditLogger = new AuditLogger(sheetClient);
  var slackClient = new SlackClient(auditLogger);
  var employeeId = row[COL.TRAINING.EMPLOYEE_ID - 1];
  var moduleCode = row[COL.TRAINING.MODULE_CODE - 1];
  var onboarding = sheetClient.findOnboardingByEmployeeId(employeeId);
  if (!onboarding) {
    return;
  }

  var employeeEmail = onboarding.values[COL.ONBOARDING.EMAIL - 1];
  var userLookup = slackClient.lookupUserByEmail(employeeEmail);
  var userId = userLookup && userLookup.user ? userLookup.user.id : '';
  if (!userId) {
    return;
  }

  var reminderDateKey = new Date().toISOString().slice(0, 10);
  var reminderHash = computeHash(['reminder', 'training', employeeId, moduleCode, reminderDateKey, daysUntil]);
  if (sheetClient.checkDuplicate(Config.getAuditSheetName(), COL.AUDIT.EVENT_HASH, reminderHash) > -1) {
    return;
  }

  slackClient.postMessage(userId, BlockKit.reminderDM({
    daysUntilDue: daysUntil,
    moduleName: row[COL.TRAINING.MODULE_NAME - 1],
    dueDate: row[COL.TRAINING.DUE_DATE - 1]
  }));

  var nextCount = Number(row[COL.TRAINING.REMINDER_COUNT - 1] || 0) + 1;
  if (sheetClient.updateTrainingReminderMetadata) {
    sheetClient.updateTrainingReminderMetadata(employeeId, moduleCode, nextCount, new Date());
  }

  auditLogger.log({
    auditId: generateId('AUD'),
    entityType: 'Training',
    entityId: String(employeeId) + ':' + String(moduleCode),
    action: 'UPDATE',
    details: 'Reminder DM sent (' + daysUntil + ' days)'
  });
}

function escalateTrainingToManager_(sheetClient, row) {
  var auditLogger = new AuditLogger(sheetClient);
  var slackClient = new SlackClient(auditLogger);
  var employeeId = row[COL.TRAINING.EMPLOYEE_ID - 1];
  var moduleCode = row[COL.TRAINING.MODULE_CODE - 1];
  var managerEmail = row[COL.TRAINING.OWNER_EMAIL - 1];
  if (!managerEmail) {
    return;
  }

  var escalationDateKey = new Date().toISOString().slice(0, 10);
  var escalationHash = computeHash(['escalation', 'training', employeeId, moduleCode, escalationDateKey]);
  if (sheetClient.checkDuplicate(Config.getAuditSheetName(), COL.AUDIT.EVENT_HASH, escalationHash) > -1) {
    return;
  }

  var managerLookup = slackClient.lookupUserByEmail(managerEmail);
  var managerSlackId = managerLookup && managerLookup.user ? managerLookup.user.id : '';
  if (!managerSlackId) {
    return;
  }

  var dueDays = getDaysUntilViaUtils_(row[COL.TRAINING.DUE_DATE - 1]);
  var overdueDays = dueDays !== null ? Math.abs(Math.min(dueDays, 0)) : 'unknown';

  slackClient.postMessage(managerSlackId, [
    { type: 'section', text: { type: 'mrkdwn', text: ':rotating_light: Team member training is overdue by *' + overdueDays + ' day(s)*. Please follow up.' } },
    { type: 'section', text: { type: 'mrkdwn', text: '*Employee ID:* ' + employeeId + '\n*Module:* ' + row[COL.TRAINING.MODULE_NAME - 1] } }
  ]);

  sheetClient.appendAuditIfNotExists(escalationHash, [
    generateId('AUD'), new Date(), 'system', 'Training', String(employeeId) + ':' + String(moduleCode), 'UPDATE', 'Escalation DM sent to manager', escalationHash
  ]);
}

function sendChecklistReminderDM_(sheetClient, row, daysUntil) {
  var auditLogger = new AuditLogger(sheetClient);
  var slackClient = new SlackClient(auditLogger);
  var onboardingId = row[COL.CHECKLIST.ONBOARDING_ID - 1];
  var taskId = row[COL.CHECKLIST.TASK_ID - 1];

  var destination = resolveChecklistOwnerDestination_(row[COL.CHECKLIST.OWNER_TEAM - 1], row[COL.CHECKLIST.OWNER_SLACK_ID - 1]);
  if (!destination.channelId) {
    return;
  }

  var reminderDateKey = new Date().toISOString().slice(0, 10);
  var reminderHash = computeHash(['reminder', 'checklist', onboardingId, taskId, reminderDateKey, daysUntil]);
  if (sheetClient.checkDuplicate(Config.getAuditSheetName(), COL.AUDIT.EVENT_HASH, reminderHash) > -1) {
    return;
  }

  var taskName = row[COL.CHECKLIST.TASK_NAME - 1];
  slackClient.postMessage(destination.channelId, BlockKit.reminderDM({
    daysUntilDue: daysUntil,
    moduleName: 'Checklist task: ' + taskName,
    dueDate: row[COL.CHECKLIST.DUE_DATE - 1]
  }));

  var nextCount = Number(row[COL.CHECKLIST.REMINDER_COUNT - 1] || 0) + 1;
  if (sheetClient.updateChecklistReminderMetadata) {
    sheetClient.updateChecklistReminderMetadata(taskId, onboardingId, nextCount, new Date());
  }

  sheetClient.appendAuditIfNotExists(reminderHash, [
    generateId('AUD'), new Date(), 'system', 'ChecklistTask', String(onboardingId) + ':' + String(taskId), 'UPDATE',
    'Checklist reminder sent to ' + destination.channelId + ' (' + daysUntil + ' days)', reminderHash
  ]);
}

function escalateChecklistTask_(sheetClient, row, daysUntil) {
  var auditLogger = new AuditLogger(sheetClient);
  var slackClient = new SlackClient(auditLogger);
  var onboardingId = row[COL.CHECKLIST.ONBOARDING_ID - 1];
  var taskId = row[COL.CHECKLIST.TASK_ID - 1];
  var taskName = row[COL.CHECKLIST.TASK_NAME - 1];
  var criticality = String(row[COL.CHECKLIST.CRITICALITY - 1] || 'NORMAL').toUpperCase();

  var escalationDateKey = new Date().toISOString().slice(0, 10);
  var escalationHash = computeHash(['escalation', 'checklist', onboardingId, taskId, escalationDateKey]);
  if (sheetClient.checkDuplicate(Config.getAuditSheetName(), COL.AUDIT.EVENT_HASH, escalationHash) > -1) {
    return;
  }

  var blocks = [
    { type: 'section', text: { type: 'mrkdwn', text: ':rotating_light: Checklist task overdue by *' + Math.abs(daysUntil) + ' day(s)*.' } },
    { type: 'section', text: { type: 'mrkdwn', text: '*Onboarding:* ' + onboardingId + '\n*Task:* ' + taskName + '\n*Criticality:* ' + criticality } }
  ];

  if (criticality === 'CRITICAL' || criticality === 'HIGH') {
    slackClient.postMessage('#hr-ops-alerts', blocks);
  }

  var onboarding = sheetClient.findOnboardingByEmployeeId(onboardingId);
  var managerEmail = onboarding && onboarding.values ? onboarding.values[COL.ONBOARDING.MANAGER_EMAIL - 1] : '';
  if (managerEmail) {
    var managerLookup = slackClient.lookupUserByEmail(managerEmail);
    var managerSlackId = managerLookup && managerLookup.user ? managerLookup.user.id : '';
    if (managerSlackId) {
      slackClient.postMessage(managerSlackId, blocks);
    }
  }

  sheetClient.appendAuditIfNotExists(escalationHash, [
    generateId('AUD'), new Date(), 'system', 'ChecklistTask', String(onboardingId) + ':' + String(taskId), 'UPDATE',
    'Checklist escalation sent (criticality=' + criticality + ')', escalationHash
  ]);
}

function resolveChecklistOwnerDestination_(ownerTeam, ownerSlackId) {
  var cleanedDestination = String(ownerSlackId || '').trim();
  if (/^[CDGU][A-Z0-9]{8,}$/.test(cleanedDestination)) {
    return { channelId: cleanedDestination };
  }

  var teamKey = String(ownerTeam || '').trim().toUpperCase();
  if (teamKey.indexOf('FINANCE') > -1) return { channelId: Config.getFinanceTeamChannelId() };
  if (teamKey.indexOf('ADMIN') > -1) return { channelId: Config.getAdminTeamChannelId() };
  if (teamKey.indexOf('IT') > -1) return { channelId: Config.getItTeamChannelId() };
  if (teamKey.indexOf('LEGAL') > -1) return { channelId: Config.getLegalTeamChannelId() };
  if (teamKey.indexOf('OPERATIONS') > -1) return { channelId: Config.getOperationsTeamChannelId() };
  if (teamKey.indexOf('PEOPLE') > -1 || teamKey.indexOf('HR') > -1) return { channelId: Config.getPeopleTeamChannelId() };
  return { channelId: Config.getDefaultAssignmentsChannelId() };
}


function sendReminderDM(row, daysUntil) {
  var sheetClient = new SheetClient();
  return sendTrainingReminderDM_(sheetClient, row, daysUntil);
}

function escalateToManager(row) {
  var sheetClient = new SheetClient();
  return escalateTrainingToManager_(sheetClient, row);
}

function checkBirthdaysAndAnniversaries() {
  var sheetClient = new SheetClient();
  var auditLogger = new AuditLogger(sheetClient);
  var slackClient = new SlackClient(auditLogger);
  var onboardingSheet = SpreadsheetApp.openById(Config.getOnboardingSpreadsheetId()).getSheetByName(Config.getOnboardingSheetName());
  if (!onboardingSheet || onboardingSheet.getLastRow() < 2) {
    return;
  }

  var headers = onboardingSheet.getRange(1, 1, 1, onboardingSheet.getLastColumn()).getValues()[0];
  var rows = onboardingSheet.getRange(2, 1, onboardingSheet.getLastRow() - 1, onboardingSheet.getLastColumn()).getValues();
  var birthdayColumn = resolveBirthdayColumn_(headers);
  var today = new Date();

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var employeeId = row[COL.ONBOARDING.EMPLOYEE_ID - 1];
    var email = row[COL.ONBOARDING.EMAIL - 1];
    if (!email) {
      continue;
    }

    var userLookup = slackClient.lookupUserByEmail(email);
    var userId = userLookup && userLookup.user ? userLookup.user.id : '';
    if (!userId) {
      continue;
    }

    var birthdayValue = birthdayColumn > -1 ? row[birthdayColumn] : null;
    var birthdayForYear = birthdayValue ? getDateForCurrentYear_(birthdayValue) : null;
    if (birthdayForYear && getDaysUntilViaUtils_(birthdayForYear) === 0) {
      maybeSendCelebration_(sheetClient, slackClient, employeeId, 'birthday', BlockKit.birthdayDM({ firstName: getFirstNameSafe_(row[COL.ONBOARDING.FULL_NAME - 1]) }), userId);
    }

    var startDateValue = row[COL.ONBOARDING.START_DATE - 1];
    var anniversaryForYear = startDateValue ? getDateForCurrentYear_(startDateValue) : null;
    if (anniversaryForYear && getDaysUntilViaUtils_(anniversaryForYear) === 0) {
      var years = Math.max(today.getFullYear() - new Date(startDateValue).getFullYear(), 1);
      maybeSendCelebration_(
        sheetClient,
        slackClient,
        employeeId,
        'anniversary',
        BlockKit.anniversaryDM({ firstName: getFirstNameSafe_(row[COL.ONBOARDING.FULL_NAME - 1]), years: years }),
        userId
      );
    }
  }
}

function maybeSendCelebration_(sheetClient, slackClient, employeeId, eventType, blocks, userId) {
  var dateKey = new Date().toISOString().slice(0, 10);
  var eventHash = computeHash([eventType, employeeId, dateKey]);
  var duplicate = sheetClient.checkDuplicate(Config.getAuditSheetName(), COL.AUDIT.EVENT_HASH, eventHash);
  if (duplicate > -1) {
    return;
  }

  slackClient.postMessage(userId, blocks);

  sheetClient.appendAuditIfNotExists(eventHash, [
    generateId('AUD'),
    new Date(),
    'system',
    'Employee',
    String(employeeId),
    'UPDATE',
    eventType + ' DM sent',
    eventHash
  ]);
}

function getDaysUntilViaUtils_(dateValue) {
  if (typeof Utils !== 'undefined' && Utils.getDaysUntilDue) {
    return Utils.getDaysUntilDue(dateValue);
  }
  return getDaysUntilDue(dateValue);
}

function getDateForCurrentYear_(value) {
  var source = value instanceof Date ? value : new Date(value);
  if (isNaN(source.getTime())) {
    return null;
  }
  return new Date(new Date().getFullYear(), source.getMonth(), source.getDate());
}

function getFirstNameSafe_(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || 'there';
}

if (typeof module !== 'undefined') {
  module.exports = {
    runDailyReminders: runDailyReminders,
    sendReminderDM: sendReminderDM,
    escalateToManager: escalateToManager,
    checkBirthdaysAndAnniversaries: checkBirthdaysAndAnniversaries
  };
}

function resolveBirthdayColumn_(headers) {
  var validKeys = ['birthday', 'birth_date', 'date_of_birth'];
  for (var i = 0; i < headers.length; i += 1) {
    var key = String(headers[i] || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (validKeys.indexOf(key) > -1) {
      return i;
    }
  }
  return -1;
}
