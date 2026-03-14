describe('Triggers', () => {
  beforeEach(() => {
    jest.resetModules();
    global.runEnvironmentPreflight = jest.fn(() => ({ ok: true }));
    global.ScriptApp = {
      WeekDay: { SUNDAY: 'SUNDAY', MONDAY: 'MONDAY', TUESDAY: 'TUESDAY', WEDNESDAY: 'WEDNESDAY', THURSDAY: 'THURSDAY', FRIDAY: 'FRIDAY' },
      getProjectTriggers: jest.fn(() => []),
      deleteTrigger: jest.fn(),
      newTrigger: jest.fn(() => {
        var chain = {
          timeBased: jest.fn(() => chain),
          everyDays: jest.fn(() => chain),
          atHour: jest.fn(() => chain),
          everyMinutes: jest.fn(() => chain),
          onWeekDay: jest.fn(() => chain),
          everyHours: jest.fn(() => chain),
          create: jest.fn(() => ({}))
        };
        return chain;
      })
    };
  });


  test('setupDailyTrigger blocks trigger creation when preflight fails', () => {
    global.runEnvironmentPreflight = jest.fn(() => ({ ok: false, failures: [{ code: 'SCRIPT_PROPERTY_MISSING' }] }));
    const { setupDailyTrigger } = require('../../gas/Triggers.gs');

    expect(() => setupDailyTrigger()).toThrow('Environment preflight failed');
    expect(global.ScriptApp.newTrigger).not.toHaveBeenCalled();
  });

  test('setupOnboardingBusinessHoursTrigger creates 15-minute trigger', () => {
    const { setupOnboardingBusinessHoursTrigger } = require('../../gas/Triggers.gs');

    setupOnboardingBusinessHoursTrigger();

    expect(global.ScriptApp.newTrigger).toHaveBeenCalledWith('runOnboardingBusinessHours');
  });

  test('setupAuditTriggers creates daily and weekly triggers', () => {
    const { setupAuditTriggers } = require('../../gas/Triggers.gs');

    setupAuditTriggers();

    expect(global.ScriptApp.newTrigger).toHaveBeenCalledWith('runAudit');
    expect(global.ScriptApp.newTrigger).toHaveBeenCalledWith('runAuditDeepWeekly');
  });


  test('setupTrainingTriggers creates assignments/reminders/sync triggers', () => {
    const { setupTrainingTriggers } = require('../../gas/Triggers.gs');

    setupTrainingTriggers();

    expect(global.ScriptApp.newTrigger).toHaveBeenCalledWith('runTrainingAssignments');
    expect(global.ScriptApp.newTrigger).toHaveBeenCalledWith('runTrainingReminders');
    expect(global.ScriptApp.newTrigger).toHaveBeenCalledWith('runTrainingSync');
  });


});
