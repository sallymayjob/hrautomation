function makeSheet(headers, rows, name) {
  const data = [headers].concat(rows || []);
  let parent = null;
  return {
    getName: jest.fn(() => name || 'Sheet'),
    getLastRow: jest.fn(() => data.length),
    getLastColumn: jest.fn(() => headers.length),
    getParent: jest.fn(() => parent),
    setParent: (p) => { parent = p; },
    getRange: jest.fn((r, c, numRows, numCols) => ({
      getValues: jest.fn(() => data.slice(r - 1, r - 1 + numRows).map((row) => row.slice(c - 1, c - 1 + numCols))),
      setValue: jest.fn((v) => { data[r - 1][c - 1] = v; }),
      setValues: jest.fn((vals) => { data[r - 1] = vals[0]; })
    })),
    appendRow: jest.fn((row) => data.push(row))
  };
}

function makeSpreadsheet(sheetsByName) {
  const spreadsheet = {
    getSheetByName: jest.fn((name) => sheetsByName[name] || null),
    insertSheet: jest.fn((name) => {
      const sheet = makeSheet(['key', 'value'], [], name || '_sys_config');
      sheet.setParent(spreadsheet);
      sheetsByName[name || '_sys_config'] = sheet;
      return sheet;
    })
  };
  Object.keys(sheetsByName).forEach((k) => sheetsByName[k].setParent && sheetsByName[k].setParent(spreadsheet));
  return spreadsheet;
}

describe('integration schema validation flow', () => {
  beforeEach(() => {
    jest.resetModules();
    global.SpreadsheetApp = { openById: jest.fn(), flush: jest.fn() };
    global.Utilities = { getUuid: jest.fn(() => 'uuid-1') };
    global.computeHash = jest.fn(() => 'hash');
    global.Config = {
      getOnboardingSpreadsheetId: jest.fn(() => 'onboarding-id'),
      getTrainingSpreadsheetId: jest.fn(() => 'training-id'),
      getAuditSpreadsheetId: jest.fn(() => 'audit-id'),
      getChecklistSpreadsheetId: jest.fn(() => 'checklist-id'),
      getOnboardingSheetName: jest.fn(() => 'Onboarding'),
      getTrainingSheetName: jest.fn(() => 'Training'),
      getAuditSheetName: jest.fn(() => 'Audit'),
      getChecklistSheetName: jest.fn(() => 'Checklist Tasks')
    };
  });

  test('accepts canonical training headers', () => {
    const training = makeSheet(['employee_id', 'module_code', 'module_name', 'assigned_date', 'due_date', 'completion_date', 'training_status', 'owner_email', 'reminder_count', 'last_reminder_at', 'last_updated_at', 'completion_hash', 'celebration_posted'], [], 'Training');
    const config = makeSheet(['key', 'value'], [['Training.schema_version', '1']], '_sys_config');
    const spreadsheet = makeSpreadsheet({ Training: training, _sys_config: config });
    SpreadsheetApp.openById.mockReturnValue(spreadsheet);

    const { SheetClient } = require('../../gas/SheetClient.gs');
    const client = new SheetClient();
    expect(client.validateSheetSchema_(training, 1, ['employee_id', 'module_code', 'module_name', 'assigned_date', 'due_date', 'completion_date', 'training_status', 'owner_email', 'reminder_count', 'last_reminder_at', 'last_updated_at', 'completion_hash', 'celebration_posted'])).toBe(true);
  });

  test('maps representative legacy headers to canonical training schema', () => {
    const training = makeSheet(['training_id', 'resource_code', 'resource_title', 'assigned_at', 'due_date', 'completed_at', 'status', 'manager_email', 'reminder_count', 'last_reminder_at', 'updated_at', 'completion_hash', 'celebration_posted'], [], 'Training');
    const config = makeSheet(['key', 'value'], [['Training.schema_version', '1']], '_sys_config');
    const spreadsheet = makeSpreadsheet({ Training: training, _sys_config: config });
    SpreadsheetApp.openById.mockReturnValue(spreadsheet);

    const { SheetClient } = require('../../gas/SheetClient.gs');
    const { CoreConstants } = require('../../gas/CoreConstants.gs');
    const client = new SheetClient();
    const spec = CoreConstants.SCHEMA.SHEET_DEFINITIONS.training;
    expect(client.validateSheetSchema_(training, spec.expectedVersion, spec.requiredHeaders, { legacyHeaderAliases: spec.legacyHeaderAliases })).toBe(true);
  });

  test('fails closed and writes audit entry when version marker mismatches', () => {
    const training = makeSheet(['employee_id', 'module_code', 'module_name', 'assigned_date', 'due_date', 'completion_date', 'training_status', 'owner_email', 'reminder_count', 'last_reminder_at', 'last_updated_at', 'completion_hash', 'celebration_posted'], [['E1', 'M1', 'Title', '2026-01-01', '2026-01-10', '', 'IN_PROGRESS', 'owner@example.com', 0, '', '', 'h1', false]], 'Training');
    const audit = makeSheet(['audit_id', 'event_timestamp', 'actor_email', 'entity_type', 'entity_id', 'action', 'details', 'event_hash'], [], 'Audit');
    const config = makeSheet(['key', 'value'], [['Training.schema_version', '0'], ['Audit.schema_version', '1']], '_sys_config');

    const trainingSpreadsheet = makeSpreadsheet({ Training: training, _sys_config: config });
    const auditSpreadsheet = makeSpreadsheet({ Audit: audit, _sys_config: config });
    SpreadsheetApp.openById.mockImplementation((id) => ({ 'training-id': trainingSpreadsheet, 'audit-id': auditSpreadsheet, 'onboarding-id': trainingSpreadsheet }[id]));

    const { SheetClient } = require('../../gas/SheetClient.gs');
    const client = new SheetClient();

    expect(() => client.safeWrite_('Training', () => 'ok', { operation: 'integration_test' })).toThrow('Version marker mismatch for Training.schema_version');
    expect(audit.appendRow).toHaveBeenCalled();
    const payload = JSON.parse(audit.appendRow.mock.calls[0][0][6]);
    expect(payload.type).toBe('SCHEMA_DRIFT_DETECTED');
    expect(payload.error).toContain('Version marker mismatch for Training.schema_version');
  });
});
