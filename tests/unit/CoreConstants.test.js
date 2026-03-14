describe('CoreConstants status normalization', () => {
  test('normalizes checklist aliases to canonical COMPLETE', () => {
    const { normalizeChecklistStatus, isChecklistDoneStatus, CoreConstants } = require('../../gas/CoreConstants.gs');

    expect(normalizeChecklistStatus('done')).toBe(CoreConstants.STATUSES.COMPLETE);
    expect(normalizeChecklistStatus('Completed')).toBe(CoreConstants.STATUSES.COMPLETE);
    expect(isChecklistDoneStatus('DONE')).toBe(true);
    expect(isChecklistDoneStatus('COMPLETE')).toBe(true);
  });

  test('normalizes training aliases to canonical COMPLETED', () => {
    const { normalizeTrainingStatus, CoreConstants } = require('../../gas/CoreConstants.gs');

    expect(normalizeTrainingStatus('Completed')).toBe(CoreConstants.STATUSES.COMPLETED);
    expect(normalizeTrainingStatus('COMPLETE')).toBe(CoreConstants.STATUSES.COMPLETED);
    expect(normalizeTrainingStatus('In Progress')).toBe(CoreConstants.STATUSES.IN_PROGRESS);
  });
});
