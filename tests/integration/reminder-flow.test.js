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
      TRAINING: { EMPLOYEE_ID: 1, MODULE_CODE: 2, MODULE_NAME: 3, DUE_DATE: 5, TRAINING_STATUS: 7, OWNER_EMAIL: 8, REMINDER_COUNT: 9 },
      CHECKLIST: { TASK_ID: 1, ONBOARDING_ID: 2, PHASE: 3, TASK_NAME: 4, OWNER_TEAM: 5, OWNER_SLACK_ID: 6, STATUS: 7, DUE_DATE: 8, NOTES: 11 },
      ONBOARDING: { EMAIL: 3, FULL_NAME: 2, START_DATE: 4, EMPLOYEE_ID: 1, MANAGER_EMAIL: 9 },
      AUDIT: { EVENT_HASH: 8 }
    };
    global.Config = {
      getAuditSheetName: jest.fn(() => 'Audit'),
      getOnboardingSpreadsheetId: jest.fn(() => 'onboarding-id'),
      getOnboardingSheetName: jest.fn(() => 'Onboarding'),
      getFinanceTeamChannelId: jest.fn(() => 'CFIN'),
      getAdminTeamChannelId: jest.fn(() => 'CADM'),
      getItTeamChannelId: jest.fn(() => 'CIT'),
      getLegalTeamChannelId: jest.fn(() => 'CLEG'),
      getOperationsTeamChannelId: jest.fn(() => 'COPS'),
      getPeopleTeamChannelId: jest.fn(() => 'CPEO'),
      getDefaultAssignmentsChannelId: jest.fn(() => 'CDEF')
    };
    global.BlockKit = { reminderDM: jest.fn(() => []), birthdayDM: jest.fn(() => []), anniversaryDM: jest.fn(() => []) };
    global.computeHash = jest.fn(() => 'hash');
    global.generateId = jest.fn(() => 'AUD_1');
    global.getDaysUntilDue = jest.fn(() => -4);
    global.SubmissionController = { createProposal: jest.fn(), commitLesson: jest.fn() };
    global.TrainingRepository = jest.fn((sheetClient) => ({
      getRows: jest.fn(() => sheetClient.getTrainingRows()),
      updateReminderMetadata: jest.fn((employeeId, moduleCode, reminderCount, lastReminderAt) => sheetClient.updateTrainingReminderMetadata(employeeId, moduleCode, reminderCount, lastReminderAt))
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

  test('overdue training sends reminder and manager escalation', () => {
    const postMessage = jest.fn();
    const sheetClient = {
      getTrainingRows: jest.fn(() => [['E1', 'M1', 'Module', '', new Date().toISOString(), '', 'ASSIGNED', 'mgr@x.com', 0]]),
      findOnboardingByEmployeeId: jest.fn(() => ({ values: ['E1', 'Alex', 'a@x.com', '', '', '', '', '', 'mgr@x.com'] })),
      checkDuplicate: jest.fn(() => -1),
      appendAuditIfNotExists: jest.fn(),
      getChecklistRows: jest.fn(() => [['DOC-1', 'E1', 'Documentation', 'Submit documents', 'People Ops', 'CPEO', 'PENDING', new Date().toISOString(), '', '', '']]),
      updateTrainingReminderMetadata: jest.fn(),
      updateChecklistReminderMetadata: jest.fn()
    };
    global.SheetClient = jest.fn(() => sheetClient);
    global.AuditLogger = jest.fn(() => ({ log: jest.fn() }));
    global.SlackClient = jest.fn(() => ({ lookupUserByEmail: jest.fn(() => ({ user: { id: 'U1' } })), postMessage }));

    const { runDailyReminders } = require('../../gas/Reminders.gs');
    runDailyReminders();

    expect(postMessage).toHaveBeenCalled();
    expect(sheetClient.appendAuditIfNotExists).toHaveBeenCalled();
    expect(global.SubmissionController.createProposal).not.toHaveBeenCalled();
    expect(global.SubmissionController.commitLesson).not.toHaveBeenCalled();
  });
});
