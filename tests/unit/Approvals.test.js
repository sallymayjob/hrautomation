describe('Approvals governed flow enforcement', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('handleApprovalResponse requires governed commit repository for approve', () => {
    global.SubmissionController = {
      getProposal: jest.fn(() => ({ id: 'PROP-1', requires_approval: true })),
      commitApprovedProposal: jest.fn()
    };
    global.ApprovalController = {
      approveProposal: jest.fn(() => ({ id: 'PROP-1', approval_status: 'APPROVED' })),
      rejectProposal: jest.fn(),
      requestApproval: jest.fn(),
      requestLiamApproval: jest.fn()
    };

    const approvals = require('../../gas/Approvals.gs');
    expect(() => approvals.handleApprovalResponse('PROP-1', 'APPROVE', { actor: 'manager@example.com' }))
      .toThrow('Governed commit repository is required');
  });

  test('handleApprovalResponse reject path does not commit', () => {
    global.SubmissionController = {
      getProposal: jest.fn(() => ({ id: 'PROP-2', requires_approval: true })),
      commitApprovedProposal: jest.fn()
    };
    global.ApprovalController = {
      approveProposal: jest.fn(),
      rejectProposal: jest.fn(() => ({ id: 'PROP-2', approval_status: 'REJECTED' })),
      requestApproval: jest.fn(),
      requestLiamApproval: jest.fn()
    };

    const approvals = require('../../gas/Approvals.gs');
    const result = approvals.handleApprovalResponse('PROP-2', 'REJECT', {
      actor: 'manager@example.com',
      allowed_actors: ['manager@example.com'],
      reason: 'No'
    });

    expect(result.approval_status).toBe('REJECTED');
    expect(global.SubmissionController.commitApprovedProposal).not.toHaveBeenCalled();
  });
});
