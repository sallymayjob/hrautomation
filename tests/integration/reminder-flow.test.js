function mockGasGlobals() {
  global.SpreadsheetApp = { openById: jest.fn() };
  global.UrlFetchApp = { fetch: jest.fn() };
  global.Utilities = { formatDate: jest.fn(), getUuid: jest.fn(), computeDigest: jest.fn(), DigestAlgorithm: {}, Charset: {} };
  global.PropertiesService = { getScriptProperties: jest.fn() };
  global.Logger = { log: jest.fn() };
  global.ScriptApp = { newTrigger: jest.fn() };
}

describe('integration reminder flow', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGasGlobals();
    global.COL = {
      TRAINING: { EMPLOYEE_ID: 1, MODULE_CODE: 2, MODULE_NAME: 3, DUE_DATE: 5, TRAINING_STATUS: 7, OWNER_EMAIL: 8 },
      ONBOARDING: { EMAIL: 3, FULL_NAME: 2, START_DATE: 4, EMPLOYEE_ID: 1 },
      AUDIT: { EVENT_HASH: 8 }
    };
    global.Config = { getAuditSheetName: jest.fn(() => 'Audit'), getSpreadsheetId: jest.fn(() => 'id'), getOnboardingSheetName: jest.fn(() => 'Onboarding') };
    global.BlockKit = { reminderDM: jest.fn(() => []), birthdayDM: jest.fn(() => []), anniversaryDM: jest.fn(() => []) };
    global.computeHash = jest.fn(() => 'hash');
    global.generateId = jest.fn(() => 'AUD_1');
    global.getDaysUntilDue = jest.fn(() => -4);
  });

  test('overdue training sends reminder and manager escalation', () => {
    const postMessage = jest.fn();
    const sheetClient = {
      getTrainingRows: jest.fn(() => [['E1', 'M1', 'Module', '', new Date().toISOString(), '', 'ASSIGNED', 'mgr@x.com']]),
      findOnboardingByEmployeeId: jest.fn(() => ({ values: ['E1', 'Alex', 'a@x.com'] })),
      checkDuplicate: jest.fn(() => -1),
      appendAuditIfNotExists: jest.fn()
    };
    global.SheetClient = jest.fn(() => sheetClient);
    global.AuditLogger = jest.fn(() => ({ log: jest.fn() }));
    global.SlackClient = jest.fn(() => ({ lookupUserByEmail: jest.fn(() => ({ user: { id: 'U1' } })), postMessage }));

    const { runDailyReminders } = require('../../gas/Reminders.gs');
    runDailyReminders();

    expect(postMessage).toHaveBeenCalled();
    expect(sheetClient.appendAuditIfNotExists).toHaveBeenCalled();
  });
});
