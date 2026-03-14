function mockGasGlobals() {
  global.SpreadsheetApp = { openById: jest.fn() };
  global.UrlFetchApp = { fetch: jest.fn() };
  global.Utilities = { formatDate: jest.fn(), getUuid: jest.fn(), computeDigest: jest.fn(), DigestAlgorithm: {}, Charset: {} };
  global.PropertiesService = { getScriptProperties: jest.fn() };
  global.Logger = { log: jest.fn() };
  global.ScriptApp = { newTrigger: jest.fn() };
}

describe('Reminders', () => {
  beforeEach(() => {
    jest.resetModules();
    const statusUtils = require('../../gas/CoreConstants.gs');
    global.CoreConstants = statusUtils.CoreConstants;
    global.normalizeOnboardingStatus = statusUtils.normalizeOnboardingStatus;
    global.normalizeChecklistStatus = statusUtils.normalizeChecklistStatus;
    global.normalizeTrainingStatus = statusUtils.normalizeTrainingStatus;
    global.normalizeApprovalStatus = statusUtils.normalizeApprovalStatus;
    global.isChecklistDoneStatus = statusUtils.isChecklistDoneStatus;
    mockGasGlobals();
    global.COL = {
      TRAINING: { EMPLOYEE_ID: 1, MODULE_CODE: 2, MODULE_NAME: 3, DUE_DATE: 5, TRAINING_STATUS: 7, OWNER_EMAIL: 8 },
      ONBOARDING: { EMAIL: 3, FULL_NAME: 2, START_DATE: 4, EMPLOYEE_ID: 1 },
      AUDIT: { EVENT_HASH: 8 }
    };
    global.Config = { getAuditSheetName: jest.fn(() => 'Audit'), getOnboardingSpreadsheetId: jest.fn(() => 'onboarding-id'), getOnboardingSheetName: jest.fn(() => 'Onboarding'), CHANNEL_ROUTING: { HR: 'getHrTeamChannelId' } };
    global.computeHash = jest.fn(() => 'event-hash');
    global.generateId = jest.fn(() => 'AUD_1');
    global.getDaysUntilDue = jest.fn(() => 3);
    global.BlockKit = { reminderDM: jest.fn(() => []), birthdayDM: jest.fn(() => []), anniversaryDM: jest.fn(() => []) };
    global.TrainingRepository = jest.fn((sheetClient) => ({
      getRows: jest.fn(() => sheetClient.getTrainingRows()),
      updateReminderMetadata: jest.fn((employeeId, moduleCode, reminderCount, lastReminderAt) => sheetClient.updateTrainingReminderMetadata && sheetClient.updateTrainingReminderMetadata(employeeId, moduleCode, reminderCount, lastReminderAt)),
      updateReminderMetadataBatch: jest.fn((updates) => sheetClient.updateTrainingReminderMetadataBatch && sheetClient.updateTrainingReminderMetadataBatch(updates))
    }));
    global.OnboardingRepository = jest.fn((sheetClient) => ({
      findByEmployeeId: jest.fn((employeeId) => sheetClient.findOnboardingByEmployeeId(employeeId)),
      getRowsWithHeaders: jest.fn(() => ({ headers: [], rows: [] }))
    }));
    global.AuditRepository = jest.fn((sheetClient) => ({
      checkDuplicate: jest.fn((eventHash) => sheetClient.checkDuplicate('Audit', 8, eventHash) > -1),
      logOnce: jest.fn((eventHash, rowValues) => sheetClient.appendAuditIfNotExists(eventHash, rowValues)),
      newAuditRow: jest.fn((entityType, entityId, action, details, eventHash) => ['AUD_1', new Date(), 'system', entityType, entityId, action, details, eventHash])
    }));
  });

  test('sendReminderDM posts message and logs audit when not duplicate', () => {
    const client = {
      findOnboardingByEmployeeId: jest.fn(() => ({ values: ['E1', 'Alex', 'a@x.com'] })),
      checkDuplicate: jest.fn(() => -1)
    };
    global.SheetClient = jest.fn(() => client);
    global.AuditLogger = jest.fn(() => ({ log: jest.fn() }));
    const postMessage = jest.fn();
    global.SlackClient = jest.fn(() => ({ lookupUserByEmail: jest.fn(() => ({ user: { id: 'U1' } })), postMessage }));

    const { sendReminderDM } = require('../../gas/Reminders.gs');
    sendReminderDM(['E1', 'M1', 'Module', '', new Date().toISOString()], 3);
    expect(postMessage).toHaveBeenCalled();
  });



  test('sendReminderDM reuses cached Slack identity across repeated sends', () => {
    const client = {
      findOnboardingByEmployeeId: jest.fn(() => ({ values: ['E1', 'Alex', 'a@x.com'] })),
      checkDuplicate: jest.fn(() => -1)
    };
    global.SheetClient = jest.fn(() => client);
    global.AuditLogger = jest.fn(() => ({ log: jest.fn() }));
    const postMessage = jest.fn();
    const lookupUserByEmail = jest.fn(() => ({ user: { id: 'U1' } }));
    global.SlackClient = jest.fn(() => ({ lookupUserByEmail, postMessage }));

    const inMemory = {};
    global.getOrLoadScriptCache_ = jest.fn((key, ttlSeconds, loaderFn) => {
      if (Object.prototype.hasOwnProperty.call(inMemory, key)) {
        return inMemory[key];
      }
      const loaded = loaderFn();
      inMemory[key] = loaded;
      return loaded;
    });

    const { sendReminderDM } = require('../../gas/Reminders.gs');
    sendReminderDM(['E1', 'M1', 'Module', '', new Date().toISOString()], 3);
    sendReminderDM(['E1', 'M2', 'Module', '', new Date().toISOString()], 3);

    expect(lookupUserByEmail).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  test('sendReminderDM falls back when cache helper throws', () => {
    const client = {
      findOnboardingByEmployeeId: jest.fn(() => ({ values: ['E1', 'Alex', 'a@x.com'] })),
      checkDuplicate: jest.fn(() => -1)
    };
    global.SheetClient = jest.fn(() => client);
    global.AuditLogger = jest.fn(() => ({ log: jest.fn() }));
    const postMessage = jest.fn();
    const lookupUserByEmail = jest.fn(() => ({ user: { id: 'U1' } }));
    global.SlackClient = jest.fn(() => ({ lookupUserByEmail, postMessage }));
    global.getOrLoadScriptCache_ = jest.fn(() => { throw new Error('cache unavailable'); });

    const { sendReminderDM } = require('../../gas/Reminders.gs');
    sendReminderDM(['E1', 'M1', 'Module', '', new Date().toISOString()], 3);

    expect(lookupUserByEmail).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  test('escalateToManager appends audit once', () => {
    const client = { checkDuplicate: jest.fn(() => -1), appendAuditIfNotExists: jest.fn() };
    global.SheetClient = jest.fn(() => client);
    global.AuditLogger = jest.fn(() => ({ log: jest.fn() }));
    global.SlackClient = jest.fn(() => ({ lookupUserByEmail: jest.fn(() => ({ user: { id: 'UM' } })), postMessage: jest.fn() }));

    const { escalateToManager } = require('../../gas/Reminders.gs');
    escalateToManager(['E1', 'M1', 'Module', '', new Date().toISOString(), '', 'ASSIGNED', 'm@x.com']);
    expect(client.appendAuditIfNotExists).toHaveBeenCalled();
  });


  test('runDailyReminders uses batched reminder metadata persistence when available', () => {
    const client = {
      getTrainingRows: jest.fn(() => [['E1', 'M1', 'Module', '', new Date().toISOString(), '', 'ASSIGNED', 'm@x.com', 0]]),
      getChecklistRows: jest.fn(() => []),
      findOnboardingByEmployeeId: jest.fn(() => ({ values: ['E1', 'Alex', 'a@x.com'] })),
      checkDuplicate: jest.fn(() => -1),
      appendAuditIfNotExists: jest.fn(),
      updateTrainingReminderMetadataBatch: jest.fn()
    };
    global.SheetClient = jest.fn(() => client);
    global.AuditLogger = jest.fn(() => ({ log: jest.fn() }));
    global.SlackClient = jest.fn(() => ({ lookupUserByEmail: jest.fn(() => ({ user: { id: 'U1' } })), postMessage: jest.fn() }));

    const { runDailyReminders } = require('../../gas/Reminders.gs');
    runDailyReminders();

    expect(client.updateTrainingReminderMetadataBatch).toHaveBeenCalledTimes(1);
  });

});
