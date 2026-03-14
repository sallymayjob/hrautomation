/* global ScriptApp, AuditService, SheetClient, Config, SlackClient, MailApp, console */
/**
 * @fileoverview Trigger setup and teardown helpers.
 * CONTRACT: no SpreadsheetApp writes in this file.
 */

var TRIGGER_HANDLERS = {
  DAILY_REMINDERS: 'runDailyReminders',
  BIRTHDAY_CHECK: 'checkBirthdaysAndAnniversaries',
  ONBOARDING: 'runOnboardingBusinessHours',
  AUDIT_DAILY: 'runAudit',
  AUDIT_WEEKLY_DEEP: 'runAuditDeepWeekly',
  TRAINING_ASSIGNMENTS: 'runTrainingAssignments',
  TRAINING_REMINDERS: 'runTrainingReminders',
  TRAINING_SYNC: 'runTrainingSync'
};

function setupDailyTrigger() {
  ensureTimeTrigger_(TRIGGER_HANDLERS.DAILY_REMINDERS, 9);
}

function setupBirthdayTrigger() {
  ensureTimeTrigger_(TRIGGER_HANDLERS.BIRTHDAY_CHECK, 8);
}

function teardownAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i += 1) {
    var handler = triggers[i].getHandlerFunction();
    if (handler === TRIGGER_HANDLERS.DAILY_REMINDERS ||
      handler === TRIGGER_HANDLERS.BIRTHDAY_CHECK ||
      handler === TRIGGER_HANDLERS.ONBOARDING ||
      handler === TRIGGER_HANDLERS.AUDIT_DAILY ||
      handler === TRIGGER_HANDLERS.AUDIT_WEEKLY_DEEP ||
      handler === TRIGGER_HANDLERS.TRAINING_ASSIGNMENTS ||
      handler === TRIGGER_HANDLERS.TRAINING_REMINDERS ||
      handler === TRIGGER_HANDLERS.TRAINING_SYNC) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function setupOnboardingBusinessHoursTrigger() {
  ensureOnboardingTrigger_();
}

function setupAuditTriggers() {
  ensureTimeTrigger_(TRIGGER_HANDLERS.AUDIT_DAILY, 7);
  ensureWeeklyTrigger_(TRIGGER_HANDLERS.AUDIT_WEEKLY_DEEP, ScriptApp.WeekDay.SUNDAY, 6);
}


function setupTrainingTriggers() {
  ensureTimeTrigger_(TRIGGER_HANDLERS.TRAINING_ASSIGNMENTS, 6);
  ensureWeekdayTrigger_(TRIGGER_HANDLERS.TRAINING_REMINDERS, 9);
  ensureEveryHoursTrigger_(TRIGGER_HANDLERS.TRAINING_SYNC, 4);
}

function validateRequiredTriggers(options) {
  var opts = options || {};
  var requiredHandlers = opts.requiredHandlers || listRequiredTriggerHandlers_();
  var triggers = opts.projectTriggers || ScriptApp.getProjectTriggers();
  var handlerCounts = countTriggerHandlers_(triggers);
  var missingHandlers = [];

  for (var i = 0; i < requiredHandlers.length; i += 1) {
    if (!handlerCounts[requiredHandlers[i]]) {
      missingHandlers.push(requiredHandlers[i]);
    }
  }

  var result = {
    checkedAt: new Date(),
    requiredHandlers: requiredHandlers.slice(),
    presentHandlers: Object.keys(handlerCounts),
    missingHandlers: missingHandlers,
    healthy: missingHandlers.length === 0
  };

  if (opts.logHealth !== false) {
    logTriggerHealthResult_(result, opts.auditService);
  }
  if (opts.notify === true) {
    notifyTriggerHealth_(result, opts.slackClient);
  }

  return result;
}

function listRequiredTriggerHandlers_() {
  return [
    TRIGGER_HANDLERS.DAILY_REMINDERS,
    TRIGGER_HANDLERS.BIRTHDAY_CHECK,
    TRIGGER_HANDLERS.ONBOARDING,
    TRIGGER_HANDLERS.AUDIT_DAILY,
    TRIGGER_HANDLERS.AUDIT_WEEKLY_DEEP,
    TRIGGER_HANDLERS.TRAINING_ASSIGNMENTS,
    TRIGGER_HANDLERS.TRAINING_REMINDERS,
    TRIGGER_HANDLERS.TRAINING_SYNC
  ];
}

function countTriggerHandlers_(projectTriggers) {
  var counts = {};
  var triggers = projectTriggers || [];
  for (var i = 0; i < triggers.length; i += 1) {
    var handlerName = triggers[i].getHandlerFunction();
    counts[handlerName] = (counts[handlerName] || 0) + 1;
  }
  return counts;
}

function logTriggerHealthResult_(result, auditService) {
  var audit = auditService || createAuditService_();
  if (!audit || typeof audit.logEvent !== 'function') {
    return;
  }

  var action = result.healthy ? 'TRIGGER_HEALTHY' : 'TRIGGER_MISSING';
  var details = 'required=' + result.requiredHandlers.length +
    ', present=' + result.presentHandlers.length +
    ', missing=[' + result.missingHandlers.join(', ') + ']';

  audit.logEvent({
    entityType: 'Trigger',
    entityId: 'project',
    action: action,
    details: details
  });
}

function createAuditService_() {
  if (typeof AuditService === 'undefined' || !AuditService) {
    return null;
  }
  if (typeof SheetClient === 'undefined' || !SheetClient) {
    return new AuditService();
  }
  return new AuditService(new SheetClient());
}

function notifyTriggerHealth_(result, slackClient) {
  var message = buildTriggerHealthMessage_(result);
  notifyTriggerHealthSlack_(message, slackClient);
  notifyTriggerHealthEmail_(message);
}

function buildTriggerHealthMessage_(result) {
  return 'Trigger health check ' + (result.healthy ? 'passed' : 'failed') +
    '. Missing handlers: ' + (result.missingHandlers.length ? result.missingHandlers.join(', ') : 'none') +
    '. Present handlers: ' + result.presentHandlers.join(', ');
}

function notifyTriggerHealthSlack_(message, slackClient) {
  if (typeof Config === 'undefined' || !Config || typeof Config.getHrOpsAlertsChannelId !== 'function') {
    return;
  }

  var channelId = Config.getHrOpsAlertsChannelId();
  if (!channelId) {
    return;
  }

  var client = slackClient || (typeof SlackClient !== 'undefined' && SlackClient ? new SlackClient() : null);
  if (!client || typeof client.postMessage !== 'function') {
    return;
  }

  try {
    client.postMessage(channelId, [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Scheduled trigger health check*\n' + message
      }
    }]);
  } catch (err) {
    if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
      console.error('Failed to notify trigger health in Slack: ' + err);
    }
  }
}

