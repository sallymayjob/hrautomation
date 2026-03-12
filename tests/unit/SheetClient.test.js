function mockGasGlobals() {
  global.SpreadsheetApp = { openById: jest.fn(), flush: jest.fn() };
  global.UrlFetchApp = { fetch: jest.fn() };
  global.Utilities = { formatDate: jest.fn(), getUuid: jest.fn(() => 'uuid-1'), computeDigest: jest.fn(), DigestAlgorithm: {}, Charset: {} };
  global.PropertiesService = { getScriptProperties: jest.fn() };
  global.Logger = { log: jest.fn() };
  global.ScriptApp = { newTrigger: jest.fn() };
  global.computeHash = jest.fn(() => 'hash');
}

function makeProbeSheet(name, missingFunctions) {
  const formulas = {};
  return {
    getName: jest.fn(() => name || '_sys_named_fn_probe'),
    clear: jest.fn(),
    getRange: jest.fn((r, c) => ({
      setFormula: jest.fn((formula) => {
        formulas[r + ':' + c] = formula;
      }),
      getDisplayValue: jest.fn(() => {
        const formula = formulas[r + ':' + c] || '';
        const missing = (missingFunctions || []).find((fnName) => formula.indexOf(fnName) > -1);
        return missing ? '#NAME?' : 'ok';
      })
    }))
  };
}

function makeSheet(headers, rows, name) {
  const data = [headers].concat(rows);
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
      setValues: jest.fn((vals) => { data[r - 1] = vals[0]; }),
      setFormula: jest.fn(),
      getDisplayValue: jest.fn(() => 'ok')
    })),
    appendRow: jest.fn((row) => data.push(row))
  };
}

function makeSpreadsheet(sheetsByName) {
  const spreadsheet = {
    getSheetByName: jest.fn((n) => sheetsByName[n] || null),
    insertSheet: jest.fn((name) => {
      const sheet = makeSheet(['key', 'value'], [], name || '_sys_config');
      sheet.setParent(spreadsheet);
      sheetsByName[name || '_sys_config'] = sheet;
      return sheet;
    }),
    deleteSheet: jest.fn()
  };
  Object.keys(sheetsByName).forEach((k) => {
    if (sheetsByName[k].setParent) {
      sheetsByName[k].setParent(spreadsheet);
    }
  });
  return spreadsheet;
}

