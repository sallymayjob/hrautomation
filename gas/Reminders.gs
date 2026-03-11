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
  var auditLogger = new AuditLogger(sheetClient);
  var slackClient = new SlackClient(auditLogger);
  var trainingRows = sheetClient.getTrainingRows();

  for (var i = 0; i < trainingRows.length; i += 1) {
    var row = trainingRows[i];
    var status = String(row[COL.TRAINING.TRAINING_STATUS - 1] || '').toUpperCase();
    if (status === 'COMPLETED') {
      continue;
    }

    var dueDate = row[COL.TRAINING.DUE_DATE - 1];
    var daysUntil = getDaysUntilViaUtils_(dueDate);
    if (daysUntil === null) {
      continue;
    }

    if (REMINDER_THRESHOLDS.REMINDER_DAYS.indexOf(daysUntil) > -1 || daysUntil < 0) {
      sendReminderDM(row, daysUntil);
    }

    if (daysUntil <= -REMINDER_THRESHOLDS.ESCALATE_AFTER_OVERDUE_DAYS) {
      escalateToManager(row);
    }
  }
}

function sendReminderDM(row, daysUntil) {
  var sheetClient = new SheetClient();
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
  var reminderHash = computeHash(['reminder', employeeId, moduleCode, reminderDateKey, daysUntil]);
  var duplicate = sheetClient.checkDuplicate(Config.getAuditSheetName(), COL.AUDIT.EVENT_HASH, reminderHash);
  if (duplicate > -1) {
    return;
  }

  slackClient.postMessage(userId, BlockKit.reminderDM({
    daysUntilDue: daysUntil,
    moduleName: row[COL.TRAINING.MODULE_NAME - 1],
    dueDate: row[COL.TRAINING.DUE_DATE - 1]
  }));

  auditLogger.log({
    auditId: generateId('AUD'),
    entityType: 'Training',
    entityId: String(employeeId) + ':' + String(moduleCode),
    action: 'UPDATE',
    details: 'Reminder DM sent (' + daysUntil + ' days)'
  });
}

function escalateToManager(row) {
  var sheetClient = new SheetClient();
  var auditLogger = new AuditLogger(sheetClient);
  var slackClient = new SlackClient(auditLogger);
  var employeeId = row[COL.TRAINING.EMPLOYEE_ID - 1];
  var moduleCode = row[COL.TRAINING.MODULE_CODE - 1];
  var managerEmail = row[COL.TRAINING.OWNER_EMAIL - 1];
  if (!managerEmail) {
    return;
  }

  var escalationDateKey = new Date().toISOString().slice(0, 10);
  var escalationHash = computeHash(['escalation', employeeId, moduleCode, escalationDateKey]);
  var duplicate = sheetClient.checkDuplicate(Config.getAuditSheetName(), COL.AUDIT.EVENT_HASH, escalationHash);
  if (duplicate > -1) {
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
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':rotating_light: Team member training is overdue by *' + overdueDays + ' day(s)*. Please follow up.'
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Employee ID:* ' + employeeId + '\n*Module:* ' + row[COL.TRAINING.MODULE_NAME - 1]
      }
    }
  ]);

  sheetClient.appendAuditIfNotExists(escalationHash, [
    generateId('AUD'),
    new Date(),
    'system',
    'Training',
    String(employeeId) + ':' + String(moduleCode),
    'UPDATE',
    'Escalation DM sent to manager',
    escalationHash
  ]);
}

function checkBirthdaysAndAnniversaries() {
  var sheetClient = new SheetClient();
  var auditLogger = new AuditLogger(sheetClient);
  var slackClient = new SlackClient(auditLogger);
  var onboardingSheet = SpreadsheetApp.openById(Config.getSpreadsheetId()).getSheetByName(Config.getOnboardingSheetName());
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
      maybeSendCelebration_(
        sheetClient,
        slackClient,
        employeeId,
        'birthday',
        BlockKit.birthdayDM({ firstName: getFirstNameSafe_(row[COL.ONBOARDING.FULL_NAME - 1]) }),
        userId
      );
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
        BlockKit.anniversaryDM({
          firstName: getFirstNameSafe_(row[COL.ONBOARDING.FULL_NAME - 1]),
          years: years
        }),
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
