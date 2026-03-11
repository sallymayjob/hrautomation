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
  return {
    getName: jest.fn(() => 'Onboarding'),
    getLastRow: jest.fn(() => values.length),
    getLastColumn: jest.fn(() => headers.length),
    getRange: jest.fn((r, c, nr, nc) => ({
      getValues: jest.fn(() => values.slice(r - 1, r - 1 + nr).map((rv) => rv.slice(c - 1, c - 1 + nc))),
      getValue: jest.fn(() => values[r - 1][c - 1]),
      setValue: jest.fn((v) => { values[r - 1][c - 1] = v; })
    }))
  };
}

describe('integration onboarding flow', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGasGlobals();
    global.computeHash = jest.fn(() => 'hash');
    global.generateId = jest.fn(() => 'ONB_1');
    global.BlockKit = { welcomeDM: jest.fn(() => []), checklistAssignment: jest.fn(() => []) };
    global.Config = {
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
    const headers = ['onboarding_id', 'employee_name', 'email', 'start_date', 'manager_email', 'role', 'status', 'row_hash'];
    const row = ['OB-1', 'Alex Doe', 'a@x.com', '2026-01-01', 'm@x.com', 'MANAGER', 'PENDING', ''];
    const sheet = makeOnboardingSheet(headers, row);

    const sheetClient = {
      checkDuplicate: jest.fn(() => -1),
      appendTrainingRow: jest.fn(),
      ensureSheetWithHeaders: jest.fn(),
      appendChecklistTask: jest.fn(() => 4),
      getSheetRowLink: jest.fn(() => 'https://sheet/link'),
      appendAuditIfNotExists: jest.fn()
    };
    const auditLogger = { log: jest.fn(), error: jest.fn() };
    const slackClient = { lookupUserByEmail: jest.fn(() => ({ user: { id: 'U1' } })), postMessage: jest.fn() };
    global.SheetClient = jest.fn(() => sheetClient);
    global.AuditLogger = jest.fn(() => auditLogger);
    global.SlackClient = jest.fn(() => slackClient);

    const { onChangeHandler } = require('../../gas/Code.gs');
    onChangeHandler({ source: { getActiveSheet: () => sheet } });

    expect(sheetClient.appendTrainingRow).toHaveBeenCalledTimes(2);
    expect(sheetClient.appendChecklistTask).toHaveBeenCalledTimes(1);
    expect(auditLogger.log).toHaveBeenCalled();
    expect(slackClient.postMessage).toHaveBeenCalled();
  });

  test('throws clear error when required onboarding headers are missing', () => {
    const headers = ['onboarding_id', 'employee_name', 'email', 'start_date', 'manager_email', 'status'];
    const row = ['OB-1', 'Alex Doe', 'a@x.com', '2026-01-01', 'm@x.com', 'PENDING'];
    const sheet = makeOnboardingSheet(headers, row);

    const { onChangeHandler } = require('../../gas/Code.gs');
    expect(() => onChangeHandler({ source: { getActiveSheet: () => sheet } })).toThrow(
      'Onboarding sheet schema invalid. Missing required header(s): role'
    );
  });
});
