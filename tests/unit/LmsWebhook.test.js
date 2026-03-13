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
    global.SheetClient = jest.fn(() => ({}));
    global.SubmissionController = {
      createProposal: jest.fn(() => ({ id: 'PROP-1' })),
      persistIngressDraft: jest.fn(() => ({ id: 'PROP-1', approval_status: 'PENDING', requires_approval: false }))
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
      source: 'slack_workflow_builder',
      action: 'lesson_create',
      actor_slack_id: 'UHR1',
      lesson_id: 'L1'
    });

    expect(global.ApprovalController.requestLiamApproval).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });
});
