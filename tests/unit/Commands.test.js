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
    global.Config = {
      getItTeamChannelId: jest.fn(() => 'CITTEAM'),
      getFinanceTeamChannelId: jest.fn(() => 'CFINTEAM'),
      getHrTeamChannelId: jest.fn(() => 'CHRTEAM')
    };
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

    const response = handleOnboardingStatusCommand_({ text: 'Amelia', user_name: 'hr-bot' }, 'default', sheetClient, auditLogger);

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

    const response = handleOnboardingStatusCommand_({ text: 'Lachlan Fraser', user_name: 'hr-user' }, 'it', sheetClient, auditLogger);

    expect(response.response_type).toBe('ephemeral');
    expect(response.text).toContain('Team view: IT');
    expect(response.text).toContain('Onboarding ID: ONB-42');
    expect(response.text).toContain('Status: IN_PROGRESS');
    expect(response.text).toContain('Phase completion: Documentation 0/1 | Pre-onboarding 1/1');
    expect(response.text).toContain('Collect signed contract');
    expect(response.text).toContain('[People] Documentation: Collect signed contract');
    expect(auditLogger.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'READ' }));
  });

  test('handleOnboardingStatusCommand_ performs read-only sheet access', () => {
    const { handleOnboardingStatusCommand_ } = require('../../gas/Commands.gs');
    const sheetClient = {
      getOnboardingRows: jest.fn(() => [
        ['ONB-77', 'Jamie Lee', '', 'jamie@example.com', 'Engineer', '', '2026-03-01', '', 'manager@example.com', '', 'buddy@example.com', '', '', 'IN_PROGRESS']
      ]),
      getChecklistRows: jest.fn(() => [
        ['DOC-7', 'ONB-77', 'Documentation', 'Collect signed contract', 'People', '', 'PENDING', '2026-03-07']
      ]),
      appendOnboardingRow: jest.fn(),
      appendChecklistTask: jest.fn(),
      appendTrainingRow: jest.fn(),
      updateOnboardingStatus: jest.fn(),
      updateChecklistTask: jest.fn(),
      updateTrainingStatus: jest.fn(),
      upsertTrainingRow: jest.fn()
    };
    const auditLogger = { log: jest.fn() };

    const response = handleOnboardingStatusCommand_({ text: 'Jamie Lee', user_name: 'hr-user' }, 'default', sheetClient, auditLogger);

    expect(response.response_type).toBe('ephemeral');
    expect(sheetClient.getOnboardingRows).toHaveBeenCalledTimes(1);
    expect(sheetClient.getChecklistRows).toHaveBeenCalledTimes(1);
    expect(sheetClient.appendOnboardingRow).not.toHaveBeenCalled();
    expect(sheetClient.appendChecklistTask).not.toHaveBeenCalled();
    expect(sheetClient.appendTrainingRow).not.toHaveBeenCalled();
    expect(sheetClient.updateOnboardingStatus).not.toHaveBeenCalled();
    expect(sheetClient.updateChecklistTask).not.toHaveBeenCalled();
    expect(sheetClient.updateTrainingStatus).not.toHaveBeenCalled();
    expect(sheetClient.upsertTrainingRow).not.toHaveBeenCalled();
    expect(auditLogger.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'READ' }));
  });

  test('doPost rejects Slack interactive payloads as read-only', () => {
    const { doPost } = require('../../gas/Commands.gs');

    doPost({
      parameter: {
        payload: JSON.stringify({ type: 'block_actions', user: { id: 'U123' } })
      }
    });

    expect(global.ContentService.createTextOutput).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(global.ContentService.createTextOutput.mock.calls[0][0]);
    expect(payload.response_type).toBe('ephemeral');
    expect(payload.text).toContain('read-only');
    expect(payload.text).toContain('Google Sheets');
  });

  test('parseStatusCommandInput_ supports optional share flag', () => {
    const { parseStatusCommandInput_ } = require('../../gas/Commands.gs');

    const parsed = parseStatusCommandInput_('Jamie Lee --share');

    expect(parsed.query).toBe('Jamie Lee');
    expect(parsed.shareToTeamChannel).toBe(true);
  });

  test('handleOnboardingStatusCommand_ can send transparency message to team channel', () => {
    const { handleOnboardingStatusCommand_ } = require('../../gas/Commands.gs');
    const sheetClient = {
      getOnboardingRows: jest.fn(() => [
        ['ONB-22', 'Jamie Lee', '', 'jamie@example.com', 'Engineer', '', '2026-03-01', '', 'manager@example.com', '', 'buddy@example.com', '', '', 'IN_PROGRESS']
      ]),
      getChecklistRows: jest.fn(() => [
        ['IT-7', 'ONB-22', 'Pre-onboarding', 'Provision laptop', 'IT', '', 'PENDING', '2026-03-07']
      ])
    };
    const auditLogger = { log: jest.fn() };
    const slackClient = { postMessage: jest.fn() };

    const response = handleOnboardingStatusCommand_(
      { text: 'Jamie Lee --share', user_name: 'it-user' },
      'it',
      sheetClient,
      auditLogger,
      slackClient
    );

    expect(response.response_type).toBe('ephemeral');
    expect(slackClient.postMessage).toHaveBeenCalledWith(
      'CITTEAM',
      expect.arrayContaining([
        expect.objectContaining({ type: 'section' })
      ])
    );
  });

});
