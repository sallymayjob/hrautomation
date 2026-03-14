describe('SubmissionController commit gates', () => {
  beforeEach(() => {
    jest.resetModules();
    global.Utilities = {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: jest.fn(() => [1, 2, 3]),
      getUuid: jest.fn(() => '12345678-abcd-efgh-ijkl-1234567890ab'),
      formatDate: jest.fn(() => '20260101T000000Z')
    };
  });

  function makeRepository() {
    const persisted = {};
    return {
      persisted,
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

  test('commitApprovedProposal enforces gates before repository commit', () => {
    const utils = require('../../gas/Utils.gs');
    global.computeHash = utils.computeHash;
    const controller = require('../../gas/SubmissionController.gs');

    const repository = makeRepository();
    const proposal = controller.createProposal({
      id: 'PROP-1',
      entity_type: 'lesson',
      entity_key: 'lesson:1',
      action: 'lesson_edit',
      approval_status: 'APPROVED',
      payload: { course_id: 'c1', module_code: 'm1', lesson_id: 'l1' },
      repository
    });

    controller.commitApprovedProposal(proposal.id, {
      repository,
      gateContext: {
        existingRows: [{ entity_key: 'lesson:1', version: 1 }],
        existingRecords: [{ entity_type: 'lesson', entity_key: 'lesson:other', action: 'lesson_edit', payload: {}, active: true }],
        mapping: {
          courses: [{ course_id: 'c1' }],
          modules: [{ module_code: 'm1', module_order: 1 }],
          lessons: [{ lesson_id: 'l1', module_code: 'm1', lesson_order: 1 }]
        }
      }
    });

    expect(repository.commitProposal).toHaveBeenCalledTimes(1);
    expect(controller.getProposal(proposal.id, { repository }).proposal_version).toBe(2);
  });

  test('commitApprovedProposal blocks duplicate gate failures', () => {
    const controller = require('../../gas/SubmissionController.gs');
    const repository = makeRepository();
    const proposal = controller.createProposal({
      id: 'PROP-2',
      entity_type: 'lesson',
      entity_key: 'lesson:1',
      action: 'lesson_edit',
      approval_status: 'APPROVED',
      payload: { course_id: 'c1', module_code: 'm1', lesson_id: 'l1' },
      repository
    });

    expect(() => controller.commitApprovedProposal(proposal.id, {
      repository,
      gateContext: {
        existingRows: [],
        existingRecords: [{ entity_type: 'lesson', entity_key: 'lesson:1', action: 'lesson_edit', payload: { course_id: 'c1', module_code: 'm1', lesson_id: 'l1' }, active: true }],
        mapping: {
          courses: [{ course_id: 'c1' }],
          modules: [{ module_code: 'm1', module_order: 1 }],
          lessons: [{ lesson_id: 'l1', module_code: 'm1', lesson_order: 1 }]
        }
      }
    })).toThrow('Duplicate gate failed');
  });

  test('proposal persistence survives controller reload via repository', () => {
    const persisted = {};
    const mockRepository = {
      createProposal: jest.fn((proposal) => { persisted[proposal.id] = JSON.parse(JSON.stringify(proposal)); return proposal; }),
      getProposalById: jest.fn((id) => persisted[id] || null),
      updateProposal: jest.fn((id, patch) => {
        const proposal = persisted[id];
        if (!proposal) return null;
        persisted[id] = Object.assign({}, proposal, patch);
        return persisted[id];
      }),
      commitProposal: jest.fn((proposal) => proposal)
    };

    let controller = require('../../gas/SubmissionController.gs');
    controller.setSubmissionRepositoryForTests_(mockRepository);
    const created = controller.createProposal({
      id: 'PROP-PERSIST-1',
      entity_type: 'lesson',
      entity_key: 'lesson:persist',
      action: 'lesson_edit',
      approval_status: 'PENDING'
    });
    expect(created.id).toBe('PROP-PERSIST-1');

    jest.resetModules();
    controller = require('../../gas/SubmissionController.gs');
    controller.setSubmissionRepositoryForTests_(mockRepository);

    const loaded = controller.getProposal('PROP-PERSIST-1');
    expect(loaded).toBeTruthy();
    expect(loaded.entity_key).toBe('lesson:persist');
  });
});
