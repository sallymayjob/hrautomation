describe('Triggers', () => {
  beforeEach(() => {
    jest.resetModules();
    global.runOnboarding = jest.fn(() => ({ ok: true }));
    global.ScriptApp = {
      WeekDay: { SUNDAY: 'SUNDAY' },
      getProjectTriggers: jest.fn(() => []),
      deleteTrigger: jest.fn(),
      newTrigger: jest.fn(() => {
        var chain = {
          timeBased: jest.fn(() => chain),
          everyDays: jest.fn(() => chain),
          atHour: jest.fn(() => chain),
          everyMinutes: jest.fn(() => chain),
          onWeekDay: jest.fn(() => chain),
          create: jest.fn(() => ({}))
        };
        return chain;
      })
    };
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

  test('runOnboardingBusinessHours skips outside business windows', () => {
    const RealDate = Date;
    global.Date = class extends RealDate {
      constructor() {
        super('2026-03-14T20:00:00Z');
      }
    };

    const { runOnboardingBusinessHours } = require('../../gas/Triggers.gs');
    const result = runOnboardingBusinessHours();

    expect(result).toEqual({ skipped: true, reason: 'outside_business_hours' });
    expect(global.runOnboarding).not.toHaveBeenCalled();
    global.Date = RealDate;
  });
});
