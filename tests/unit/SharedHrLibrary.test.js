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
  test('training operations return structured counts for pure processing', () => {
    const {
      processTrainingAssignments,
      runTrainingReminders,
      syncTrainingCompletion
    } = require('../../gas/SharedHrLibrary.gs');


    const assignmentResult = processTrainingAssignments([
      { employee_id: 'E1', module_code: 'SEC-101', role: 'Engineer' },
      { employee_id: '', module_code: '', role: '' }
    ], {
      traceId: 'TRACE_TRN_ASSIGN'
    });

    expect(assignmentResult).toEqual(expect.objectContaining({
      successCount: 1,
      errorCount: 3,
      traceId: 'TRACE_TRN_ASSIGN',
      counts: expect.objectContaining({ assigned: 1 })
    }));
    const reminderResult = runTrainingReminders([
      { employee_id: 'E1', module_code: 'A', due_date: '2026-01-02' },
      { employee_id: 'E2', module_code: 'B', due_date: '2025-12-20' },
      { employee_id: 'E3', module_code: 'C', due_date: '2026-02-10' }
    ], {
      traceId: 'TRACE_TRN_REM',
      now: new Date('2026-01-01T00:00:00Z'),
      reminderWindowDays: 3,
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
      traceId: 'TRACE_TRN_SYNC'
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
  });
});