describe('SheetClient', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGasGlobals();
    global.Config = {
      getOnboardingSpreadsheetId: jest.fn(() => 'onboarding-id'),
      getTrainingSpreadsheetId: jest.fn(() => 'training-id'),
      getAuditSpreadsheetId: jest.fn(() => 'audit-id'),
      getOnboardingSheetName: jest.fn(() => 'Onboarding'),
      getTrainingSheetName: jest.fn(() => 'Training'),
      getAuditSheetName: jest.fn(() => 'Audit'),
      getChecklistSheetName: jest.fn(() => 'Checklist Tasks')
    };
  });

  test('checkDuplicate supports header key and excludes row', () => {
    const onboarding = makeSheet(['employee id', 'row hash'], [['E1', 'h1'], ['E2', 'h2']], 'Onboarding');
    const config = makeSheet(['key', 'value'], [['Onboarding.schema_version', '3']], '_sys_config');
    const spreadsheet = makeSpreadsheet({ Onboarding: onboarding, _sys_config: config });
    SpreadsheetApp.openById.mockReturnValue(spreadsheet);
    const { SheetClient } = require('../../gas/SheetClient.gs');
    const client = new SheetClient();
    expect(client.checkDuplicate('Onboarding', 'row_hash', 'h2')).toBe(3);
    expect(client.checkDuplicate('Onboarding', 'row_hash', 'h2', 3)).toBe(-1);
  });

  test('append and update training/onboarding/checklist statuses', () => {
    const onboarding = makeSheet(['onboarding_id', 'employee_name', 'email', 'role', 'start_date', 'manager_email', 'status', 'checklist_completed', 'row_hash', 'blocked_reason'], [['OB-1', 'n', 'e', 'r', '2026-01-01', 'm', 'PENDING', false, '', '']], 'Onboarding');
    const training = makeSheet(['employee_id', 'module_code', 'module_name', 'assigned_date', 'due_date', 'completion_date', 'training_status', 'owner_email', 'reminder_count', 'last_reminder_at', 'last_updated_at', 'completion_hash', 'celebration_posted'], [['E1', 'M1', 'm', 'd', 'd', '', 'ASSIGNED', '', 0, '', '', '', false]], 'Training');
    const audit = makeSheet(['audit_id', 'event_timestamp', 'actor_email', 'entity_type', 'entity_id', 'action', 'details', 'event_hash'], [], 'Audit');
    const config = makeSheet(['key', 'value'], [['Onboarding.schema_version', '3'], ['Training.schema_version', '1'], ['Audit.schema_version', '1']], '_sys_config');
    const checklist = makeSheet(['task_id', 'onboarding_id', 'category', 'phase', 'task_name', 'owner_team', 'owner_slack_id', 'status', 'due_date', 'offset_type', 'offset_days', 'criticality', 'reminder_count', 'last_reminder_at', 'completed_at', 'completed_by', 'notes', 'event_hash', 'required_for_completion'], [['DOC-001', 'OB-1', 'Documentation', 'Documentation', 'Share employee handbook', 'People Ops', '@ops', 'PENDING', '', 'DAYS_FROM_START', 1, 'HIGH', 0, '', '', '', '', 'h1', true]], 'Checklist Tasks');

    const onboardingSpreadsheet = makeSpreadsheet({ Onboarding: onboarding, 'Checklist Tasks': checklist, _sys_config: config });
    const trainingSpreadsheet = makeSpreadsheet({ Training: training, _sys_config: config });
    const auditSpreadsheet = makeSpreadsheet({ Audit: audit, _sys_config: config });
    SpreadsheetApp.openById.mockImplementation((id) => ({ 'onboarding-id': onboardingSpreadsheet, 'training-id': trainingSpreadsheet, 'audit-id': auditSpreadsheet }[id]));

    const { SheetClient } = require('../../gas/SheetClient.gs');
    const client = new SheetClient();
    expect(client.updateOnboardingStatus('OB-1', 'DONE')).toBe(true);
    expect(client.updateTrainingStatus('E1', 'M1', 'COMPLETED')).toBe(true);
    expect(client.markCelebrationPosted('E1', 'M1', 1)).toBe(true);
    expect(client.findChecklistTask('DOC-001', 'OB-1')).not.toBeNull();
    expect(client.updateChecklistTask('DOC-001', 'OB-1', { status: 'DONE', notes: 'ok' })).toBe(true);
  });

  test('validateRequiredNamedFunctions reports missing named functions', () => {
    const onboarding = makeSheet(['onboarding_id'], [], 'Onboarding');
    const probeSheet = makeProbeSheet('_sys_named_fn_probe', ['SYS_EVENT_KEY']);
    const spreadsheet = {
      getSheetByName: jest.fn((name) => {
        if (name === '_sys_named_fn_probe') return probeSheet;
        return onboarding;
      }),
      insertSheet: jest.fn(() => probeSheet),
      deleteSheet: jest.fn()
    };

    SpreadsheetApp.openById.mockReturnValue(spreadsheet);

    const { SheetClient } = require('../../gas/SheetClient.gs');
    const client = new SheetClient();
    const auditLogger = { log: jest.fn() };
    const result = client.validateRequiredNamedFunctions(auditLogger);

    expect(result.valid).toBe(false);
    expect(result.missingFunctions.join(',')).toContain('SYS_EVENT_KEY');
    expect(auditLogger.log).toHaveBeenCalled();
  });

  test('schema version mismatch blocks write and appends structured audit error', () => {
    const onboarding = makeSheet(['onboarding_id', 'employee_name', 'email', 'role', 'start_date', 'manager_email', 'status', 'checklist_completed', 'row_hash', 'blocked_reason'], [['OB-1', 'n', 'e', 'r', '2026-01-01', 'm', 'PENDING', false, '', '']], 'Onboarding');
    const audit = makeSheet(['audit_id', 'event_timestamp', 'actor_email', 'entity_type', 'entity_id', 'action', 'details', 'event_hash'], [], 'Audit');
    const config = makeSheet(['key', 'value'], [['Onboarding.schema_version', '2'], ['Audit.schema_version', '1']], '_sys_config');

    const onboardingSpreadsheet = makeSpreadsheet({ Onboarding: onboarding, _sys_config: config });
    const auditSpreadsheet = makeSpreadsheet({ Audit: audit, _sys_config: config });
    SpreadsheetApp.openById.mockImplementation((id) => ({ 'onboarding-id': onboardingSpreadsheet, 'audit-id': auditSpreadsheet, 'training-id': onboardingSpreadsheet }[id]));

    const { SheetClient } = require('../../gas/SheetClient.gs');
    const client = new SheetClient();

    expect(() => client.updateOnboardingStatus('OB-1', 'IN_PROGRESS')).toThrow('Schema version mismatch');
    expect(audit.appendRow).toHaveBeenCalled();
    expect(JSON.parse(audit.appendRow.mock.calls[0][0][6]).type).toBe('SCHEMA_WRITE_BLOCKED');
  });

  test('completion gate blocks COMPLETE when required tasks are still pending', () => {
    const onboarding = makeSheet(['onboarding_id', 'employee_name', 'email', 'role', 'start_date', 'manager_email', 'status', 'checklist_completed', 'row_hash', 'blocked_reason'], [['OB-2', 'n', 'e', 'r', '2026-01-01', 'm', 'IN_PROGRESS', false, '', '']], 'Onboarding');
    const training = makeSheet(['employee_id', 'module_code', 'module_name', 'assigned_date', 'due_date', 'completion_date', 'training_status', 'owner_email', 'reminder_count', 'last_reminder_at', 'last_updated_at', 'completion_hash', 'celebration_posted'], [], 'Training');
    const audit = makeSheet(['audit_id', 'event_timestamp', 'actor_email', 'entity_type', 'entity_id', 'action', 'details', 'event_hash'], [], 'Audit');
    const config = makeSheet(['key', 'value'], [['Onboarding.schema_version', '3'], ['Training.schema_version', '1'], ['Audit.schema_version', '1']], '_sys_config');
    const checklist = makeSheet(
      ['task_id', 'onboarding_id', 'category', 'phase', 'task_name', 'owner_team', 'owner_slack_id', 'status', 'due_date', 'offset_type', 'offset_days', 'criticality', 'reminder_count', 'last_reminder_at', 'completed_at', 'completed_by', 'notes', 'event_hash', 'required_for_completion'],
      [
        ['DOC-001', 'OB-2', 'Documentation', 'Documentation', 'Collect signed contract', 'People Ops', '@ops', 'PENDING', '', 'DAYS_FROM_START', 1, 'HIGH', 0, '', '', '', '', 'h1', true],
        ['WRK-001', 'OB-2', 'Workspace', 'Pre-onboarding', 'Provision Google account test', 'IT', '@it', 'PENDING', '', 'DAYS_FROM_START', 0, 'HIGH', 0, '', '', '', '', 'h2', true]
      ],
      'Checklist Tasks'
    );

    const onboardingSpreadsheet = makeSpreadsheet({ Onboarding: onboarding, 'Checklist Tasks': checklist, _sys_config: config });
    const trainingSpreadsheet = makeSpreadsheet({ Training: training, _sys_config: config });
    const auditSpreadsheet = makeSpreadsheet({ Audit: audit, _sys_config: config });
    SpreadsheetApp.openById.mockImplementation((id) => ({ 'onboarding-id': onboardingSpreadsheet, 'training-id': trainingSpreadsheet, 'audit-id': auditSpreadsheet }[id]));

    const { SheetClient } = require('../../gas/SheetClient.gs');
    const client = new SheetClient();
    expect(client.updateOnboardingStatus('OB-2', 'COMPLETE')).toBe(false);

    var gate = client.evaluateOnboardingCompletionGate('OB-2');
    expect(gate.canComplete).toBe(false);
    expect(gate.blockedReason).toContain('Documentation');
    expect(gate.blockedReason).toContain('Pre-onboarding');
  });
});
