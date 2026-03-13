/* global SheetClient, SlackClient, AuditLogger, BlockKit, COL, Config, computeHash, generateId, getDaysUntilDue, Utils, TrainingRepository, OnboardingRepository, AuditRepository, LessonRepository */
/**
 * @fileoverview Daily reminder, escalation, and celebration reminder flows.
 */

var ReminderBindings_ = null;
if (typeof module !== "undefined") {
  ReminderBindings_ = {
    LessonRepository: require('./LessonRepository.gs').LessonRepository
  };
}

var REMINDER_THRESHOLDS = {
  REMINDER_DAYS: [3, 0],
  ESCALATE_AFTER_OVERDUE_DAYS: 3
};

function runDailyReminders() {
  var sheetClient = new SheetClient();
  var trainingRepository = new TrainingRepository(sheetClient);
  var onboardingRepository = new OnboardingRepository(sheetClient);
  var auditRepository = new AuditRepository(sheetClient);
  var LessonRepoCtor = (typeof LessonRepository !== "undefined" && LessonRepository) ? LessonRepository : (ReminderBindings_ && ReminderBindings_.LessonRepository);
  var lessonRepository = new LessonRepoCtor(sheetClient);
  processTrainingReminders_(sheetClient, trainingRepository, onboardingRepository, auditRepository);
  processChecklistReminders_(sheetClient, lessonRepository, onboardingRepository, auditRepository);
}

function processTrainingReminders_(sheetClient, trainingRepository, onboardingRepository, auditRepository) {
  var trainingRows = trainingRepository.getRows();
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
      sendTrainingReminderDM_(sheetClient, trainingRepository, onboardingRepository, auditRepository, row, daysUntil);
    }

    if (daysUntil <= -REMINDER_THRESHOLDS.ESCALATE_AFTER_OVERDUE_DAYS) {
      escalateTrainingToManager_(sheetClient, auditRepository, row);
    }
  }
}

function processChecklistReminders_(sheetClient, lessonRepository, onboardingRepository, auditRepository) {
  var checklistRows = lessonRepository.getRows();
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
      sendChecklistReminderDM_(sheetClient, lessonRepository, auditRepository, row, daysUntil);
    }

    if (daysUntil <= -REMINDER_THRESHOLDS.ESCALATE_AFTER_OVERDUE_DAYS) {
      escalateChecklistTask_(sheetClient, onboardingRepository, auditRepository, row, daysUntil);
    }
  }
}

function sendTrainingReminderDM_(sheetClient, trainingRepository, onboardingRepository, auditRepository, row, daysUntil) {
  var auditLogger = new AuditLogger(sheetClient);
  var slackClient = new SlackClient(auditLogger);
  var employeeId = row[COL.TRAINING.EMPLOYEE_ID - 1];
  var moduleCode = row[COL.TRAINING.MODULE_CODE - 1];
  var onboarding = onboardingRepository.findByEmployeeId(employeeId);
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
  if (auditRepository.checkDuplicate(reminderHash)) {
    return;
  }

  slackClient.postMessage(userId, BlockKit.reminderDM({
    daysUntilDue: daysUntil,
    moduleName: row[COL.TRAINING.MODULE_NAME - 1],
    dueDate: row[COL.TRAINING.DUE_DATE - 1]
  }));

  var nextCount = Number(row[COL.TRAINING.REMINDER_COUNT - 1] || 0) + 1;
  if (trainingRepository.updateReminderMetadata) {
    trainingRepository.updateReminderMetadata(employeeId, moduleCode, nextCount, new Date());
  }

  auditLogger.log({
    auditId: generateId('AUD'),
    entityType: 'Training',
    entityId: String(employeeId) + ':' + String(moduleCode),
    action: 'UPDATE',
    details: 'Reminder DM sent (' + daysUntil + ' days)'
  });
}

