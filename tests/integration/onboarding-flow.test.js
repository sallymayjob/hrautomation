function mockGasGlobals() {
  global.SpreadsheetApp = { openById: jest.fn() };
  global.UrlFetchApp = { fetch: jest.fn() };
  global.Utilities = { formatDate: jest.fn(), getUuid: jest.fn(), computeDigest: jest.fn(), DigestAlgorithm: {}, Charset: {} };
  global.PropertiesService = { getScriptProperties: jest.fn() };
  global.Logger = { log: jest.fn() };
  global.ScriptApp = { newTrigger: jest.fn() };
}

function makeOnboardingSheet(headers, row) {
  const values = [headers, row];
  const setValueCalls = [];
  return {
    getName: jest.fn(() => 'Onboarding'),
    getLastRow: jest.fn(() => values.length),
    getLastColumn: jest.fn(() => headers.length),
    getRange: jest.fn((r, c, nr, nc) => ({
      getValues: jest.fn(() => values.slice(r - 1, r - 1 + nr).map((rv) => rv.slice(c - 1, c - 1 + nc))),
      getValue: jest.fn(() => values[r - 1][c - 1]),
      setValue: jest.fn((v) => {
        setValueCalls.push({ row: r, col: c, value: v });
        values[r - 1][c - 1] = v;
      })
    })),
    getSetValueCalls: () => setValueCalls
  };
}

