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

var WEEKDAY_SEQUENCE_ = [
  ScriptApp.WeekDay.MONDAY,
  ScriptApp.WeekDay.TUESDAY,
  ScriptApp.WeekDay.WEDNESDAY,
  ScriptApp.WeekDay.THURSDAY,
  ScriptApp.WeekDay.FRIDAY
];

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
  reconcileTriggerSpecs_(handlerName, [
    { frequencyType: 'DAILY', hour: hour, weekday: null }
  ]);
}

function ensureOnboardingTrigger_() {
  reconcileTriggerSpecs_(TRIGGER_HANDLERS.ONBOARDING, [
    { frequencyType: 'EVERY_MINUTES', interval: 15, hour: null, weekday: null }
  ]);
}

function ensureWeeklyTrigger_(handlerName, weekDay, hour) {
  reconcileTriggerSpecs_(handlerName, [
    { frequencyType: 'WEEKLY', hour: hour, weekday: weekDay }
  ]);
}


function ensureWeekdayTrigger_(handlerName, hour) {
  var desiredSpecs = [];
  for (var i = 0; i < WEEKDAY_SEQUENCE_.length; i += 1) {
    desiredSpecs.push({ frequencyType: 'WEEKLY', hour: hour, weekday: WEEKDAY_SEQUENCE_[i] });
  }
  reconcileTriggerSpecs_(handlerName, desiredSpecs);
}

function ensureEveryHoursTrigger_(handlerName, hours) {
  reconcileTriggerSpecs_(handlerName, [
    { frequencyType: 'EVERY_HOURS', interval: hours, hour: null, weekday: null }
  ]);
}

function reconcileTriggerSpecs_(handlerName, desiredSpecs) {
  var triggers = ScriptApp.getProjectTriggers();
  var existing = [];
  var i;
  for (i = 0; i < triggers.length; i += 1) {
    if (triggers[i].getHandlerFunction() === handlerName) {
      existing.push({
        trigger: triggers[i],
        descriptor: buildTriggerDescriptor_(triggers[i]),
        matched: false
      });
    }
  }

  for (i = 0; i < desiredSpecs.length; i += 1) {
    var desiredDescriptor = buildTriggerDescriptorFromSpec_(handlerName, desiredSpecs[i]);
    var matchedEntry = findUnmatchedDescriptor_(existing, desiredDescriptor);
    if (matchedEntry) {
      matchedEntry.matched = true;
    } else {
      createTriggerForSpec_(handlerName, desiredSpecs[i]);
    }
  }

  for (i = 0; i < existing.length; i += 1) {
    if (!existing[i].matched) {
      ScriptApp.deleteTrigger(existing[i].trigger);
    }
  }
}

function findUnmatchedDescriptor_(existingEntries, desiredDescriptor) {
  for (var i = 0; i < existingEntries.length; i += 1) {
    if (!existingEntries[i].matched && areTriggerDescriptorsEqual_(existingEntries[i].descriptor, desiredDescriptor)) {
      return existingEntries[i];
    }
  }
  return null;
}

function buildTriggerDescriptor_(trigger) {
  var frequencyType = safeCall_(trigger, 'getFrequencyType', null);
  var hour = safeCall_(trigger, 'getHour', null);
  var weekday = safeCall_(trigger, 'getWeekDay', null);
  var interval = safeCall_(trigger, 'getInterval', null);

  if (!frequencyType) {
    if (weekday !== null && weekday !== undefined) {
      frequencyType = 'WEEKLY';
    } else if (hour !== null && hour !== undefined) {
      frequencyType = 'DAILY';
    }
  }

  return {
    handler: trigger.getHandlerFunction(),
    frequencyType: frequencyType || 'UNKNOWN',
    hour: hour === undefined ? null : hour,
    weekday: weekday === undefined ? null : weekday,
    interval: interval === undefined ? null : interval
  };
}

function buildTriggerDescriptorFromSpec_(handlerName, spec) {
  return {
    handler: handlerName,
    frequencyType: spec.frequencyType,
    hour: spec.hour === undefined ? null : spec.hour,
    weekday: spec.weekday === undefined ? null : spec.weekday,
    interval: spec.interval === undefined ? null : spec.interval
  };
}

function areTriggerDescriptorsEqual_(a, b) {
  return a.handler === b.handler &&
    a.frequencyType === b.frequencyType &&
    a.hour === b.hour &&
    a.weekday === b.weekday &&
    a.interval === b.interval;
}

function createTriggerForSpec_(handlerName, spec) {
  var builder = ScriptApp.newTrigger(handlerName).timeBased();
  if (spec.frequencyType === 'DAILY') {
    builder.everyDays(1).atHour(spec.hour).create();
    return;
  }
  if (spec.frequencyType === 'WEEKLY') {
    builder.onWeekDay(spec.weekday).atHour(spec.hour).create();
    return;
  }
  if (spec.frequencyType === 'EVERY_HOURS') {
    builder.everyHours(spec.interval).create();
    return;
  }
  if (spec.frequencyType === 'EVERY_MINUTES') {
    builder.everyMinutes(spec.interval).create();
    return;
  }
  throw new Error('Unsupported trigger frequency type: ' + spec.frequencyType);
}

function safeCall_(obj, methodName, fallback) {
  if (!obj || typeof obj[methodName] !== 'function') {
    return fallback;
  }
  return obj[methodName]();
}

if (typeof module !== 'undefined') {
  module.exports = {
    setupDailyTrigger: setupDailyTrigger,
    setupBirthdayTrigger: setupBirthdayTrigger,
    teardownAllTriggers: teardownAllTriggers,
    setupOnboardingBusinessHoursTrigger: setupOnboardingBusinessHoursTrigger,
    setupAuditTriggers: setupAuditTriggers,
    setupTrainingTriggers: setupTrainingTriggers,
    setupPeriodicValidatorTrigger: setupPeriodicValidatorTrigger,
    validateStartupConfig_: validateStartupConfig_
  };
}
