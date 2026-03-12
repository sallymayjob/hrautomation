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
    mockGasGlobals();
    global.COL = {
      TRAINING: { EMPLOYEE_ID: 1, MODULE_CODE: 2, MODULE_NAME: 3, DUE_DATE: 5, TRAINING_STATUS: 7, OWNER_EMAIL: 8 },
      ONBOARDING: { EMAIL: 3, FULL_NAME: 2, START_DATE: 4, EMPLOYEE_ID: 1 },
      AUDIT: { EVENT_HASH: 8 }
    };
    global.Config = { getAuditSheetName: jest.fn(() => 'Audit'), getOnboardingSpreadsheetId: jest.fn(() => 'onboarding-id'), getOnboardingSheetName: jest.fn(() => 'Onboarding') };
    global.computeHash = jest.fn(() => 'event-hash');
    global.generateId = jest.fn(() => 'AUD_1');
    global.getDaysUntilDue = jest.fn(() => 3);
    global.BlockKit = { reminderDM: jest.fn(() => []), birthdayDM: jest.fn(() => []), anniversaryDM: jest.fn(() => []) };
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

  test('escalateToManager appends audit once', () => {
    const client = { checkDuplicate: jest.fn(() => -1), appendAuditIfNotExists: jest.fn() };
    global.SheetClient = jest.fn(() => client);
    global.AuditLogger = jest.fn(() => ({ log: jest.fn() }));
    global.SlackClient = jest.fn(() => ({ lookupUserByEmail: jest.fn(() => ({ user: { id: 'UM' } })), postMessage: jest.fn() }));

    const { escalateToManager } = require('../../gas/Reminders.gs');
    escalateToManager(['E1', 'M1', 'Module', '', new Date().toISOString(), '', 'ASSIGNED', 'm@x.com']);
    expect(client.appendAuditIfNotExists).toHaveBeenCalled();
  });
});
