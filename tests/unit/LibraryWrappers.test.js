describe('LibraryWrappers', () => {
  function createSheet(rows) {
    return {
      getDataRange: jest.fn(() => ({ getValues: jest.fn(() => rows) })),
      getRange: jest.fn(() => ({ setValue: jest.fn() })),
      appendRow: jest.fn(),
      getLastRow: jest.fn(() => 0),
      clear: jest.fn()
    };
  }

  beforeEach(() => {
    jest.resetModules();
    global.Config = {
      getOnboardingSpreadsheetId: jest.fn(() => 'onboarding-spreadsheet-id'),
      getOnboardingSheetName: jest.fn(() => 'Onboarding'),
      getAuditSpreadsheetId: jest.fn(() => 'audit-spreadsheet-id'),
      getAuditSheetName: jest.fn(() => 'Audit'),
      getTrainingSpreadsheetId: jest.fn(() => 'training-spreadsheet-id'),
      getTrainingSheetName: jest.fn(() => 'Training'),
      getHrAlertEmail: jest.fn(() => 'alerts@example.com')
    };
    global.HRLib = {
      processOnboardingBatch: jest.fn(() => ({ successCount: 1, errorCount: 0, errors: [], traceId: 'TRACE1' })),
      runAuditChecks: jest.fn(() => ({ successCount: 1, errorCount: 0, errors: [], traceId: 'TRACE2' })),
      processTrainingAssignments: jest.fn(() => ({ successCount: 1, errorCount: 0, errors: [], traceId: 'TRACE3' })),
      runTrainingReminders: jest.fn(() => ({ successCount: 1, errorCount: 0, errors: [], traceId: 'TRACE4' })),
      syncTrainingCompletion: jest.fn(() => ({ successCount: 1, errorCount: 0, errors: [], traceId: 'TRACE5' })),
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
      ['onboarding_id', 'employee_name', 'email', 'start_date', 'status'],
      ['ONB-1', 'Ava', 'ava@example.com', '2026-01-01', 'PENDING']
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
      [expect.objectContaining({ onboarding_id: 'ONB-1', employee_name: 'Ava', email: 'ava@example.com', start_date: '2026-01-01', status: 'PENDING' })],
      expect.objectContaining({ sourceWorkflow: 'Onboarding' })
    );
    expect(sourceSheet.getRange).toHaveBeenCalledWith(2, 5);
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


  test('training wrappers call shared training methods and append logs summary', () => {
    const sourceSheet = createSheet([
      ['employee_id', 'module_code', 'training_status', 'due_date'],
      ['E-1', 'SEC-101', 'PENDING', '2026-01-03']
    ]);
    const logsSheet = { appendRow: jest.fn() };
    const spreadsheet = {
      getSheetByName: jest.fn((name) => (name === 'Training' ? sourceSheet : (name === 'Logs' ? logsSheet : null))),
      insertSheet: jest.fn(() => logsSheet)
    };
    global.SpreadsheetApp = { openById: jest.fn(() => spreadsheet) };

    const { runTrainingAssignments, runTrainingReminders, runTrainingSync } = require('../../gas/LibraryWrappers.gs');
    runTrainingAssignments();
    runTrainingReminders();
    runTrainingSync();

    expect(global.HRLib.processTrainingAssignments).toHaveBeenCalled();
    expect(global.HRLib.runTrainingReminders).toHaveBeenCalled();
    expect(global.HRLib.syncTrainingCompletion).toHaveBeenCalled();
    expect(logsSheet.appendRow).toHaveBeenCalled();
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

  test('onboarding handoff blocks rows missing WorkEmail or StartDate and logs exception details', () => {
    const sourceSheet = createSheet([
      ['employee_id', 'email', 'start_date', 'status'],
      ['E-1', '', '2026-01-01', 'PENDING']
    ]);
    const exceptionsSheet = { appendRow: jest.fn(), getLastRow: jest.fn(() => 0) };
    const dashboardSheet = { appendRow: jest.fn(), clear: jest.fn() };
    const logsSheet = { appendRow: jest.fn(), getLastRow: jest.fn(() => 0) };
    const spreadsheet = {
      getSheetByName: jest.fn((name) => {
        if (name === 'Onboarding') return sourceSheet;
        if (name === 'Exceptions') return exceptionsSheet;
        if (name === 'Handoff Dashboard') return dashboardSheet;
        if (name === 'Logs') return logsSheet;
        return null;
      }),
      insertSheet: jest.fn((name) => {
        if (name === 'Exceptions') return exceptionsSheet;
        if (name === 'Handoff Dashboard') return dashboardSheet;
        return logsSheet;
      })
    };
    global.SpreadsheetApp = { openById: jest.fn(() => spreadsheet) };

    const { runOnboarding } = require('../../gas/LibraryWrappers.gs');
    const result = runOnboarding();

    expect(global.HRLib.processOnboardingBatch).toHaveBeenCalledWith([], expect.any(Object));
    expect(exceptionsSheet.appendRow).toHaveBeenCalledWith(expect.arrayContaining(['timestamp', 'traceId', 'sheet', 'employeeId', 'reason']));
    expect(exceptionsSheet.appendRow).toHaveBeenCalledWith(expect.arrayContaining([expect.any(String), 'Onboarding', 'E-1', 'Onboarding -> Training requires WorkEmail and StartDate.']));
    expect(result.errorCount).toBe(1);
  });

  test('training-to-audit handoff requires COMPLETE status during training sync', () => {
    const sourceSheet = createSheet([
      ['employee_id', 'training_status', 'assigned_date'],
      ['E-1', 'ASSIGNED', '2026-01-01'],
      ['E-2', 'COMPLETE', '2026-01-01']
    ]);
    const exceptionsSheet = { appendRow: jest.fn(), getLastRow: jest.fn(() => 0) };
    const dashboardSheet = { appendRow: jest.fn(), clear: jest.fn() };
    const logsSheet = { appendRow: jest.fn(), getLastRow: jest.fn(() => 0) };
    const spreadsheet = {
      getSheetByName: jest.fn((name) => {
        if (name === 'Training') return sourceSheet;
        if (name === 'Exceptions') return exceptionsSheet;
        if (name === 'Handoff Dashboard') return dashboardSheet;
        if (name === 'Logs') return logsSheet;
        return null;
      }),
      insertSheet: jest.fn((name) => {
        if (name === 'Exceptions') return exceptionsSheet;
        if (name === 'Handoff Dashboard') return dashboardSheet;
        return logsSheet;
      })
    };
    global.SpreadsheetApp = { openById: jest.fn(() => spreadsheet) };

    const { runTrainingSync } = require('../../gas/LibraryWrappers.gs');
    const result = runTrainingSync();

    expect(global.HRLib.syncTrainingCompletion).toHaveBeenCalledWith(
      [expect.objectContaining({ employee_id: 'E-2', training_status: 'COMPLETE' })],
      expect.any(Object)
    );
    expect(exceptionsSheet.appendRow).toHaveBeenCalledWith(expect.arrayContaining([expect.any(String), 'Training', 'E-1', 'Training -> Audit requires TrainingStatus = COMPLETE.']));
    expect(result.errorCount).toBe(1);
    expect(dashboardSheet.appendRow).toHaveBeenCalledWith(['stage', 'employee_id', 'days_stuck', 'sla_days', 'reason']);
  });

});
