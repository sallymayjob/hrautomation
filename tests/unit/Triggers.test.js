describe('Triggers', () => {
  beforeEach(() => {
    jest.resetModules();
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

    const result = validateRequiredTriggers({
      projectTriggers: [
        { getHandlerFunction: jest.fn(() => 'runDailyReminders') },
        { getHandlerFunction: jest.fn(() => 'runOnboardingBusinessHours') }
      ],
      auditService,
      slackClient,
      logHealth: true,
      notify: true
    });

    expect(result.healthy).toBe(false);
    expect(result.missingHandlers).toContain('runAudit');
    expect(auditService.logEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'TRIGGER_MISSING'
    }));
    expect(slackClient.postMessage).toHaveBeenCalled();
    expect(global.MailApp.sendEmail).toHaveBeenCalled();
  });

  test('countTriggerHandlers_ returns occurrence counts per handler', () => {
    const { countTriggerHandlers_ } = require('../../gas/Triggers.gs');

    const counts = countTriggerHandlers_([
      { getHandlerFunction: jest.fn(() => 'runAudit') },
      { getHandlerFunction: jest.fn(() => 'runAudit') },
      { getHandlerFunction: jest.fn(() => 'runTrainingSync') }
    ]);

    expect(counts).toEqual({
      runAudit: 2,
      runTrainingSync: 1
    });
  });
});
