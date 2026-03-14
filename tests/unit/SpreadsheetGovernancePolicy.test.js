describe('SpreadsheetGovernancePolicy', () => {
  beforeEach(() => {
    jest.resetModules();
    global.Config = {
      getOnboardingSheetName: jest.fn(() => 'Onboarding'),
      getChecklistSheetName: jest.fn(() => 'Checklist Tasks'),
      getTrainingSheetName: jest.fn(() => 'Training'),
      getAuditSheetName: jest.fn(() => 'Audit')
    };
  });

  test('defines managed columns for core tabs', () => {
    const { SpreadsheetGovernancePolicy } = require('../../gas/SpreadsheetGovernancePolicy.gs');

    expect(SpreadsheetGovernancePolicy.POLICY.onboarding.managedColumns).toContain('onboarding_id');
    expect(SpreadsheetGovernancePolicy.POLICY.checklist.managedColumns).toContain('task_id');
    expect(SpreadsheetGovernancePolicy.POLICY.training.managedColumns).toContain('module_code');
    expect(SpreadsheetGovernancePolicy.POLICY.audit.managedColumns).toContain('audit_id');
  });

  test('identifies managed identity fields by sheet/header', () => {
    const { SpreadsheetGovernancePolicy } = require('../../gas/SpreadsheetGovernancePolicy.gs');

    expect(SpreadsheetGovernancePolicy.isManagedIdentityColumn('Onboarding', 'row_hash')).toBe(true);
    expect(SpreadsheetGovernancePolicy.isManagedIdentityColumn('Checklist Tasks', 'notes')).toBe(false);
  });
});
