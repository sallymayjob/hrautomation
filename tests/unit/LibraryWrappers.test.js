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
      runAuditChecks: jest.fn(() => ({ successCount: 1, errorCount: 0, errors: [], traceId: 'TRACE2' }))
    };
    global.MailApp = { sendEmail: jest.fn() };
    global.Session = { getActiveUser: jest.fn(() => ({ getEmail: () => 'operator@example.com' })) };
    global.console = { error: jest.fn() };
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
      [{ onboarding_id: 'ONB-1', employee_name: 'Ava', status: 'PENDING' }],
      expect.objectContaining({ sourceWorkflow: 'Onboarding' })
    );
    expect(sourceSheet.getRange).toHaveBeenCalledWith(2, 3);
    expect(MailApp.sendEmail).toHaveBeenCalled();
    expect(result.traceId).toBe('TRACE1');
  });

  test('runAudit calls audit entry point and writes run log even without status column', () => {
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
      [{ entity_id: 'ONB-1', action: 'UPDATE', event_timestamp: '2026-01-01T00:00:00Z' }],
      expect.objectContaining({ sourceWorkflow: 'Audit' })
    );
    expect(logSheet.appendRow).toHaveBeenCalled();
    expect(result.traceId).toBe('TRACE2');
  });
});
