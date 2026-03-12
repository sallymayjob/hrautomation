describe('LibraryWrappers', () => {
  function createSheet(rows) {
    return {
      getDataRange: jest.fn(() => ({ getValues: jest.fn(() => rows) })),
      getRange: jest.fn(() => ({ setValue: jest.fn() })),
      appendRow: jest.fn()
    };
  }

  beforeEach(() => {
    jest.resetModules();
    global.Config = {
      getOnboardingSpreadsheetId: jest.fn(() => 'onboarding-spreadsheet-id'),
      getOnboardingSheetName: jest.fn(() => 'Onboarding'),
      getAuditSpreadsheetId: jest.fn(() => 'audit-spreadsheet-id'),
      getAuditSheetName: jest.fn(() => 'Audit'),
      getHrAlertEmail: jest.fn(() => 'alerts@example.com')
    };
    global.HRLib = {
      processOnboardingBatch: jest.fn(() => ({ successCount: 1, errorCount: 0, errors: [], traceId: 'TRACE1' })),
      runAuditChecks: jest.fn(() => ({ successCount: 1, errorCount: 0, errors: [], traceId: 'TRACE2' })),
      writeExecutionLog: jest.fn(() => ({ successCount: 1, errorCount: 0, errors: [], traceId: 'TRACE_LOG' }))
    };
    global.MailApp = { sendEmail: jest.fn() };
    global.Session = { getActiveUser: jest.fn(() => ({ getEmail: () => 'operator@example.com' })) };
    global.console = { error: jest.fn(), log: jest.fn() };
    global.LockService = {
      getScriptLock: jest.fn(() => ({
        tryLock: jest.fn(() => true),
        releaseLock: jest.fn()
      }))
    };
  });

  test('runOnboarding reads sheet rows, calls HRLib, writes status, and emails summary', () => {
    const sourceSheet = createSheet([
      ['onboarding_id', 'employee_name', 'status'],
      ['ONB-1', 'Ava', 'PENDING']
    ]);
    const logSheet = { appendRow: jest.fn() };
    const spreadsheet = {
      getSheetByName: jest.fn((name) => (name === 'Onboarding' ? sourceSheet : logSheet)),
      insertSheet: jest.fn(() => logSheet)
    };
    global.SpreadsheetApp = { openById: jest.fn(() => spreadsheet) };

    const { runOnboarding } = require('../../gas/LibraryWrappers.gs');
    const result = runOnboarding();

    expect(global.HRLib.processOnboardingBatch).toHaveBeenCalledWith(
      [expect.objectContaining({ onboarding_id: 'ONB-1', employee_name: 'Ava', status: 'PENDING' })],
      expect.objectContaining({ sourceWorkflow: 'Onboarding' })
    );
    expect(sourceSheet.getRange).toHaveBeenCalledWith(2, 3);
    expect(MailApp.sendEmail).toHaveBeenCalled();
    expect(result.traceId).toBe('TRACE1');
  });

  test('runAudit calls audit entry point and writes shared execution logs even without status column', () => {
    const sourceSheet = createSheet([
      ['Entity ID', 'Action', 'Event Timestamp'],
      ['ONB-1', 'UPDATE', '2026-01-01T00:00:00Z']
    ]);
    const logSheet = { appendRow: jest.fn() };
    const spreadsheet = {
      getSheetByName: jest.fn((name) => (name === 'Audit' ? sourceSheet : logSheet)),
      insertSheet: jest.fn(() => logSheet)
    };
    global.SpreadsheetApp = { openById: jest.fn(() => spreadsheet) };

    const { runAudit } = require('../../gas/LibraryWrappers.gs');
    const result = runAudit();

    expect(global.HRLib.runAuditChecks).toHaveBeenCalledWith(
      [expect.objectContaining({ entity_id: 'ONB-1', action: 'UPDATE', event_timestamp: '2026-01-01T00:00:00Z' })],
      expect.objectContaining({ sourceWorkflow: 'Audit' })
    );
    expect(global.HRLib.writeExecutionLog).toHaveBeenCalled();
    expect(result.traceId).toBe('TRACE2');
  });

  test('runLibraryWorkflow_ uses lock guard and releases lock', () => {
    const sourceSheet = createSheet([
      ['employee_id', 'status'],
      ['E-1', 'PENDING']
    ]);
    const logSheet = { appendRow: jest.fn() };
    const spreadsheet = {
      getSheetByName: jest.fn((name) => (name === 'Onboarding' ? sourceSheet : logSheet)),
      insertSheet: jest.fn(() => logSheet)
    };
    const lock = { tryLock: jest.fn(() => true), releaseLock: jest.fn() };
    global.LockService.getScriptLock.mockReturnValue(lock);
    global.SpreadsheetApp = { openById: jest.fn(() => spreadsheet) };

    const { runLibraryWorkflow_ } = require('../../gas/LibraryWrappers.gs');
    runLibraryWorkflow_({
      workflowName: 'Onboarding',
      spreadsheetId: 'onboarding-spreadsheet-id',
      sheetName: 'Onboarding',
      libraryMethodName: 'processOnboardingBatch',
      dateWindowMinutes: 15
    });

    expect(lock.tryLock).toHaveBeenCalled();
    expect(lock.releaseLock).toHaveBeenCalled();
  });

  test('runLibraryWorkflow_ logs failures to shared exception sink', () => {
    const sourceSheet = createSheet([
      ['employee_id', 'status'],
      ['E-1', 'PENDING']
    ]);
    const spreadsheet = {
      getSheetByName: jest.fn((name) => (name === 'Onboarding' ? sourceSheet : null)),
      insertSheet: jest.fn()
    };
    global.SpreadsheetApp = { openById: jest.fn(() => spreadsheet) };
    global.HRLib.processOnboardingBatch.mockImplementation(() => {
      throw new Error('Library failed');
    });

    const { runLibraryWorkflow_ } = require('../../gas/LibraryWrappers.gs');

    expect(() => runLibraryWorkflow_({
      workflowName: 'Onboarding',
      spreadsheetId: 'onboarding-spreadsheet-id',
      sheetName: 'Onboarding',
      libraryMethodName: 'processOnboardingBatch',
      dateWindowMinutes: 15
    })).toThrow('Library failed');

    expect(global.HRLib.writeExecutionLog).toHaveBeenCalled();
  });

});
