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
      getSlackVerificationToken: jest.fn(() => 'verif-token-123'),
      getItTeamChannelId: jest.fn(() => 'CITTEAM'),
      getFinanceTeamChannelId: jest.fn(() => 'CFINTEAM'),
      getHrTeamChannelId: jest.fn(() => 'CHRTEAM'),
      getAdminTeamChannelId: jest.fn(() => 'CADMTEAM'),
      getDefaultAssignmentsChannelId: jest.fn(() => 'CDEFAULT')
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

  test('extractSlackJsonBodyForChallenge_ only returns url_verification payloads', () => {
    const { extractSlackJsonBodyForChallenge_ } = require('../../gas/Commands.gs');

    const challengePayload = extractSlackJsonBodyForChallenge_({
      postData: { contents: JSON.stringify({ type: 'url_verification', challenge: 'abc123' }) }
    });
    const nonChallengePayload = extractSlackJsonBodyForChallenge_({
      postData: { contents: JSON.stringify({ type: 'event_callback' }) }
    });

    expect(challengePayload).toEqual({ type: 'url_verification', challenge: 'abc123' });
    expect(nonChallengePayload).toBeNull();
  });

  test('doPost returns challenge payload for Slack url_verification', () => {
    const { doPost } = require('../../gas/Commands.gs');

    doPost({
      postData: {
        type: 'application/json',
        contents: JSON.stringify({ type: 'url_verification', token: '', challenge: 'abc123' })
      },
      parameter: {}
    });

    expect(global.ContentService.createTextOutput).toHaveBeenCalledTimes(1);
    const payload = global.ContentService.createTextOutput.mock.calls[0][0];
    expect(payload).toBe('abc123');
  });

  test('doPost rejects Slack interactive payloads as read-only', () => {
    const { doPost } = require('../../gas/Commands.gs');

    doPost({
      parameter: {
        payload: JSON.stringify({ type: 'block_actions', token: 'verif-token-123', user: { id: 'U123' } })
      }
    });

    expect(global.ContentService.createTextOutput).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(global.ContentService.createTextOutput.mock.calls[0][0]);
    expect(payload.response_type).toBe('ephemeral');
    expect(payload.text).toContain('read-only');
    expect(payload.text).toContain('Google Sheets');
  });

  test('doPost rejects missing verification token', () => {
    const { doPost } = require('../../gas/Commands.gs');
    doPost({ parameter: { command: '/onboarding-status', text: 'Jamie' } });
    const payload = JSON.parse(global.ContentService.createTextOutput.mock.calls[0][0]);
    expect(payload.text).toContain('MISSING_TOKEN');
  });

  test('doPost rejects wrong verification token', () => {
    const { doPost } = require('../../gas/Commands.gs');
    doPost({ parameter: { token: 'bad-token', command: '/onboarding-status', text: 'Jamie' } });
    const payload = JSON.parse(global.ContentService.createTextOutput.mock.calls[0][0]);
    expect(payload.text).toContain('INVALID_TOKEN');
  });

  test('doPost rejects malformed interactive payload JSON', () => {
    const { doPost } = require('../../gas/Commands.gs');
    doPost({ parameter: { payload: '{bad-json' } });
    const payload = JSON.parse(global.ContentService.createTextOutput.mock.calls[0][0]);
    expect(payload.text).toContain('MALFORMED_PAYLOAD');
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


  test('resolveOnboardingCandidates_ supports Slack user mention lookup', () => {
    const { resolveOnboardingCandidates_ } = require('../../gas/Commands.gs');
    const sheetClient = {
      getOnboardingRows: jest.fn(() => [
        ['ONB-90', 'Casey Admin', 'UCASEY90', 'casey@example.com', 'Manager', '', '2026-03-10', '', 'manager@example.com', '', 'buddy@example.com', '', '', 'IN_PROGRESS']
      ])
    };

    const result = resolveOnboardingCandidates_('<@UCASEY90>', sheetClient);

    expect(result.matchType).toBe('exact');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].employeeName).toBe('Casey Admin');
  });

  test('routeSlackCommand_ handles /checklist-status as alias of onboarding status', () => {
    const { routeSlackCommand_ } = require('../../gas/Commands.gs');
    global.SheetClient = jest.fn(() => ({
      getOnboardingRows: jest.fn(() => [
        ['ONB-42', 'Lachlan Fraser', 'ULACHLAN', 'lachlan@example.com', 'Resourcer', '', '2026-03-04', '', 'emma.brown@rwrgroup.com.au', '', 'buddy@rwrgroup.com.au', '', '', 'IN_PROGRESS']
      ]),
      getChecklistRows: jest.fn(() => [
        ['DOC-1', 'ONB-42', 'Documentation', 'Collect signed contract', 'Manager', '', 'PENDING', new Date('2026-03-06')]
      ])
    }));
    global.AuditLogger = jest.fn(() => ({ log: jest.fn() }));
    global.SlackClient = jest.fn(() => ({ postMessage: jest.fn() }));

    const response = routeSlackCommand_({ command: '/checklist-status', text: 'Lachlan Fraser', user_name: 'admin-user' });

    expect(response.response_type).toBe('ephemeral');
    expect(response.text).toContain('Checklist progress');
  });

  test('routeSlackCommand_ exposes explicit read-only command allowlist', () => {
    const { READ_ONLY_COMMANDS } = require('../../gas/Commands.gs');

    expect(READ_ONLY_COMMANDS).toEqual(expect.arrayContaining([
      '/onboarding-status',
      '/it-onboarding-status',
      '/finance-onboarding-status',
      '/hr-onboarding-status',
      '/checklist-status',
      '/checklist-progress'
    ]));
  });

  test('routeSlackCommand_ converts write-like intents into proposals and skips repository writes', () => {
    const { routeSlackCommand_ } = require('../../gas/Commands.gs');
    const sheetClient = {
      getOnboardingRows: jest.fn(() => []),
      getChecklistRows: jest.fn(() => []),
      appendOnboardingRow: jest.fn(),
      appendChecklistTask: jest.fn(),
      appendTrainingRow: jest.fn(),
      updateOnboardingStatus: jest.fn(),
      updateChecklistTask: jest.fn(),
      updateTrainingStatus: jest.fn(),
      upsertTrainingRow: jest.fn()
    };

    global.SheetClient = jest.fn(() => sheetClient);
    global.AuditLogger = jest.fn(() => ({ log: jest.fn() }));
    global.SlackClient = jest.fn(() => ({ postMessage: jest.fn() }));
    global.SubmissionController = {
      createProposal: jest.fn(() => ({ id: 'PROP-42' }))
    };

    const response = routeSlackCommand_({
      command: '/onboarding-status',
      text: 'update ONB-42 to complete',
      user_name: 'hr-user'
    });

    expect(response.response_type).toBe('ephemeral');
    expect(response.text).toContain('proposal');
    expect(global.SubmissionController.createProposal).toHaveBeenCalledWith(expect.objectContaining({
      actor: 'hr-user',
      command: '/onboarding-status',
      intent: 'update'
    }));
    expect(sheetClient.getOnboardingRows).not.toHaveBeenCalled();
    expect(sheetClient.getChecklistRows).not.toHaveBeenCalled();
    expect(sheetClient.appendOnboardingRow).not.toHaveBeenCalled();
    expect(sheetClient.appendChecklistTask).not.toHaveBeenCalled();
    expect(sheetClient.appendTrainingRow).not.toHaveBeenCalled();
    expect(sheetClient.updateOnboardingStatus).not.toHaveBeenCalled();
    expect(sheetClient.updateChecklistTask).not.toHaveBeenCalled();
    expect(sheetClient.updateTrainingStatus).not.toHaveBeenCalled();
    expect(sheetClient.upsertTrainingRow).not.toHaveBeenCalled();
  });

  test('formatCommandOutput_ centralizes payload serialization without mutating source object', () => {
    const { formatCommandOutput_ } = require('../../gas/Commands.gs');
    const original = {
      responseType: 'in_channel',
      text: 'Hello world'
    };

    const formatted = formatCommandOutput_(original);

    expect(formatted).toEqual({ response_type: 'in_channel', text: 'Hello world' });
    expect(formatted).not.toBe(original);
    expect(original).toEqual({ responseType: 'in_channel', text: 'Hello world' });
  });


  test('routeSlackCommand_ facade matches canonical ingress behavior for supported commands', () => {
    const Commands = require('../../gas/Commands.gs');
    const Ingress = require('../../gas/CommandsIngress.gs');
    const Policy = require('../../gas/CommandsPolicy.gs');
    const Persistence = require('../../gas/CommandsPersistenceAdapter.gs');

    const sheetClient = {
      getOnboardingRows: jest.fn(() => [
        ['ONB-42', 'Lachlan Fraser', 'ULACHLAN', 'lachlan@example.com', 'Resourcer', '', '2026-03-04', '', 'emma.brown@rwrgroup.com.au', '', 'buddy@rwrgroup.com.au', '', '', 'IN_PROGRESS']
      ]),
      getChecklistRows: jest.fn(() => [
        ['DOC-1', 'ONB-42', 'Documentation', 'Collect signed contract', 'People', '', 'PENDING', '2026-03-06']
      ])
    };
    global.SheetClient = jest.fn(() => sheetClient);
    global.SlackClient = jest.fn(() => ({ postMessage: jest.fn() }));

    const commands = [
      '/onboarding-status',
      '/checklist-status',
      '/checklist-progress',
      '/it-onboarding-status',
      '/finance-onboarding-status',
      '/hr-onboarding-status'
    ];

    commands.forEach((command) => {
      const payload = { command, text: 'Lachlan Fraser', user_name: 'hr-user' };
      const facadeResponse = Commands.routeSlackCommand_(payload);
      const canonicalResponse = Ingress.routeSlackCommand_(payload, Policy, Persistence);

      expect(facadeResponse).toEqual(canonicalResponse);
    });
  });

  test('routeSlackCommand_ facade preserves canonical write-intent routing', () => {
    const Commands = require('../../gas/Commands.gs');
    const Ingress = require('../../gas/CommandsIngress.gs');
    const Policy = require('../../gas/CommandsPolicy.gs');
    const Persistence = require('../../gas/CommandsPersistenceAdapter.gs');

    const sheetClient = {
      getOnboardingRows: jest.fn(() => []),
      getChecklistRows: jest.fn(() => [])
    };
    global.SheetClient = jest.fn(() => sheetClient);
    global.SlackClient = jest.fn(() => ({ postMessage: jest.fn() }));
    global.SubmissionController = {
      createProposal: jest.fn(() => ({ id: 'PROP-900' }))
    };

    const payload = {
      command: '/onboarding-status',
      text: 'update ONB-42 to complete',
      user_name: 'hr-user'
    };

    const facadeResponse = Commands.routeSlackCommand_(payload);
    const canonicalResponse = Ingress.routeSlackCommand_(payload, Policy, Persistence);

    expect(facadeResponse).toEqual(canonicalResponse);
    expect(global.SubmissionController.createProposal).toHaveBeenCalledTimes(2);
    expect(global.SubmissionController.createProposal).toHaveBeenNthCalledWith(1, expect.objectContaining({
      command: '/onboarding-status',
      intent: 'update',
      actor: 'hr-user'
    }));
    expect(global.SubmissionController.createProposal).toHaveBeenNthCalledWith(2, expect.objectContaining({
      command: '/onboarding-status',
      intent: 'update',
      actor: 'hr-user'
    }));
    expect(sheetClient.getOnboardingRows).not.toHaveBeenCalled();
    expect(sheetClient.getChecklistRows).not.toHaveBeenCalled();
  });

});
