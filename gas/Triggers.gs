/* global ScriptApp, runEnvironmentPreflight */
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
  TRAINING_SYNC: 'runTrainingSync',
  PERIODIC_VALIDATOR: 'runPeriodicValidator'
};


function validateStartupConfig_() {
  if (!Config || typeof Config.validateRequiredChannelConfig !== 'function') {
    throw new Error('Config.validateRequiredChannelConfig is required during startup trigger setup.');
  }
  Config.validateRequiredChannelConfig();
}

function setupDailyTrigger() {
  ensurePreflightPassBeforeTriggers_('setupDailyTrigger');
  ensureTimeTrigger_(TRIGGER_HANDLERS.DAILY_REMINDERS, 9);
}

function setupBirthdayTrigger() {
  ensurePreflightPassBeforeTriggers_('setupBirthdayTrigger');
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
      handler === TRIGGER_HANDLERS.TRAINING_SYNC ||
      handler === TRIGGER_HANDLERS.PERIODIC_VALIDATOR) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function setupOnboardingBusinessHoursTrigger() {
  ensurePreflightPassBeforeTriggers_('setupOnboardingBusinessHoursTrigger');
  ensureOnboardingTrigger_();
}

function setupAuditTriggers() {
  ensurePreflightPassBeforeTriggers_('setupAuditTriggers');
  ensureTimeTrigger_(TRIGGER_HANDLERS.AUDIT_DAILY, 7);
  ensureWeeklyTrigger_(TRIGGER_HANDLERS.AUDIT_WEEKLY_DEEP, ScriptApp.WeekDay.SUNDAY, 6);
}



function setupPeriodicValidatorTrigger() {
  ensureTimeTrigger_(TRIGGER_HANDLERS.PERIODIC_VALIDATOR, 5);
}

function setupTrainingTriggers() {
  ensurePreflightPassBeforeTriggers_('setupTrainingTriggers');
  ensureTimeTrigger_(TRIGGER_HANDLERS.TRAINING_ASSIGNMENTS, 6);
  ensureWeekdayTrigger_(TRIGGER_HANDLERS.TRAINING_REMINDERS, 9);
  ensureEveryHoursTrigger_(TRIGGER_HANDLERS.TRAINING_SYNC, 4);
}


function ensurePreflightPassBeforeTriggers_(source) {
  if (typeof runEnvironmentPreflight !== 'function') {
    return;
  }
  var preflight = runEnvironmentPreflight({ source: source || 'trigger_setup' });
  if (preflight && preflight.ok === false) {
    throw new Error('Environment preflight failed. Fix reported issues before enabling triggers.');
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
    setupPeriodicValidatorTrigger: setupPeriodicValidatorTrigger
  };
}
