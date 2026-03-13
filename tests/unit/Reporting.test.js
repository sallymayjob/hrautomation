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
    global.generateId = jest.fn(() => 'AUD-1');
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

  test('postWeeklyMetrics only writes summary sheets and audit logs', () => {
    const ensureSheetWithHeaders = jest.fn(() => ({
      getLastRow: jest.fn(() => 1),
      getRange: jest.fn(() => ({ clearContent: jest.fn(), setValues: jest.fn() }))
    }));

    const trainingRows = [['', '', '', '', 2, '', 'COMPLETED']];
    const onboardingRows = [['OB-1', 'Alex', 'IN_PROGRESS', '']];
    const checklistRows = [['DOC-1', 'OB-1', 'Documentation', 'Task', 'People Ops', '', 'DONE', 1]];

    const sheetClient = {
      getTrainingRows: jest.fn(() => trainingRows),
      getOnboardingRows: jest.fn(() => onboardingRows),
      getChecklistRows: jest.fn(() => checklistRows),
      ensureSheetWithHeaders
    };

    const auditLog = jest.fn();
    global.SheetClient = jest.fn(() => sheetClient);
    global.AuditLogger = jest.fn(() => ({ log: auditLog }));
    global.AuditRepository = jest.fn(() => ({ log: auditLog }));

    const { postWeeklyMetrics } = require('../../gas/Reporting.gs');

    const trainingBefore = JSON.stringify(trainingRows);
    const onboardingBefore = JSON.stringify(onboardingRows);
    const checklistBefore = JSON.stringify(checklistRows);

    postWeeklyMetrics();

    expect(auditLog).toHaveBeenCalledTimes(2);
    expect(auditLog).toHaveBeenNthCalledWith(1, expect.objectContaining({
      entityType: 'Reporting',
      entityId: 'weekly_metrics',
      action: 'SUMMARY_REFRESH'
    }));
    expect(auditLog).toHaveBeenNthCalledWith(2, expect.objectContaining({
      entityType: 'Reporting',
      entityId: 'weekly_digest',
      action: 'SUMMARY_DIGEST'
    }));
    expect(ensureSheetWithHeaders).toHaveBeenCalled();
    expect(JSON.stringify(trainingRows)).toBe(trainingBefore);
    expect(JSON.stringify(onboardingRows)).toBe(onboardingBefore);
    expect(JSON.stringify(checklistRows)).toBe(checklistBefore);
  });
});
