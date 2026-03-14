function makeTrigger(handler, spec) {
  return {
    getHandlerFunction: jest.fn(() => handler),
    getFrequencyType: jest.fn(() => spec.frequencyType || null),
    getHour: jest.fn(() => (spec.hour === undefined ? null : spec.hour)),
    getWeekDay: jest.fn(() => (spec.weekday === undefined ? null : spec.weekday)),
    getInterval: jest.fn(() => (spec.interval === undefined ? null : spec.interval))
  };
}

function createScriptAppMock(initialSpecs) {
  var projectTriggers = initialSpecs.map((item) => makeTrigger(item.handler, item.spec));

  var scriptApp = {
    WeekDay: {
      SUNDAY: 'SUNDAY',
      MONDAY: 'MONDAY',
      TUESDAY: 'TUESDAY',
      WEDNESDAY: 'WEDNESDAY',
      THURSDAY: 'THURSDAY',
      FRIDAY: 'FRIDAY'
    },
    getProjectTriggers: jest.fn(() => projectTriggers),
    deleteTrigger: jest.fn((trigger) => {
      projectTriggers = projectTriggers.filter((t) => t !== trigger);
    }),
    newTrigger: jest.fn((handler) => {
      var state = { frequencyType: null, hour: null, weekday: null, interval: null };
      var chain = {
        timeBased: jest.fn(() => chain),
        everyDays: jest.fn(() => {
          state.frequencyType = 'DAILY';
          return chain;
        }),
        atHour: jest.fn((hour) => {
          state.hour = hour;
          return chain;
        }),
        everyMinutes: jest.fn((minutes) => {
          state.frequencyType = 'EVERY_MINUTES';
          state.interval = minutes;
          return chain;
        }),
        onWeekDay: jest.fn((weekday) => {
          state.frequencyType = 'WEEKLY';
          state.weekday = weekday;
          return chain;
        }),
        everyHours: jest.fn((hours) => {
          state.frequencyType = 'EVERY_HOURS';
          state.interval = hours;
          return chain;
        }),
        create: jest.fn(() => {
          var trigger = makeTrigger(handler, state);
          projectTriggers.push(trigger);
          return trigger;
        })
      };
      return chain;
    })
  };

  return {
    scriptApp: scriptApp,
    getTriggers: () => projectTriggers
  };
}

describe('Triggers', () => {
  beforeEach(() => {
    jest.resetModules();
    global.runEnvironmentPreflight = jest.fn(() => ({ ok: true }));

    var scriptAppState = createScriptAppMock([]);
    global.ScriptApp = scriptAppState.scriptApp;
    global.getMockProjectTriggers = scriptAppState.getTriggers;

    global.Config = {
      validateRequiredChannelConfig: jest.fn()
    };
  });

  test('setupDailyTrigger blocks trigger creation when preflight fails', () => {
    global.runEnvironmentPreflight = jest.fn(() => ({ ok: false, failures: [{ code: 'SCRIPT_PROPERTY_MISSING' }] }));
    const { setupDailyTrigger } = require('../../gas/Triggers.gs');

    expect(() => setupDailyTrigger()).toThrow('Environment preflight failed');
    expect(global.ScriptApp.newTrigger).not.toHaveBeenCalled();
  });

  test('setupTrainingTriggers reconciles partial weekday drift by creating missing weekdays', () => {
    var scriptAppState = createScriptAppMock([
      { handler: 'runTrainingAssignments', spec: { frequencyType: 'DAILY', hour: 6 } },
      { handler: 'runTrainingSync', spec: { frequencyType: 'EVERY_HOURS', interval: 4 } },
      { handler: 'runTrainingReminders', spec: { frequencyType: 'WEEKLY', hour: 9, weekday: 'MONDAY' } },
      { handler: 'runTrainingReminders', spec: { frequencyType: 'WEEKLY', hour: 9, weekday: 'TUESDAY' } }
    ]);
    global.ScriptApp = scriptAppState.scriptApp;

    const { setupTrainingTriggers } = require('../../gas/Triggers.gs');
    setupTrainingTriggers();

    var trainingReminderTriggers = scriptAppState.getTriggers().filter((trigger) => trigger.getHandlerFunction() === 'runTrainingReminders');
    var weekdays = trainingReminderTriggers.map((trigger) => trigger.getWeekDay()).sort();

    expect(trainingReminderTriggers).toHaveLength(5);
    expect(weekdays).toEqual(['FRIDAY', 'MONDAY', 'THURSDAY', 'TUESDAY', 'WEDNESDAY']);
    expect(global.ScriptApp.deleteTrigger).not.toHaveBeenCalled();
  });

  test('setupAuditTriggers removes duplicate and mismatched triggers', () => {
    var scriptAppState = createScriptAppMock([
      { handler: 'runAudit', spec: { frequencyType: 'DAILY', hour: 7 } },
      { handler: 'runAudit', spec: { frequencyType: 'DAILY', hour: 7 } },
      { handler: 'runAudit', spec: { frequencyType: 'DAILY', hour: 8 } },
      { handler: 'runAuditDeepWeekly', spec: { frequencyType: 'WEEKLY', weekday: 'SUNDAY', hour: 6 } }
    ]);
    global.ScriptApp = scriptAppState.scriptApp;

    const { setupAuditTriggers } = require('../../gas/Triggers.gs');
    setupAuditTriggers();

    var auditTriggers = scriptAppState.getTriggers().filter((trigger) => trigger.getHandlerFunction() === 'runAudit');
    expect(auditTriggers).toHaveLength(1);
    expect(auditTriggers[0].getHour()).toBe(7);
    expect(global.ScriptApp.deleteTrigger).toHaveBeenCalledTimes(2);
  });

  test('setupTrainingTriggers is idempotent across reruns', () => {
    const { setupTrainingTriggers } = require('../../gas/Triggers.gs');

    setupTrainingTriggers();
    var createdAfterFirstRun = global.ScriptApp.newTrigger.mock.calls.length;
    var deletedAfterFirstRun = global.ScriptApp.deleteTrigger.mock.calls.length;

    setupTrainingTriggers();

    expect(createdAfterFirstRun).toBe(7);
    expect(global.ScriptApp.newTrigger.mock.calls.length).toBe(createdAfterFirstRun);
    expect(deletedAfterFirstRun).toBe(0);
    expect(global.ScriptApp.deleteTrigger.mock.calls.length).toBe(0);
  });

  test('validateStartupConfig_ throws when Config validator is unavailable', () => {
    global.Config = {};
    const { validateStartupConfig_ } = require('../../gas/Triggers.gs');

    expect(() => validateStartupConfig_()).toThrow('Config.validateRequiredChannelConfig is required during startup trigger setup.');
  });
});
