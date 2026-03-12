describe('SharedHrLibrary', () => {
  beforeEach(() => {
    jest.resetModules();
    global.generateId = jest.fn(() => 'TRACE_123');
    global.MailApp = { sendEmail: jest.fn() };
  });

  test('processOnboardingBatch returns structured result and operator-friendly errors', () => {
    const { processOnboardingBatch } = require('../../gas/SharedHrLibrary.gs');
    const result = processOnboardingBatch([
      {
        onboarding_id: 'ONB-1',
        employee_name: 'Ava Jones',
        email: 'ava@example.com',
        start_date: '2026-01-10',
        manager_email: 'manager@example.com'
      },
      {
        onboarding_id: '',
        employee_name: '',
        email: 'not-an-email',
        start_date: 'bad-date',
        manager_email: ''
      }
    ], { traceId: 'TRACE_BATCH' });

    expect(result).toEqual(expect.objectContaining({
      successCount: 1,
      errorCount: 5,
      traceId: 'TRACE_BATCH'
    }));
    expect(result.errors[0].message).toContain('Ask HR Ops');
  });

  test('runAuditChecks detects duplicate and missing audit fields', () => {
    const { runAuditChecks } = require('../../gas/SharedHrLibrary.gs');
    const result = runAuditChecks([
      { entity_id: 'ONB-1', action: 'UPDATE', event_timestamp: '2026-01-01T00:00:00Z' },
      { entity_id: 'ONB-1', action: 'UPDATE', event_timestamp: '2026-01-01T00:00:00Z' },
      { entity_id: '', action: '', event_timestamp: 'bad' }
    ], { traceId: 'TRACE_AUDIT' });

    expect(result.successCount).toBe(1);
    expect(result.errorCount).toBe(4);
    expect(result.traceId).toBe('TRACE_AUDIT');
    expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      'AUDIT_DUPLICATE_EVENT',
      'AUDIT_ENTITY_MISSING',
      'AUDIT_ACTION_MISSING',
      'AUDIT_TIMESTAMP_INVALID'
    ]));
  });

  test('writeExecutionLog logs when logger exists and reports clear failure when missing', () => {
    const { writeExecutionLog } = require('../../gas/SharedHrLibrary.gs');
    const logger = { log: jest.fn() };

    const success = writeExecutionLog({ traceId: 'TRACE_LOG', logger: logger, workflow: 'onboarding' }, {
      successCount: 2,
      errorCount: 0,
      errors: []
    });
    expect(success.successCount).toBe(1);
    expect(success.errorCount).toBe(0);
    expect(logger.log).toHaveBeenCalled();

    const failure = writeExecutionLog({ traceId: 'TRACE_LOG_2' }, { successCount: 1 });
    expect(failure.successCount).toBe(0);
    expect(failure.errorCount).toBe(1);
    expect(failure.errors[0].message).toContain('logging channel');
  });

  test('writeExecutionLog writes to Automation Logs and Exceptions tabs when spreadsheet is provided', () => {
    const { writeExecutionLog } = require('../../gas/SharedHrLibrary.gs');
    const automationLogSheet = { appendRow: jest.fn() };
    const exceptionsSheet = { appendRow: jest.fn() };
    const spreadsheet = {
      getSheetByName: jest.fn((name) => {
        if (name === 'Automation Logs') return automationLogSheet;
        if (name === 'Exceptions') return exceptionsSheet;
        return null;
      }),
      insertSheet: jest.fn((name) => (name === 'Automation Logs' ? automationLogSheet : exceptionsSheet))
    };

    const result = writeExecutionLog({
      spreadsheet,
      entries: [
        {
          timestamp: new Date('2026-01-01T00:00:00Z'),
          spreadsheetType: 'Onboarding',
          function: 'processOnboardingBatch',
          traceId: 'TRACE_X',
          recordKey: 'RUN-1',
          result: 'COMPLETED',
          errorMessage: ''
        },
        {
          timestamp: new Date('2026-01-01T00:00:01Z'),
          spreadsheetType: 'Onboarding',
          function: 'processOnboardingBatch',
          traceId: 'TRACE_X',
          recordKey: '2',
          result: 'FAILED',
          errorMessage: 'Invalid email'
        }
      ]
    }, {
      traceId: 'TRACE_X',
      successCount: 1,
      errorCount: 1,
      errors: [{ message: 'Invalid email' }]
    });

    expect(result.errorCount).toBe(0);
    expect(automationLogSheet.appendRow).toHaveBeenCalledTimes(2);
    expect(exceptionsSheet.appendRow).toHaveBeenCalledTimes(2);
  });



  test('training operations return structured counts and reuse logging/notification pathways', () => {
    const {
      processTrainingAssignments,
      runTrainingReminders,
      syncTrainingCompletion
    } = require('../../gas/SharedHrLibrary.gs');

    const logger = { log: jest.fn() };

    const assignmentResult = processTrainingAssignments([
      { employee_id: 'E1', module_code: 'SEC-101', role: 'Engineer' },
      { employee_id: '', module_code: '', role: '' }
    ], {
      traceId: 'TRACE_TRN_ASSIGN',
      logger,
      exceptionRecipients: ['hr-alerts@example.com']
    });

    expect(assignmentResult).toEqual(expect.objectContaining({
      successCount: 1,
      errorCount: 3,
      traceId: 'TRACE_TRN_ASSIGN',
      counts: expect.objectContaining({ assigned: 1 })
    }));
    expect(assignmentResult.logResult.errorCount).toBe(0);
    expect(assignmentResult.notificationResult.successCount).toBe(3);

    const reminderResult = runTrainingReminders([
      { employee_id: 'E1', module_code: 'A', due_date: '2026-01-02' },
      { employee_id: 'E2', module_code: 'B', due_date: '2025-12-20' },
      { employee_id: 'E3', module_code: 'C', due_date: '2026-02-10' }
    ], {
      traceId: 'TRACE_TRN_REM',
      now: new Date('2026-01-01T00:00:00Z'),
      reminderWindowDays: 3,
      logger
    });

    expect(reminderResult.successCount).toBe(3);
    expect(reminderResult.errorCount).toBe(0);
    expect(reminderResult.counts).toEqual(expect.objectContaining({
      dueSoon: 1,
      overdue: 1,
      notDue: 1
    }));

    const completionResult = syncTrainingCompletion([
      { employee_id: 'E1', module_code: 'A', training_status: 'completed', completion_date: '' },
      { employee_id: 'E2', module_code: 'B', training_status: 'in_progress', completion_date: '' },
      { employee_id: '', module_code: 'C', training_status: '' }
    ], {
      traceId: 'TRACE_TRN_SYNC',
      logger,
      exceptionRecipients: ['hr-alerts@example.com']
    });

    expect(completionResult.successCount).toBe(2);
    expect(completionResult.errorCount).toBe(2);
    expect(completionResult.counts).toEqual(expect.objectContaining({
      completed: 1,
      inProgress: 1,
      pending: 0
    }));
    expect(completionResult.updates).toHaveLength(2);
    expect(completionResult.updates[0].completionDate).toBeTruthy();
    expect(logger.log).toHaveBeenCalled();
    expect(global.MailApp.sendEmail).toHaveBeenCalled();
  });

  test('notifyExceptions sends alerts and returns structured errors for invalid inputs', () => {
    const { notifyExceptions } = require('../../gas/SharedHrLibrary.gs');

    const noRecipients = notifyExceptions([{ message: 'Something failed' }], []);
    expect(noRecipients.successCount).toBe(0);
    expect(noRecipients.errorCount).toBe(1);

    const result = notifyExceptions([
      { message: 'Primary failure', code: 'ROW_FAILED' },
      { code: 'MISSING_MESSAGE' }
    ], ['hr-alerts@example.com']);

    expect(result.successCount).toBe(1);
    expect(result.errorCount).toBe(1);
    expect(global.MailApp.sendEmail).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({
      traceId: 'TRACE_123'
    }));
  });
});
