describe('SpreadsheetPeriodicValidator', () => {
  beforeEach(() => {
    jest.resetModules();
    global.ValidationService = {
      validateManagedKeyStatusPattern_: jest.fn((row) => row.status ? [] : [{ code: 'MANAGED_STATUS_MISSING' }])
    };
  });

  test('validateManagedRowsForSheet_ flags invalid key/status patterns', () => {
    const { validateManagedRowsForSheet_ } = require('../../gas/SpreadsheetPeriodicValidator.gs');
    const sheet = {
      getName: () => 'Onboarding',
      getLastRow: () => 3,
      getLastColumn: () => 2,
      getRange: jest.fn((row, col, numRows) => {
        if (row === 1) {
          return { getValues: () => [['onboarding_id', 'status']] };
        }
        if (row === 2 && numRows === 2) {
          return { getValues: () => [['ONB-1', 'PENDING'], ['ONB-2', '']] };
        }
        return { getValues: () => [] };
      })
    };

    const summary = validateManagedRowsForSheet_(sheet, { keyColumns: ['onboarding_id'], statusColumn: 'status' });

    expect(summary.checked).toBe(2);
    expect(summary.errorCount).toBe(1);
  });
});
