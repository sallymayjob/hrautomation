function mockGasGlobals() {
  global.ContentService = {
    MimeType: { JSON: 'application/json' },
    createTextOutput: jest.fn(() => ({
      setMimeType: jest.fn(function () {
        return this;
      })
    }))
  };
}

describe('Commands', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGasGlobals();
  });

  test('resolveOnboardingCandidates_ prefers exact name matches', () => {
    const { resolveOnboardingCandidates_ } = require('../../gas/Commands.gs');
    const sheetClient = {
      getOnboardingRows: jest.fn(() => [
        ['ONB-1', 'Amelia Thompson', '', 'amelia@example.com', 'Engineer', '', new Date('2026-03-01'), '', 'manager@example.com', '', 'buddy@example.com', '', '', 'IN_PROGRESS'],
        ['ONB-2', 'Amelia Stone', '', 'amelia.s@example.com', 'Engineer', '', new Date('2026-03-05'), '', 'manager2@example.com', '', 'buddy2@example.com', '', '', 'PENDING']
      ])
    };

    const result = resolveOnboardingCandidates_('Amelia Thompson', sheetClient);
    expect(result.matchType).toBe('exact');
    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0].onboardingId).toBe('ONB-1');
  });

  test('handleOnboardingStatusCommand_ returns disambiguation for multiple fuzzy matches', () => {
    const { handleOnboardingStatusCommand_ } = require('../../gas/Commands.gs');
    const sheetClient = {
      getOnboardingRows: jest.fn(() => [
        ['ONB-1', 'Amelia Thompson', '', 'amelia@example.com', 'Engineer', '', '2026-03-01', '', 'manager@example.com', '', 'buddy@example.com', '', '', 'IN_PROGRESS'],
        ['ONB-2', 'Amelia Stone', '', 'amelia.s@example.com', 'Engineer', '', '2026-03-05', '', 'manager2@example.com', '', 'buddy2@example.com', '', '', 'PENDING']
      ]),
      getChecklistRows: jest.fn(() => [])
    };
    const auditLogger = { log: jest.fn() };

    const response = handleOnboardingStatusCommand_({ text: 'Amelia', user_name: 'hr-bot' }, sheetClient, auditLogger);

    expect(response.response_type).toBe('ephemeral');
    expect(response.text).toContain('Multiple matches found');
    expect(response.text).toContain('ONB-1');
    expect(response.text).toContain('ONB-2');
    expect(auditLogger.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'READ' }));
  });

  test('handleOnboardingStatusCommand_ returns status summary with phase snapshot and due items', () => {
    const { handleOnboardingStatusCommand_ } = require('../../gas/Commands.gs');
    const sheetClient = {
      getOnboardingRows: jest.fn(() => [
        ['ONB-42', 'Lachlan Fraser', '', 'lachlan@example.com', 'Resourcer', '', new Date('2026-03-04'), '', 'emma.brown@rwrgroup.com.au', '', 'buddy@rwrgroup.com.au', '', '', 'IN_PROGRESS']
      ]),
      getChecklistRows: jest.fn(() => [
        ['DOC-1', 'ONB-42', 'Documentation', 'Collect signed contract', 'People', '', 'PENDING', new Date('2026-03-06')],
        ['IT-1', 'ONB-42', 'Pre-onboarding', 'Provision laptop', 'IT', '', 'COMPLETE', new Date('2026-03-05')]
      ])
    };
    const auditLogger = { log: jest.fn() };

    const response = handleOnboardingStatusCommand_({ text: 'Lachlan Fraser', user_name: 'hr-user' }, sheetClient, auditLogger);

    expect(response.response_type).toBe('ephemeral');
    expect(response.text).toContain('Onboarding ID: ONB-42');
    expect(response.text).toContain('Status: IN_PROGRESS');
    expect(response.text).toContain('Phase completion: Documentation 0/1 | Pre-onboarding 1/1');
    expect(response.text).toContain('Collect signed contract');
    expect(auditLogger.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'READ' }));
  });
});
