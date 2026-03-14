describe('integration approval flow', () => {
  let submission;
  let approval;
  let repository;


function makeRepository() {
  const persisted = {};
  return {
    createProposal: jest.fn((proposal) => {
      persisted[proposal.id] = JSON.parse(JSON.stringify(proposal));
      return proposal;
    }),
    getProposalById: jest.fn((id) => persisted[id] ? JSON.parse(JSON.stringify(persisted[id])) : null),
    updateProposal: jest.fn((id, patch) => {
      const existing = persisted[id] ? JSON.parse(JSON.stringify(persisted[id])) : null;
      if (!existing) return null;
      const next = Object.assign(existing, patch);
      persisted[id] = JSON.parse(JSON.stringify(next));
      return next;
    }),
    commitProposal: jest.fn((proposal, options) => {
      const existing = persisted[proposal.id];
      if (!existing) throw new Error('Proposal not found: ' + proposal.id);
      if (options && options.expectedProposalVersion !== undefined && Number(existing.proposal_version || 1) !== Number(options.expectedProposalVersion)) {
        throw new Error('Optimistic commit failed: proposal version mismatch for ' + proposal.id + '.');
      }
      if (options && options.expectedProposalHash && String(existing.proposal_hash || '') !== String(options.expectedProposalHash)) {
        throw new Error('Optimistic commit failed: proposal hash mismatch for ' + proposal.id + '.');
      }
      persisted[proposal.id] = JSON.parse(JSON.stringify(proposal));
      return proposal;
    })
  };
}


  beforeEach(() => {
    jest.resetModules();
    global.generateId = jest.fn((prefix) => prefix + '-1');
    submission = require('../../gas/SubmissionController.gs');
    approval = require('../../gas/ApprovalController.gs');
    repository = makeRepository();
    submission.setSubmissionRepositoryForTests_(repository);
  });

  test('approve path updates proposal state only until commit step', () => {
    const proposal = submission.createProposal({
      action: 'lesson_create',
      entity_type: 'lesson',
      entity_key: 'lesson:SEC101:v1',
      actor: 'author@example.com',
      repository
    });

    const approved = approval.approveProposal({
      proposal_id: proposal.id,
      actor: 'manager@example.com',
      allowed_actors: ['manager@example.com']
    });

    expect(approved.approval_status).toBe('APPROVED');
    expect(approved.approved_by).toBe('manager@example.com');

    const auditService = { logEvent: jest.fn() };
    const committed = submission.commitApprovedProposal(proposal.id, { repository, auditService });
    expect(repository.commitProposal).toHaveBeenCalledTimes(1);
    expect(auditService.logEvent).toHaveBeenCalledTimes(1);
    expect(committed.committed_at).toBeTruthy();
  });

  test('reject path blocks commit and preserves rejected state', () => {
    const proposal = submission.createProposal({
      action: 'lesson_edit',
      entity_type: 'lesson',
      entity_key: 'lesson:SEC101:v2',
      repository
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
      repository
    })).toThrow('Governed action cannot commit without APPROVED state.');
  });

  test('unauthorized actor cannot approve or reject', () => {
    const proposal = submission.createProposal({
      action: 'lesson_mapping_change',
      entity_type: 'lesson',
      entity_key: 'lesson:SEC101:mapping',
      repository
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

  test('blocks commit when approved hash/version drift is detected', () => {
    const proposal = submission.createProposal({
      action: 'lesson_edit',
      entity_type: 'lesson',
      entity_key: 'lesson:SEC101:v3',
      payload: { lesson_id: 'SEC101', title: 'Original' },
      repository
    });

    approval.approveProposal({
      proposal_id: proposal.id,
      actor: 'manager@example.com',
      allowed_actors: ['manager@example.com']
    });

    submission.updateProposalState(proposal.id, {
      payload: { lesson_id: 'SEC101', title: 'Changed after approval' },
      proposal_version: 2
    }, { repository });

    expect(() => submission.commitApprovedProposal(proposal.id, {
      repository
    })).toThrow('Governed action cannot commit because proposal version changed after approval.');
  });

  test('persistIngressDraft and approval updates survive restart with durable state', () => {
    const draft = submission.persistIngressDraft({
      id: 'PROP-RESTART-1',
      action: 'lesson_edit',
      entity_type: 'lesson',
      entity_key: 'lesson:restart',
      payload: { lesson_id: 'SEC201', title: 'Restart Durable' },
      repository
    }, { repository });

    expect(draft.id).toBe('PROP-RESTART-1');

    const approved = approval.approveProposal({
      proposal_id: draft.id,
      actor: 'manager@example.com',
      allowed_actors: ['manager@example.com']
    });
    expect(approved.approval_status).toBe('APPROVED');

    jest.resetModules();
    submission = require('../../gas/SubmissionController.gs');
    approval = require('../../gas/ApprovalController.gs');
    submission.setSubmissionRepositoryForTests_(repository);

    const reloaded = submission.getProposal('PROP-RESTART-1', { repository });
    expect(reloaded).toBeTruthy();
    expect(reloaded.approval_status).toBe('APPROVED');
    expect(reloaded.approved_by).toBe('manager@example.com');
  });

  test('commit validation uses durable state when cache is stale', () => {
    const proposal = submission.createProposal({
      id: 'PROP-COMMIT-RT-1',
      action: 'lesson_edit',
      entity_type: 'lesson',
      entity_key: 'lesson:commit-rt',
      payload: { lesson_id: 'SEC301', title: 'Durable Commit' },
      repository
    });

    approval.approveProposal({
      proposal_id: proposal.id,
      actor: 'manager@example.com',
      allowed_actors: ['manager@example.com']
    });

    submission.ProposalStore_.proposals[proposal.id] = Object.assign({}, submission.ProposalStore_.proposals[proposal.id], {
      approval_status: 'APPROVED',
      approval_version: 1,
      proposal_version: 1
    });

    repository.updateProposal(proposal.id, { proposal_version: 2 });

    expect(() => submission.commitApprovedProposal(proposal.id, {
      repository
    })).toThrow('Governed action cannot commit because proposal version changed after approval.');
  });

});