function escalateTrainingToManager_(sheetClient, auditRepository, row) {
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
  if (auditRepository.checkDuplicate(escalationHash)) {
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

  auditRepository.logOnce(escalationHash, auditRepository.newAuditRow('Training', String(employeeId) + ':' + String(moduleCode), 'UPDATE', 'Escalation DM sent to manager', escalationHash));
}

function parseReminderCountFromUpdatedBy_(value) {
  var text = String(value || '');
  var match = text.match(/system:reminder#(\d+)/);
  return match ? Number(match[1]) : 0;
}

function sendChecklistReminderDM_(sheetClient, lessonRepository, auditRepository, row, daysUntil) {
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
  if (auditRepository.checkDuplicate(reminderHash)) {
    return;
  }

  var taskName = row[COL.CHECKLIST.TASK_NAME - 1];
  slackClient.postMessage(destination.channelId, BlockKit.reminderDM({
    daysUntilDue: daysUntil,
    moduleName: 'Checklist task: ' + taskName,
    dueDate: row[COL.CHECKLIST.DUE_DATE - 1]
  }));

  var nextCount = parseReminderCountFromUpdatedBy_(row[COL.CHECKLIST.UPDATED_BY - 1]) + 1;
  lessonRepository.updateReminderMetadata(taskId, onboardingId, nextCount, new Date());

  auditRepository.logOnce(reminderHash, auditRepository.newAuditRow('ChecklistTask', String(onboardingId) + ':' + String(taskId), 'UPDATE', 'Checklist reminder sent to ' + destination.channelId + ' (' + daysUntil + ' days)', reminderHash));
}

function escalateChecklistTask_(sheetClient, onboardingRepository, auditRepository, row, daysUntil) {
  var auditLogger = new AuditLogger(sheetClient);
  var slackClient = new SlackClient(auditLogger);
  var onboardingId = row[COL.CHECKLIST.ONBOARDING_ID - 1];
  var taskId = row[COL.CHECKLIST.TASK_ID - 1];
  var taskName = row[COL.CHECKLIST.TASK_NAME - 1];
  var criticality = 'OVERDUE';

  var escalationDateKey = new Date().toISOString().slice(0, 10);
  var escalationHash = computeHash(['escalation', 'checklist', onboardingId, taskId, escalationDateKey]);
  if (auditRepository.checkDuplicate(escalationHash)) {
    return;
  }

  var blocks = [
    { type: 'section', text: { type: 'mrkdwn', text: ':rotating_light: Checklist task overdue by *' + Math.abs(daysUntil) + ' day(s)*.' } },
    { type: 'section', text: { type: 'mrkdwn', text: '*Onboarding:* ' + onboardingId + '\n*Task:* ' + taskName + '\n*Criticality:* ' + criticality } }
  ];

  // Checklist model no longer stores criticality; escalate overdue checklist tasks to HR ops consistently.
  slackClient.postMessage('#hr-ops-alerts', blocks);

  var onboarding = onboardingRepository.findByEmployeeId(onboardingId);
  var managerEmail = onboarding && onboarding.values ? onboarding.values[COL.ONBOARDING.MANAGER_EMAIL - 1] : '';
  if (managerEmail) {
    var managerLookup = slackClient.lookupUserByEmail(managerEmail);
    var managerSlackId = managerLookup && managerLookup.user ? managerLookup.user.id : '';
    if (managerSlackId) {
      slackClient.postMessage(managerSlackId, blocks);
    }
  }

  auditRepository.logOnce(escalationHash, auditRepository.newAuditRow('ChecklistTask', String(onboardingId) + ':' + String(taskId), 'UPDATE', 'Checklist escalation sent (criticality=' + criticality + ')', escalationHash));
}

function resolveChecklistOwnerDestination_(ownerTeam, ownerSlackId) {
  var cleanedDestination = String(ownerSlackId || '').trim();
  if (/^[CDGU][A-Z0-9]{8,}$/.test(cleanedDestination)) {
    return { channelId: cleanedDestination };
  }

  var teamKey = String(ownerTeam || '').trim().toUpperCase();
  var getterName = resolveReminderChannelGetterName_(teamKey);
  if (getterName && typeof Config[getterName] === 'function') {
    return { channelId: Config[getterName]() };
  }
  return { channelId: Config.getDefaultAssignmentsChannelId() };
}

function resolveReminderChannelGetterName_(teamKey) {
  var normalizedKey = String(teamKey || '').trim().toUpperCase();
  var routing = (Config && Config.CHANNEL_ROUTING) || {
    ADMIN: 'getAdminTeamChannelId',
    FINANCE: 'getFinanceTeamChannelId',
    HR: 'getHrTeamChannelId',
    IT: 'getItTeamChannelId',
    LEGAL: 'getLegalTeamChannelId',
    OPERATIONS: 'getOperationsTeamChannelId',
    PEOPLE: 'getPeopleTeamChannelId',
    'PEOPLE OPS': 'getPeopleTeamChannelId'
  };
  if (routing[normalizedKey]) return routing[normalizedKey];
  if (normalizedKey.indexOf('FINANCE') > -1) return routing.FINANCE;
  if (normalizedKey.indexOf('ADMIN') > -1) return routing.ADMIN;
  if (normalizedKey.indexOf('IT') > -1) return routing.IT;
  if (normalizedKey.indexOf('LEGAL') > -1) return routing.LEGAL;
  if (normalizedKey.indexOf('OPERATIONS') > -1) return routing.OPERATIONS;
  if (normalizedKey.indexOf('PEOPLE') > -1 || normalizedKey.indexOf('HR') > -1) return routing.PEOPLE;
  return '';
}

function sendReminderDM(row, daysUntil) {
  var sheetClient = new SheetClient();
  var trainingRepository = new TrainingRepository(sheetClient);
  var onboardingRepository = new OnboardingRepository(sheetClient);
  var auditRepository = new AuditRepository(sheetClient);
  return sendTrainingReminderDM_(sheetClient, trainingRepository, onboardingRepository, auditRepository, row, daysUntil);
}

function escalateToManager(row) {
  var sheetClient = new SheetClient();
  var auditRepository = new AuditRepository(sheetClient);
  return escalateTrainingToManager_(sheetClient, auditRepository, row);
}

function checkBirthdaysAndAnniversaries() {
  var sheetClient = new SheetClient();
  var onboardingRepository = new OnboardingRepository(sheetClient);
  var auditRepository = new AuditRepository(sheetClient);
  var auditLogger = new AuditLogger(sheetClient);
  var slackClient = new SlackClient(auditLogger);
  var onboardingData = onboardingRepository.getRowsWithHeaders();
  if (!onboardingData.rows.length) {
    return;
  }

  var headers = onboardingData.headers;
  var rows = onboardingData.rows;
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
      maybeSendCelebration_(auditRepository, slackClient, employeeId, 'birthday', BlockKit.birthdayDM({ firstName: getFirstNameSafe_(row[COL.ONBOARDING.FULL_NAME - 1]) }), userId);
    }

    var startDateValue = row[COL.ONBOARDING.START_DATE - 1];
    var anniversaryForYear = startDateValue ? getDateForCurrentYear_(startDateValue) : null;
    if (anniversaryForYear && getDaysUntilViaUtils_(anniversaryForYear) === 0) {
      var years = Math.max(today.getFullYear() - new Date(startDateValue).getFullYear(), 1);
      maybeSendCelebration_(
        auditRepository,
        slackClient,
        employeeId,
        'anniversary',
        BlockKit.anniversaryDM({ firstName: getFirstNameSafe_(row[COL.ONBOARDING.FULL_NAME - 1]), years: years }),
        userId
      );
    }
  }
}

function maybeSendCelebration_(auditRepository, slackClient, employeeId, eventType, blocks, userId) {
  var dateKey = new Date().toISOString().slice(0, 10);
  var eventHash = computeHash([eventType, employeeId, dateKey]);
  if (auditRepository.checkDuplicate(eventHash)) {
    return;
  }

  slackClient.postMessage(userId, blocks);

  auditRepository.logOnce(eventHash, auditRepository.newAuditRow('Employee', String(employeeId), 'UPDATE', eventType + ' DM sent', eventHash));
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
