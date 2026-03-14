describe('CommandsPolicy status normalization', () => {
  beforeEach(() => {
    jest.resetModules();
    const statusUtils = require('../../gas/CoreConstants.gs');
    global.CoreConstants = statusUtils.CoreConstants;
    global.normalizeChecklistStatus = statusUtils.normalizeChecklistStatus;
    global.isChecklistDoneStatus = statusUtils.isChecklistDoneStatus;
  });

  test('buildPhaseSnapshot_ treats DONE alias as COMPLETE for command summaries', () => {
    const { buildPhaseSnapshot_ } = require('../../gas/CommandsPolicy.gs');

    const snapshot = buildPhaseSnapshot_('ONB-1', [
      ['T-1', 'ONB-1', 'Pre-onboarding', 'Provision laptop', 'IT', '', 'DONE', '2026-03-10'],
      ['T-2', 'ONB-1', 'Documentation', 'Collect forms', 'People', '', 'PENDING', '2026-03-11']
    ]);

    expect(snapshot.totalTasks).toBe(2);
    expect(snapshot.completedTasks).toBe(1);
    expect(snapshot.dueItems[0].status).toBe('PENDING');
  });
});
