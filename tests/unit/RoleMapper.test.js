function mockGasGlobals() {
  global.SpreadsheetApp = { openById: jest.fn() };
  global.UrlFetchApp = { fetch: jest.fn() };
  global.Utilities = { formatDate: jest.fn(), getUuid: jest.fn(), computeDigest: jest.fn(), DigestAlgorithm: {}, Charset: {} };
  global.PropertiesService = { getScriptProperties: jest.fn() };
  global.Logger = { log: jest.fn() };
  global.ScriptApp = { newTrigger: jest.fn() };
}

function createSheet(headers, row) {
  const values = [headers, row];
  return {
    getLastColumn: jest.fn(() => headers.length),
    getRange: jest.fn((r, c, nr, nc) => ({
      getValues: jest.fn(() => values.slice(r - 1, r - 1 + nr).map((rv) => rv.slice(c - 1, c - 1 + nc))),
      setValue: jest.fn((v) => { values[r - 1][c - 1] = v; }),
      getValue: jest.fn(() => values[r - 1][c - 1])
    }))
  };
}

describe('RoleMapper behavior via onboarding processing', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGasGlobals();
    global.computeHash = jest.fn(() => 'hash');
    global.generateId = jest.fn(() => 'ONB_1');
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
    global.CHECKLIST_TASK_TEMPLATE = [{
      task_id: 'IT-100',
      category: 'IT',
      task_name: 'Provision account',
      owner_team: 'IT',
      owner_slack_id: '@it-helpdesk',
      due_offset_days: 1,
      notes: '',
      brand_rules: ['*'],
      region_rules: ['*'],
      role_rules: ['*']
    }];
  });

  test('uses ENGINEER role resources and dispatches task assignment', () => {
    const headers = ['onboarding_id', 'employee_name', 'email', 'start_date', 'manager_email', 'role', 'status', 'row_hash'];
    const row = ['OB-1', 'Alex Doe', 'a@x.com', '2026-01-01', 'm@x.com', 'ENGINEER', 'PENDING', ''];
    const sheet = createSheet(headers, row);

    const sheetClientMock = {
      checkDuplicate: jest.fn(() => -1),
      appendTrainingRow: jest.fn(),
      ensureSheetWithHeaders: jest.fn(),
      appendChecklistTask: jest.fn(() => 4),
      getSheetRowLink: jest.fn(() => 'https://sheet/link'),
      appendAuditIfNotExists: jest.fn()
    };
    global.SheetClient = jest.fn(() => sheetClientMock);
    global.AuditLogger = jest.fn(() => ({ log: jest.fn(), error: jest.fn() }));
    const postMessage = jest.fn();
    global.SlackClient = jest.fn(() => ({
      lookupUserByEmail: jest.fn((email) => ({ user: { id: email === 'a@x.com' ? 'U1' : 'UM' } })),
      postMessage
    }));
    global.BlockKit = { welcomeDM: jest.fn(() => []), checklistAssignment: jest.fn(() => []) };

    const { processOnboardingRow_ } = require('../../gas/Code.gs');
    processOnboardingRow_(sheet, 2);

    expect(sheetClientMock.appendTrainingRow).toHaveBeenCalledTimes(2);
    expect(sheetClientMock.appendTrainingRow.mock.calls[0][0][1]).toBe('ENG-101');
    expect(postMessage).toHaveBeenCalledWith('CIT123', []);
    expect(sheetClientMock.appendAuditIfNotExists).toHaveBeenCalledTimes(1);
  });

  test('owner destination rules prefer direct Slack IDs and fallback to default', () => {
    const { resolveTaskOwnerDestination_ } = require('../../gas/Code.gs');
    expect(resolveTaskOwnerDestination_('Finance', 'C99999999').rule).toBe('direct_slack_id');
    expect(resolveTaskOwnerDestination_('Finance', '@finance').channelId).toBe('CFIN123');
    expect(resolveTaskOwnerDestination_('Unknown', '@alias').channelId).toBe('CDEF123');
  });
});
