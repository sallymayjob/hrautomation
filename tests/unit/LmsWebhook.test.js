function mockGasGlobals() {
  global.ContentService = {
    MimeType: { JSON: 'application/json' },
    createTextOutput: jest.fn((value) => ({
      value,
      setMimeType: jest.fn(function () {
        return this;
      })
    }))
  };
}

describe('LmsWebhook', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGasGlobals();
    global.AuditLogger = jest.fn(() => ({ log: jest.fn() }));
    global.Config = { getSlackVerificationToken: jest.fn(() => 'verif-token-123') };
    global.SheetClient = jest.fn(() => ({}));
    const idempotencyMap = {};
    global.SubmissionController = {
      createProposal: jest.fn(() => ({ id: 'PROP-1' })),
      persistIngressDraft: jest.fn((input) => {
        const key = String((input && (input.idempotency_key || input.request_id || input.trace_id)) || '');
        if (key && idempotencyMap[key]) return idempotencyMap[key];
        const proposal = {
          id: key === 'REQ-APPROVED-1' ? 'PROP-APPROVED-1' : 'PROP-1',
          approval_status: key === 'REQ-APPROVED-1' ? 'APPROVED' : 'PENDING',
          requires_approval: false,
          idempotency_key: key
        };
        if (key) idempotencyMap[key] = proposal;
        return proposal;
      })
    };
    global.ApprovalController = {
      requestApproval: jest.fn(() => ({ ok: true })),
      requestLiamApproval: jest.fn(() => ({ ok: true }))
    };
    global.GeminiService = {
      validateAndClarify: jest.fn(() => ({ status: 'valid_proposal', summary: 'Looks good' }))
    };
  });

  test('validateLmsHandshake_ rejects non workflow-builder handshakes', () => {
    const { validateLmsHandshake_ } = require('../../gas/LmsWebhook.gs');

    const result = validateLmsHandshake_({ source: 'slash_command', action: 'create_course' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_HANDSHAKE_SOURCE');
  });

  test('doPostLms accepts workflow builder payload and captures pending proposal', () => {
    const { doPostLms } = require('../../gas/LmsWebhook.gs');

    const output = doPostLms({
      postData: {
        contents: JSON.stringify({
          token: 'verif-token-123',
          source: 'slack_workflow_builder',
          action: 'create_course',
          actor_slack_id: 'U123'
        })
      }
    });

    expect(global.ContentService.createTextOutput).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(output.value);
    expect(payload.ok).toBe(true);
    expect(payload.action).toBe('create_course');
    expect(payload.data.proposal_id).toBe('PROP-1');
    expect(payload.data.approval_status).toBe('PENDING');
    expect(payload.data.commit_blocked).toBe(true);
  });

  test('routeLmsAction_ validates with Gemini before approval request', () => {
    const { routeLmsAction_ } = require('../../gas/LmsWebhook.gs');

    const result = routeLmsAction_({
      token: 'verif-token-123',
      source: 'slack_workflow_builder',
      action: 'enroll_single',
      actor_slack_id: 'UHR1'
    });

    expect(global.SubmissionController.persistIngressDraft).toHaveBeenCalledTimes(1);
    expect(global.GeminiService.validateAndClarify).toHaveBeenCalledWith(expect.objectContaining({ id: 'PROP-1' }));
    expect(global.ApprovalController.requestApproval).toHaveBeenCalledWith(expect.objectContaining({
      proposal: expect.objectContaining({ id: 'PROP-1', approval_status: 'PENDING' }),
      clarification: expect.objectContaining({ status: 'valid_proposal' }),
      approval_status: 'PENDING'
    }));
    expect(result.ok).toBe(true);
    expect(result.data.approval_status).toBe('PENDING');
    expect(result.data.commit_blocked).toBe(true);
  });

  test('routeLmsAction_ sends governed requests to Liam approval', () => {
    const { routeLmsAction_ } = require('../../gas/LmsWebhook.gs');
    global.SubmissionController.persistIngressDraft.mockReturnValue({
      id: 'PROP-2',
      approval_status: 'PENDING',
      requires_approval: true
    });

    const result = routeLmsAction_({
      token: 'verif-token-123',
      source: 'slack_workflow_builder',
      action: 'lesson_create',
      actor_slack_id: 'UHR1',
      lesson_id: 'L1'
    });

    expect(global.ApprovalController.requestLiamApproval).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });


  test('replayed webhook returns same proposal identifier and status', () => {
    const { routeLmsAction_ } = require('../../gas/LmsWebhook.gs');

    const payload = {
      token: 'verif-token-123',
      source: 'slack_workflow_builder',
      action: 'create_course',
      actor_slack_id: 'UHR1',
      request_id: 'REQ-APPROVED-1',
      idempotency_key: 'REQ-APPROVED-1'
    };

    const first = routeLmsAction_(payload);
    const replay = routeLmsAction_(payload);

    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    expect(first.data.proposal_id).toBe('PROP-APPROVED-1');
    expect(replay.data.proposal_id).toBe('PROP-APPROVED-1');
    expect(first.data.approval_status).toBe('APPROVED');
    expect(replay.data.approval_status).toBe('APPROVED');
  });

  test('doPostLms rejects missing verification token', () => {
    const { doPostLms } = require('../../gas/LmsWebhook.gs');
    const output = doPostLms({ postData: { contents: JSON.stringify({ source: 'slack_workflow_builder', action: 'create_course' }) } });
    const payload = JSON.parse(output.value);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('MISSING_TOKEN');
  });
});
