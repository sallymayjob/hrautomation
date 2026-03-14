describe('Triggers', () => {
  beforeEach(() => {
    jest.resetModules();
    global.Config = { validateRequiredChannelConfig: jest.fn() };
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
    global.Config = {
      getHrOpsAlertsChannelId: jest.fn(() => 'C-HR-OPS'),
      getHrAlertEmail: jest.fn(() => 'alerts@example.com')
    };
    global.SlackClient = jest.fn(() => ({ postMessage: jest.fn() }));
    global.MailApp = { sendEmail: jest.fn() };
    global.AuditService = jest.fn(() => ({ logEvent: jest.fn() }));
    global.SheetClient = jest.fn(() => ({}));
  });

  test('setupOnboardingBusinessHoursTrigger creates 15-minute trigger', () => {
    const { setupOnboardingBusinessHoursTrigger } = require('../../gas/Triggers.gs');

    setupOnboardingBusinessHoursTrigger();

    expect(global.ScriptApp.newTrigger).toHaveBeenCalledWith('runOnboardingBusinessHours');
    expect(global.Config.validateRequiredChannelConfig).toHaveBeenCalledTimes(1);
  });

  test('setupAuditTriggers creates daily and weekly triggers', () => {
    const { setupAuditTriggers } = require('../../gas/Triggers.gs');

    setupAuditTriggers();

    expect(global.ScriptApp.newTrigger).toHaveBeenCalledWith('runAudit');
    expect(global.ScriptApp.newTrigger).toHaveBeenCalledWith('runAuditDeepWeekly');
    expect(global.Config.validateRequiredChannelConfig).toHaveBeenCalledTimes(1);
  });



  test('setupPeriodicValidatorTrigger creates periodic validator trigger', () => {
    const { setupPeriodicValidatorTrigger } = require('../../gas/Triggers.gs');

    setupPeriodicValidatorTrigger();

    expect(global.ScriptApp.newTrigger).toHaveBeenCalledWith('runPeriodicValidator');
  });

  test('setupTrainingTriggers creates assignments/reminders/sync triggers', () => {
    const { setupTrainingTriggers } = require('../../gas/Triggers.gs');

    setupTrainingTriggers();

    expect(global.ScriptApp.newTrigger).toHaveBeenCalledWith('runTrainingAssignments');
    expect(global.ScriptApp.newTrigger).toHaveBeenCalledWith('runTrainingReminders');
    expect(global.ScriptApp.newTrigger).toHaveBeenCalledWith('runTrainingSync');
    expect(global.Config.validateRequiredChannelConfig).toHaveBeenCalledTimes(1);
  });

  test('validateRequiredTriggers reports healthy when all required handlers are present', () => {
    const { validateRequiredTriggers, listRequiredTriggerHandlers_ } = require('../../gas/Triggers.gs');
    const handlers = listRequiredTriggerHandlers_();

    const triggers = handlers.map((handler) => ({
      getHandlerFunction: jest.fn(() => handler)
    }));
    const auditService = { logEvent: jest.fn() };

    const result = validateRequiredTriggers({
      projectTriggers: triggers,
      auditService,
      logHealth: true,
      notify: false
    });

    expect(result.healthy).toBe(true);
    expect(result.missingHandlers).toEqual([]);
    expect(auditService.logEvent).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'Trigger',
      action: 'TRIGGER_HEALTHY'
    }));
  });

  test('validateRequiredTriggers reports missing handlers and can notify ops', () => {
    const { validateRequiredTriggers } = require('../../gas/Triggers.gs');
    const auditService = { logEvent: jest.fn() };
    const slackClient = { postMessage: jest.fn() };

  test('validateStartupConfig_ throws when Config validator is unavailable', () => {
    global.Config = {};
    const { validateStartupConfig_ } = require('../../gas/Triggers.gs');

    expect(() => validateStartupConfig_()).toThrow('Config.validateRequiredChannelConfig is required during startup trigger setup.');
  });

});
