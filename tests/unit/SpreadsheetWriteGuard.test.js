describe('SpreadsheetWriteGuard', () => {
  beforeEach(() => {
    jest.resetModules();
    global.Config = { KEYS: {} };
    global.PropertiesService = {
      getScriptProperties: jest.fn(() => ({
        getProperty: jest.fn((key) => {
          if (key === 'MANAGED_WRITE_GUARD_ENABLED') return 'true';
          if (key === 'MANAGED_WRITE_GUARD_MODE') return 'reject';
          return '';
        })
      }))
    };
    global.Session = { getActiveUser: jest.fn(() => ({ getEmail: () => 'ops@example.com' })) };
    global.AuditLogger = jest.fn(() => ({ log: jest.fn() }));
    global.SheetClient = jest.fn(() => ({ writeCellValue: jest.fn() }));
    global.SpreadsheetGovernancePolicy = {
      getPolicyForSheetName: jest.fn(() => ({ managedIdentityColumns: ['onboarding_id'] })),
      isManagedIdentityColumn: jest.fn((sheet, header) => header === 'onboarding_id')
    };
  });

  test('reject mode reverts manual edits to managed identity fields', () => {
    const { applyManagedIdentityWriteGuard } = require('../../gas/SpreadsheetWriteGuard.gs');
    const setValue = jest.fn();
    const sheet = {
      getName: () => 'Onboarding',
      getRange: jest.fn((row, col) => ({
        getValue: () => (row === 1 ? 'onboarding_id' : ''),
        setValue
      }))
    };
    const range = {
      getSheet: () => sheet,
      getNumRows: () => 1,
      getNumColumns: () => 1,
      getRow: () => 2,
      getColumn: () => 1
    };

    const result = applyManagedIdentityWriteGuard({ range, oldValue: 'ONB-1' });

    expect(result.blocked).toBe(true);
    expect(global.SheetClient).toHaveBeenCalled();
  });
});
