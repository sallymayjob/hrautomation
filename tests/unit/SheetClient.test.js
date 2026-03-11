function mockGasGlobals() {
  global.SpreadsheetApp = { openById: jest.fn() };
  global.UrlFetchApp = { fetch: jest.fn() };
  global.Utilities = { formatDate: jest.fn(), getUuid: jest.fn(), computeDigest: jest.fn(), DigestAlgorithm: {}, Charset: {} };
  global.PropertiesService = { getScriptProperties: jest.fn() };
  global.Logger = { log: jest.fn() };
  global.ScriptApp = { newTrigger: jest.fn() };
}

function makeSheet(headers, rows) {
  const data = [headers].concat(rows);
  return {
    getName: jest.fn(() => 'Sheet'),
    getLastRow: jest.fn(() => data.length),
    getLastColumn: jest.fn(() => headers.length),
    getRange: jest.fn((r, c, numRows, numCols) => ({
      getValues: jest.fn(() => data.slice(r - 1, r - 1 + numRows).map((row) => row.slice(c - 1, c - 1 + numCols))),
      setValue: jest.fn(),
      setValues: jest.fn((vals) => { data[r - 1] = vals[0]; })
    })),
    appendRow: jest.fn((row) => data.push(row))
  };
}

describe('SheetClient', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGasGlobals();
    global.Config = {
      getSpreadsheetId: jest.fn(() => 'sheet-id'),
      getOnboardingSheetName: jest.fn(() => 'Onboarding'),
      getTrainingSheetName: jest.fn(() => 'Training'),
      getAuditSheetName: jest.fn(() => 'Audit'),
      getChecklistSheetName: jest.fn(() => 'Checklist Tasks')
    };
  });

  test('checkDuplicate supports header key and excludes row', () => {
    const onboarding = makeSheet(['employee id', 'row hash'], [['E1', 'h1'], ['E2', 'h2']]);
    SpreadsheetApp.openById.mockReturnValue({ getSheetByName: jest.fn(() => onboarding) });
    const { SheetClient } = require('../../gas/SheetClient.gs');
    const client = new SheetClient();
    expect(client.checkDuplicate('Onboarding', 'row_hash', 'h2')).toBe(3);
    expect(client.checkDuplicate('Onboarding', 'row_hash', 'h2', 3)).toBe(-1);
  });

  test('append and update training/onboarding/checklist statuses', () => {
    const onboarding = makeSheet(['onboarding_id', 'status'], [['OB-1', 'PENDING']]);
    const training = makeSheet(['employee_id', 'module_code', 'training_status', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'celebration_posted'], [['E1', 'M1', 'ASSIGNED', '', '', '', '', '', '', '', '', '', false]]);
    const audit = makeSheet(['audit_id', 'event_hash'], []);
    const checklist = makeSheet(['task_id', 'onboarding_id', 'status', 'notes'], [['DOC-001', 'OB-1', 'PENDING', '']]);
    SpreadsheetApp.openById.mockReturnValue({
      getSheetByName: jest.fn((n) => ({ Onboarding: onboarding, Training: training, Audit: audit, 'Checklist Tasks': checklist }[n])),
      insertSheet: jest.fn(() => checklist)
    });

    const { SheetClient } = require('../../gas/SheetClient.gs');
    const client = new SheetClient();
    expect(client.updateOnboardingStatus('OB-1', 'DONE')).toBe(true);
    expect(client.updateTrainingStatus('E1', 'M1', 'COMPLETED')).toBe(true);
    expect(client.markCelebrationPosted('E1', 'M1', 1)).toBe(true);
    expect(client.findChecklistTask('DOC-001', 'OB-1')).not.toBeNull();
    expect(client.updateChecklistTask('DOC-001', 'OB-1', { status: 'DONE', notes: 'ok' })).toBe(true);
  });
});
