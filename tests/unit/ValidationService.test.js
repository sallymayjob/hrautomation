describe('ValidationService', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('validateOnboardingRow_ returns operator-friendly errors for invalid row', () => {
    const { validateOnboardingRow_ } = require('../../gas/ValidationService.gs');
    const errors = validateOnboardingRow_({
      onboarding_id: '',
      employee_name: '',
      email: 'not-an-email',
      start_date: 'bad-date',
      manager_email: ''
    }, 0);

    expect(errors).toHaveLength(5);
    expect(errors[0].code).toBe('ONBOARDING_ID_MISSING');
  });

  test('validateAuditRow_ relies on mapping service to detect duplicates', () => {
    const { validateAuditRow_ } = require('../../gas/ValidationService.gs');
    const seen = {};

    const firstPass = validateAuditRow_({
      entity_id: 'ONB-1',
      action: 'UPDATE',
      event_timestamp: '2026-01-01T00:00:00Z'
    }, 0, seen);
    const secondPass = validateAuditRow_({
      entity_id: 'ONB-1',
      action: 'UPDATE',
      event_timestamp: '2026-01-01T00:00:00Z'
    }, 1, seen);

    expect(firstPass).toHaveLength(0);
    expect(secondPass.map((e) => e.code)).toContain('AUDIT_DUPLICATE_EVENT');
  });
});