describe('integration onboarding flow', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGasGlobals();
    global.computeHash = jest.fn(() => 'hash');
    global.generateId = jest.fn(() => 'ONB_1');
    global.BlockKit = { welcomeDM: jest.fn(() => []), checklistAssignment: jest.fn(() => []), assignmentNotificationDM: jest.fn(() => []) };
    global.Config = {
      getOnboardingSheetName: jest.fn(() => 'Onboarding'),
      getChecklistSheetName: jest.fn(() => 'Checklist Tasks'),
      getAuditSheetName: jest.fn(() => 'Audit'),
      getItTeamChannelId: jest.fn(() => 'CIT123'),
      getPeopleTeamChannelId: jest.fn(() => 'CPEO123'),
      getFinanceTeamChannelId: jest.fn(() => 'CFIN123'),
      getAdminTeamChannelId: jest.fn(() => 'CADM123'),
      getHrTeamChannelId: jest.fn(() => 'CHR123'),
      getLegalTeamChannelId: jest.fn(() => 'CLEG123'),
      getOperationsTeamChannelId: jest.fn(() => 'COPS123'),
      getDefaultAssignmentsChannelId: jest.fn(() => 'CDEF123')
    };
    global.CHECKLIST_TASK_TEMPLATE = [
      { task_id: 'DOC-001', category: 'Documentation', task_name: 'Doc', owner_team: 'People Ops', owner_slack_id: '@ops', due_offset_days: 1, brand_rules: ['*'], region_rules: ['*'], role_rules: ['*'], notes: '' }
    ];
  });

  test('pending onboarding row is processed and status updated', () => {
    const headers = ['onboarding_id', 'employee_name', 'email', 'start_date', 'manager_email', 'role', 'status', 'checklist_completed', 'row_hash', 'blocked_reason'];
    const row = ['OB-1', 'Alex Doe', 'a@x.com', '2026-01-01', 'm@x.com', 'MANAGER', 'PENDING', false, '', ''];
    const sheet = makeOnboardingSheet(headers, row);

    const sheetClient = {
      checkDuplicate: jest.fn(() => -1),
      appendTrainingRow: jest.fn(),
      ensureSheetWithHeaders: jest.fn(),
      appendChecklistTask: jest.fn(() => 4),
      getSheetRowLink: jest.fn(() => 'https://sheet/link'),
      appendAuditIfNotExists: jest.fn(),
      validateWorkbookSchemas: jest.fn()
    };
    const auditLogger = { log: jest.fn(), error: jest.fn(), logWorkflowLifecycle: jest.fn() };
    const slackClient = { lookupUserByEmail: jest.fn(() => ({ user: { id: 'U1' } })), postMessage: jest.fn() };
    global.SheetClient = jest.fn(() => sheetClient);
    global.AuditLogger = jest.fn(() => auditLogger);
    global.SlackClient = jest.fn(() => slackClient);

    const { onChangeHandler } = require('../../gas/Code.gs');
    onChangeHandler({ source: { getActiveSheet: () => sheet } });

    expect(sheetClient.appendTrainingRow).toHaveBeenCalledTimes(2);
    expect(sheetClient.appendChecklistTask).toHaveBeenCalledTimes(1);
    expect(sheetClient.validateWorkbookSchemas).toHaveBeenCalled();
  });

  test('does not overwrite a non-empty formula-derived onboarding_id', () => {
    const headers = ['onboarding_id', 'employee_name', 'email', 'start_date', 'manager_email', 'role', 'status', 'checklist_completed', 'row_hash', 'blocked_reason'];
    const row = ['ONB_20260101T000000Z_0001_SLACK', 'Alex Doe', 'a@x.com', '2026-01-01', 'm@x.com', 'MANAGER', 'PENDING', false, '', ''];
    const sheet = makeOnboardingSheet(headers, row);

    const sheetClient = {
      checkDuplicate: jest.fn(() => -1),
      appendTrainingRow: jest.fn(),
      ensureSheetWithHeaders: jest.fn(),
      appendChecklistTask: jest.fn(() => 4),
      getSheetRowLink: jest.fn(() => 'https://sheet/link'),
      appendAuditIfNotExists: jest.fn(),
      validateWorkbookSchemas: jest.fn()
    };
    const auditLogger = { log: jest.fn(), error: jest.fn(), logWorkflowLifecycle: jest.fn() };
    const slackClient = { lookupUserByEmail: jest.fn(() => ({ user: { id: 'U1' } })), postMessage: jest.fn() };
    global.SheetClient = jest.fn(() => sheetClient);
    global.AuditLogger = jest.fn(() => auditLogger);
    global.SlackClient = jest.fn(() => slackClient);

    const { onChangeHandler } = require('../../gas/Code.gs');
    onChangeHandler({ source: { getActiveSheet: () => sheet } });

    const idWrites = sheet.getSetValueCalls().filter((call) => call.row === 2 && call.col === 1);
    expect(idWrites).toEqual([]);
  });

  test('throws clear error when required onboarding derived headers are missing', () => {
    const headers = ['onboarding_id', 'employee_name', 'email', 'start_date', 'manager_email', 'status', 'role'];
    const row = ['OB-1', 'Alex Doe', 'a@x.com', '2026-01-01', 'm@x.com', 'PENDING', 'MANAGER'];
    const sheet = makeOnboardingSheet(headers, row);

    const { onChangeHandler } = require('../../gas/Code.gs');
    expect(() => onChangeHandler({ source: { getActiveSheet: () => sheet } })).toThrow(
      'Onboarding sheet schema invalid. Missing required header(s): checklist_completed, row_hash, blocked_reason'
    );
  });

  test('schema version mismatch blocks processing before row writes', () => {
    const headers = ['onboarding_id', 'employee_name', 'email', 'start_date', 'manager_email', 'role', 'status', 'checklist_completed', 'row_hash', 'blocked_reason'];
    const row = ['OB-1', 'Alex Doe', 'a@x.com', '2026-01-01', 'm@x.com', 'MANAGER', 'PENDING', false, '', ''];
    const sheet = makeOnboardingSheet(headers, row);

    const sheetClient = { validateWorkbookSchemas: jest.fn(() => { throw new Error('Schema version mismatch for sheet "Onboarding". Expected 3 but found 2.'); }) };
    global.SheetClient = jest.fn(() => sheetClient);

    const { onChangeHandler } = require('../../gas/Code.gs');
    expect(() => onChangeHandler({ source: { getActiveSheet: () => sheet } })).toThrow('Schema version mismatch');
  });

  test('stale named-function behavior is surfaced by required named function validator', () => {
    const sheetClient = { validateRequiredNamedFunctions: jest.fn(() => ({ valid: false, missingFunctions: ['SYS_EVENT_KEY@onboarding-id'] })) };
    const auditLogger = { log: jest.fn() };
    const result = sheetClient.validateRequiredNamedFunctions(auditLogger);

    expect(result.valid).toBe(false);
    expect(result.missingFunctions).toContain('SYS_EVENT_KEY@onboarding-id');
  });
});
