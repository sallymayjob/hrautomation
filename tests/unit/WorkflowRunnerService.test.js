describe('WorkflowRunnerService', () => {
  beforeEach(() => {
    jest.resetModules();
    global.LockService = {
      getScriptLock: jest.fn(() => ({
        tryLock: jest.fn(() => true),
        releaseLock: jest.fn()
      }))
    };
  });

  test('runWorkflowRunner_ orchestrates lock, row adapter, telemetry, and completion callback', () => {
    const sheet = {
      getDataRange: jest.fn(() => ({
        getValues: jest.fn(() => [
          ['employee_id', 'status'],
          ['E-1', 'PENDING']
        ])
      }))
    };
    const spreadsheet = { getSheetByName: jest.fn(() => sheet) };
    global.SpreadsheetApp = { openById: jest.fn(() => spreadsheet) };

    const telemetry = jest.fn();
    const onCompleted = jest.fn();
    const execute = jest.fn((context) => ({
      result: { traceId: context.runId, successCount: context.rowPayload.rows.length, errorCount: 0, errors: [] },
      executionPayload: context.rowPayload
    }));

    const { runWorkflowRunner_ } = require('../../gas/WorkflowRunnerService.gs');
    const result = runWorkflowRunner_({
      workflowName: 'Onboarding',
      spreadsheetId: 'sheet-id',
      sheetName: 'Onboarding',
      rowAdapter: (payload) => ({ headers: payload.headers, rows: payload.rows.concat([{ employee_id: 'E-2' }]), rowIndexes: payload.rowIndexes.concat([999]) }),
      callbacks: {
        onTelemetry: telemetry,
        onCompleted: onCompleted
      },
      execute: execute
    });

    expect(result.successCount).toBe(2);
    expect(execute).toHaveBeenCalled();
    expect(telemetry).toHaveBeenCalledWith('STARTED', expect.objectContaining({ rowCount: 2 }));
    expect(telemetry).toHaveBeenCalledWith('COMPLETED', expect.objectContaining({ rowCount: 2 }));
    expect(onCompleted).toHaveBeenCalledWith(expect.objectContaining({ runId: expect.any(String) }));
  });

  test('runWorkflowRunner_ emits failed telemetry and invokes onFailed callback', () => {
    const sheet = {
      getDataRange: jest.fn(() => ({
        getValues: jest.fn(() => [
          ['employee_id'],
          ['E-1']
        ])
      }))
    };
    const spreadsheet = { getSheetByName: jest.fn(() => sheet) };
    global.SpreadsheetApp = { openById: jest.fn(() => spreadsheet) };

    const telemetry = jest.fn();
    const onFailed = jest.fn();
    const { runWorkflowRunner_ } = require('../../gas/WorkflowRunnerService.gs');

    expect(() => runWorkflowRunner_({
      workflowName: 'Audit',
      spreadsheetId: 'sheet-id',
      sheetName: 'Audit',
      callbacks: {
        onTelemetry: telemetry,
        onFailed: onFailed
      },
      execute: () => {
        throw new Error('boom');
      }
    })).toThrow('boom');

    expect(telemetry).toHaveBeenCalledWith('FAILED', expect.objectContaining({ error: 'boom' }));
    expect(onFailed).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(Error) }));
  });
});
