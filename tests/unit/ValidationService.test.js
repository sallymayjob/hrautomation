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

  test('validateTemplateToChecklistMapping_ validates checklist field mapping conformance', () => {
    const { validateTemplateToChecklistMapping_ } = require('../../gas/ValidationService.gs');
    const requiredFields = ['task_id', 'phase', 'task_name', 'owner_team'];

    const missingMappingErrors = validateTemplateToChecklistMapping_({
      template_task_id: 'DOC-001',
      template_phase: 'Documentation',
      template_task_name: 'Share handbook',
      template_owner_team: 'People Ops'
    }, 0, {
      task_id: 'template_task_id',
      phase: 'template_phase',
      task_name: 'template_task_name'
    }, requiredFields);

    expect(missingMappingErrors.map((error) => error.code)).toContain('CHECKLIST_MAPPING_FIELD_MISSING');

    const missingSourceErrors = validateTemplateToChecklistMapping_({
      template_task_id: '',
      template_phase: 'Documentation',
      template_task_name: 'Share handbook',
      template_owner_team: 'People Ops'
    }, 1, {
      task_id: 'template_task_id',
      phase: 'template_phase',
      task_name: 'template_task_name',
      owner_team: 'template_owner_team'
    }, requiredFields);

    expect(missingSourceErrors.map((error) => error.code)).toContain('CHECKLIST_TEMPLATE_SOURCE_MISSING');

    const validErrors = validateTemplateToChecklistMapping_({
      template_task_id: 'DOC-001',
      template_phase: 'Documentation',
      template_task_name: 'Share handbook',
      template_owner_team: 'People Ops'
    }, 2, {
      task_id: 'template_task_id',
      phase: 'template_phase',
      task_name: ['template_task_name', 'fallback_task_name'],
      owner_team: 'template_owner_team'
    }, requiredFields);

    expect(validErrors).toHaveLength(0);
  });
});