function notifyTriggerHealthEmail_(message) {
  if (typeof MailApp === 'undefined' || !MailApp || typeof MailApp.sendEmail !== 'function') {
    return;
  }
  if (typeof Config === 'undefined' || !Config || typeof Config.getHrAlertEmail !== 'function') {
    return;
  }

  var recipient = Config.getHrAlertEmail();
  if (!recipient) {
    return;
  }

  try {
    MailApp.sendEmail({
      to: recipient,
      subject: 'HR Automation Trigger Health Check',
      body: message
    });
  } catch (err) {
    if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
      console.error('Failed to send trigger health email: ' + err);
    }
  }
}

function ensureTimeTrigger_(handlerName, hour) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i += 1) {
    if (triggers[i].getHandlerFunction() === handlerName) {
      return;
    }
  }

  ScriptApp.newTrigger(handlerName)
    .timeBased()
    .everyDays(1)
    .atHour(hour)
    .create();
}

function ensureOnboardingTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i += 1) {
    if (triggers[i].getHandlerFunction() === TRIGGER_HANDLERS.ONBOARDING) {
      return;
    }
  }

  ScriptApp.newTrigger(TRIGGER_HANDLERS.ONBOARDING)
    .timeBased()
    .everyMinutes(15)
    .create();
}

function ensureWeeklyTrigger_(handlerName, weekDay, hour) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i += 1) {
    if (triggers[i].getHandlerFunction() === handlerName) {
      return;
    }
  }

  ScriptApp.newTrigger(handlerName)
    .timeBased()
    .onWeekDay(weekDay)
    .atHour(hour)
    .create();
}


function ensureWeekdayTrigger_(handlerName, hour) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i += 1) {
    if (triggers[i].getHandlerFunction() === handlerName) {
      return;
    }
  }

  ScriptApp.newTrigger(handlerName)
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(hour)
    .create();
  ScriptApp.newTrigger(handlerName)
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.TUESDAY)
    .atHour(hour)
    .create();
  ScriptApp.newTrigger(handlerName)
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.WEDNESDAY)
    .atHour(hour)
    .create();
  ScriptApp.newTrigger(handlerName)
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.THURSDAY)
    .atHour(hour)
    .create();
  ScriptApp.newTrigger(handlerName)
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(hour)
    .create();
}

function ensureEveryHoursTrigger_(handlerName, hours) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i += 1) {
    if (triggers[i].getHandlerFunction() === handlerName) {
      return;
    }
  }

  ScriptApp.newTrigger(handlerName)
    .timeBased()
    .everyHours(hours)
    .create();
}

if (typeof module !== 'undefined') {
  module.exports = {
    setupDailyTrigger: setupDailyTrigger,
    setupBirthdayTrigger: setupBirthdayTrigger,
    teardownAllTriggers: teardownAllTriggers,
    setupOnboardingBusinessHoursTrigger: setupOnboardingBusinessHoursTrigger,
    setupAuditTriggers: setupAuditTriggers,
    setupTrainingTriggers: setupTrainingTriggers,
    validateRequiredTriggers: validateRequiredTriggers,
    listRequiredTriggerHandlers_: listRequiredTriggerHandlers_,
    countTriggerHandlers_: countTriggerHandlers_
  };
}
