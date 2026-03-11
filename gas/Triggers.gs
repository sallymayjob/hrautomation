/* global ScriptApp, runDailyReminders, checkBirthdaysAndAnniversaries */
/**
 * @fileoverview Trigger setup and teardown helpers.
 */

var TRIGGER_HANDLERS = {
  DAILY_REMINDERS: 'runDailyReminders',
  BIRTHDAY_CHECK: 'checkBirthdaysAndAnniversaries'
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
    if (handler === TRIGGER_HANDLERS.DAILY_REMINDERS || handler === TRIGGER_HANDLERS.BIRTHDAY_CHECK) {
      ScriptApp.deleteTrigger(triggers[i]);
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

if (typeof module !== 'undefined') {
  module.exports = {
    setupDailyTrigger: setupDailyTrigger,
    setupBirthdayTrigger: setupBirthdayTrigger,
    teardownAllTriggers: teardownAllTriggers
  };
}
