function mockGasGlobals() {
  global.SpreadsheetApp = { openById: jest.fn() };
  global.UrlFetchApp = { fetch: jest.fn() };
  global.Utilities = { formatDate: jest.fn(), getUuid: jest.fn(), computeDigest: jest.fn(), DigestAlgorithm: {}, Charset: {} };
  global.PropertiesService = { getScriptProperties: jest.fn() };
  global.Logger = { log: jest.fn() };
  global.ScriptApp = { newTrigger: jest.fn() };
}

describe('Reporting', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGasGlobals();

    global.COL = {
      ONBOARDING: { ONBOARDING_ID: 1, EMPLOYEE_NAME: 2, STATUS: 3, BLOCKED_REASON: 4 },
      CHECKLIST: { ONBOARDING_ID: 2, PHASE: 3, TASK_NAME: 4, OWNER_TEAM: 5, STATUS: 7, DUE_DATE: 8 },
      TRAINING: { TRAINING_STATUS: 7, DUE_DATE: 5 }
    };

    global.getDaysUntilDue = jest.fn((value) => Number(value));
    global.Config = { getHrTeamChannelId: jest.fn(() => 'CHR123') };
  });

  test('buildOnboardingMetrics computes task totals and completion percentage', () => {
    const { buildOnboardingMetrics_ } = require('../../gas/Reporting.gs');

    const onboardingRows = [
      ['OB-1', 'Alex', 'IN_PROGRESS', ''],
      ['OB-2', 'Pat', 'BLOCKED', 'Need legal sign-off']
    ];

    const checklistRows = [
      ['DOC-1', 'OB-1', 'Documentation', 'Send handbook', 'People Ops', '', 'DONE', 0],
      ['IT-1', 'OB-1', 'Workspace', 'Create laptop profile', 'IT', '', 'PENDING', -2],
      ['FIN-1', 'OB-2', 'Finance', 'Set payroll', 'Finance', '', 'PENDING', -4]
    ];

    const result = buildOnboardingMetrics_(onboardingRows, checklistRows);
    expect(result.byOnboardingId['OB-1'].tasks_total).toBe(2);
    expect(result.byOnboardingId['OB-1'].tasks_done).toBe(1);
    expect(result.byOnboardingId['OB-1'].tasks_overdue).toBe(1);
    expect(result.byOnboardingId['OB-1'].completion_pct).toBe(50);
    expect(result.blocked).toHaveLength(1);
    expect(result.blocked[0].onboarding_id).toBe('OB-2');
  });

  test('postWeeklyMetrics posts digest to HR approvals channel', () => {
    const ensureSheetWithHeaders = jest.fn(() => ({
      getLastRow: jest.fn(() => 1),
      getRange: jest.fn(() => ({ clearContent: jest.fn(), setValues: jest.fn() }))
    }));

    const sheetClient = {
      getTrainingRows: jest.fn(() => [['', '', '', '', 2, '', 'COMPLETED']]),
      getOnboardingRows: jest.fn(() => [['OB-1', 'Alex', 'IN_PROGRESS', '']]),
      getChecklistRows: jest.fn(() => [['DOC-1', 'OB-1', 'Documentation', 'Task', 'People Ops', '', 'DONE', 1]]),
      ensureSheetWithHeaders
    };

    const postMessage = jest.fn();
    global.SheetClient = jest.fn(() => sheetClient);
    global.notifyHrAlerts = jest.fn();
    global.AuditLogger = jest.fn(() => ({}));
    global.SlackClient = jest.fn(() => ({ postMessage }));

    const { postWeeklyMetrics } = require('../../gas/Reporting.gs');
    postWeeklyMetrics();

    expect(postMessage).toHaveBeenCalledWith('CHR123', expect.any(Array));
    expect(ensureSheetWithHeaders).toHaveBeenCalled();
  });
});
