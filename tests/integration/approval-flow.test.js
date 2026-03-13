describe('integration approval flow', () => {
  let submission;
  let approval;

  beforeEach(() => {
    jest.resetModules();
    global.generateId = jest.fn((prefix) => prefix + '-1');
    submission = require('../../gas/SubmissionController.gs');
    approval = require('../../gas/ApprovalController.gs');
    submission.ProposalStore_.proposals = {};
  });

  test('approve path updates proposal state only until commit step', () => {
    const proposal = submission.createProposal({
      action: 'lesson_create',
      entity_type: 'lesson',
      entity_key: 'lesson:SEC101:v1',
      actor: 'author@example.com'
    });

    const approved = approval.approveProposal({
      proposal_id: proposal.id,
      actor: 'manager@example.com',
      allowed_actors: ['manager@example.com']
    });

    expect(approved.approval_status).toBe('APPROVED');
    expect(approved.approved_by).toBe('manager@example.com');

    const repository = { writeProposal: jest.fn() };
    const committed = submission.commitApprovedProposal(proposal.id, { repository });
    expect(repository.writeProposal).toHaveBeenCalledTimes(1);
    expect(committed.committed_at).toBeTruthy();
  });

  test('reject path blocks commit and preserves rejected state', () => {
    const proposal = submission.createProposal({
      action: 'lesson_edit',
      entity_type: 'lesson',
      entity_key: 'lesson:SEC101:v2'
    });

    const rejected = approval.rejectProposal({
      proposal_id: proposal.id,
      actor: 'manager@example.com',
      allowed_actors: ['manager@example.com'],
      reason: 'Needs updates'
    });

    expect(rejected.approval_status).toBe('REJECTED');
    expect(rejected.rejection_reason).toBe('Needs updates');

    expect(() => submission.commitApprovedProposal(proposal.id, {
      repository: { writeProposal: jest.fn() }
    })).toThrow('Governed action cannot commit without APPROVED state.');
  });

  test('unauthorized actor cannot approve or reject', () => {
    const proposal = submission.createProposal({
      action: 'lesson_mapping_change',
      entity_type: 'lesson',
      entity_key: 'lesson:SEC101:mapping'
    });

    expect(() => approval.approveProposal({
      proposal_id: proposal.id,
      actor: 'random.user@example.com',
      allowed_actors: ['manager@example.com']
    })).toThrow('Actor is not authorized to approve/reject this proposal.');

    expect(() => approval.rejectProposal({
      proposal_id: proposal.id,
      actor: 'random.user@example.com',
      allowed_actors: ['manager@example.com']
    })).toThrow('Actor is not authorized to approve/reject this proposal.');
  });
});
