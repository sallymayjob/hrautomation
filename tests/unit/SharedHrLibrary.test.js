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
