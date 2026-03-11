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
  });

  test('uses ENGINEER role resources', () => {
    const headers = ['employee_id', 'full_name', 'email', 'start_date', 'manager_email', 'manager_name', 'role_title', 'status', 'row_hash'];
    const row = ['E1', 'Alex Doe', 'a@x.com', '2026-01-01', 'm@x.com', 'Manager', 'ENGINEER', 'PENDING', ''];
    const sheet = createSheet(headers, row);

    const sheetClientMock = { checkDuplicate: jest.fn(() => -1), appendTrainingRow: jest.fn() };
    global.SheetClient = jest.fn(() => sheetClientMock);
    global.AuditLogger = jest.fn(() => ({ log: jest.fn(), error: jest.fn() }));
    global.SlackClient = jest.fn(() => ({
      lookupUserByEmail: jest.fn((email) => ({ user: { id: email === 'a@x.com' ? 'U1' : 'UM' } })),
      postMessage: jest.fn()
    }));
    global.BlockKit = { welcomeDM: jest.fn(() => []) };

    const { processOnboardingRow_ } = require('../../gas/Code.gs');
    processOnboardingRow_(sheet, 2);

    expect(sheetClientMock.appendTrainingRow).toHaveBeenCalledTimes(2);
    expect(sheetClientMock.appendTrainingRow.mock.calls[0][0][1]).toBe('ENG-101');
  });
});
