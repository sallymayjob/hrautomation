/* global generateId, Config, computeHash */
/**
 * @fileoverview Proposal lifecycle controller for governed LMS lesson mutations.
 */

var ProposalStore_ = {
  proposals: {}
};


function getGovernanceConfig_() {
  if (typeof Config !== 'undefined' && Config) {
    return Config;
  }
  return {
    ENTITY_NAMES: { LESSON: 'lesson', PROPOSAL: 'proposal' },
    APPROVAL_REQUIRED_ACTIONS: {
      lesson_create: true,
      lesson_edit: true,
      lesson_overwrite: true,
      lesson_version: true,
      lesson_mapping_change: true,
      create_lesson: true,
      edit_lesson: true,
      overwrite_lesson: true,
      version_lesson: true,
      update_lesson_mapping: true
    },
    isGovernanceEnabled: function () { return true; },
    isGovernanceApprovalRequired: function () { return true; }
  };
}

function createProposal(input) {
  var proposalInput = input || {};
  var normalizedAction = normalizeActionKey_(proposalInput.action || proposalInput.intent || '');
  var entityType = String(proposalInput.entity_type || inferEntityType_(proposalInput)).toLowerCase();
  var proposal = {
    id: String(proposalInput.id || buildId_('PROP')),
    source: String(proposalInput.source || 'unknown'),
    action: normalizedAction,
    actor: String(proposalInput.actor || 'unknown'),
    request_id: String(proposalInput.request_id || ''),
    payload: proposalInput.payload || {},
    approval_status: String(proposalInput.approval_status || 'PENDING').toUpperCase(),
    approved_by: String(proposalInput.approved_by || ''),
    approved_at: proposalInput.approved_at || '',
    trace_id: String(proposalInput.trace_id || buildId_('TRACE')),
    entity_type: entityType || getGovernanceConfig_().ENTITY_NAMES.PROPOSAL,
    entity_key: String(proposalInput.entity_key || inferEntityKey_(proposalInput)),
    requires_approval: requiresApprovalForAction_(entityType, normalizedAction),
    proposal_version: Number(proposalInput.proposal_version || 1),
    proposal_hash: String(proposalInput.proposal_hash || ''),
    committed_at: ''
  };

  if (!proposal.proposal_hash) {
    proposal.proposal_hash = computeProposalHash_(proposal);
  }

  ProposalStore_.proposals[proposal.id] = proposal;
  return proposal;
}

function createDraft(input) {
  return createProposal(input);
}

function persistIngressDraft(input, options) {
  var proposal = createDraft(input);
  var opts = options || {};
  var repository = opts.repository;
  if (repository && typeof repository.writeDraftProposal === 'function') {
    repository.writeDraftProposal(proposal, opts);
  } else if (repository && typeof repository.writeProposalDraft === 'function') {
    repository.writeProposalDraft(proposal, opts);
  } else if (repository && typeof repository.writeProposal === 'function') {
    repository.writeProposal(proposal, opts);
  }
  return proposal;
}

function getProposal(proposalId) {
  return ProposalStore_.proposals[String(proposalId || '')] || null;
}

function updateProposalState(proposalId, patch) {
  var proposal = getProposal(proposalId);
  if (!proposal) {
    throw new Error('Proposal not found: ' + proposalId);
  }

  var updates = patch || {};
  var keys = Object.keys(updates);
  for (var i = 0; i < keys.length; i += 1) {
    proposal[keys[i]] = updates[keys[i]];
  }
  ProposalStore_.proposals[proposal.id] = proposal;
  return proposal;
}

function revalidateProposalForCommit(proposal) {
  if (!proposal) {
    throw new Error('Proposal is required for commit.');
  }
  if (!proposal.trace_id || !proposal.entity_type || !proposal.entity_key) {
    throw new Error('Proposal missing approval entity fields.');
  }
  if (proposal.requires_approval && String(proposal.approval_status || '').toUpperCase() !== 'APPROVED') {
    throw new Error('Governed action cannot commit without APPROVED state.');
  }

  var currentHash = computeProposalHash_(proposal);
  if (proposal.approval_hash && String(proposal.approval_hash) !== currentHash) {
    throw new Error('Governed action cannot commit because proposal hash changed after approval.');
  }
  if (proposal.approval_version !== undefined && Number(proposal.approval_version) !== Number(proposal.proposal_version || 1)) {
    throw new Error('Governed action cannot commit because proposal version changed after approval.');
  }

  return true;
}

function commitApprovedProposal(proposalId, options) {
  var opts = options || {};
  var proposal = getProposal(proposalId);
  revalidateProposalForCommit(proposal);

  var repository = opts.repository;
  if (!repository || typeof repository.commitProposal !== 'function') {
    throw new Error('Repository with commitProposal is required for final commit.');
  }

  repository.commitProposal(proposal, opts);
  if (opts.auditService && typeof opts.auditService.logEvent === 'function') {
    opts.auditService.logEvent({
      actorEmail: String(opts.actor || proposal.approved_by || proposal.actor || 'system'),
      entityType: String(proposal.entity_type || 'proposal'),
      entityId: String(proposal.entity_key || proposal.id),
      action: 'COMMIT',
      details: 'Proposal committed via repository; trace_id=' + String(proposal.trace_id || '') + '; proposal_id=' + String(proposal.id || '') + '; version=' + String(proposal.proposal_version || 1) + '; hash=' + String(proposal.proposal_hash || '')
    });
  }
  proposal.committed_at = new Date().toISOString();
  proposal.approval_status = String(proposal.approval_status || '').toUpperCase() || 'APPROVED';
  ProposalStore_.proposals[proposal.id] = proposal;
  return proposal;
}

function computeProposalHash_(proposal) {
  if (typeof computeHash !== 'function') {
    return String(proposal.id || '');
  }
  return computeHash([
    proposal.action,
    proposal.entity_type,
    proposal.entity_key,
    JSON.stringify(proposal.payload || {}),
    proposal.request_id,
    proposal.trace_id
  ]);
}

function requiresApprovalForAction_(entityType, action) {
  if (String(entityType || '').toLowerCase() !== 'lesson') {
    return false;
  }
  var governanceConfig = getGovernanceConfig_();
  if (!governanceConfig.isGovernanceEnabled() || !governanceConfig.isGovernanceApprovalRequired()) {
    return false;
  }
  return Boolean(governanceConfig.APPROVAL_REQUIRED_ACTIONS[String(action || '').toLowerCase()]);
}

function inferEntityType_(input) {
  var payload = input && input.payload ? input.payload : {};
  var explicit = String(input && input.entity_type || payload.entity_type || '').trim();
  if (explicit) {
    return explicit;
  }
  var action = normalizeActionKey_(input && (input.action || input.intent) || payload.action || '');
  var governanceConfig = getGovernanceConfig_();
  return action.indexOf('lesson') > -1 ? governanceConfig.ENTITY_NAMES.LESSON : governanceConfig.ENTITY_NAMES.PROPOSAL;
}

function inferEntityKey_(input) {
  var payload = input && input.payload ? input.payload : {};
  if (input && input.entity_key) {
    return String(input.entity_key);
  }
  var parts = [
    payload.lesson_id || payload.lesson_key || payload.module_code || '',
    payload.version || payload.lesson_version || '',
    payload.mapping_id || ''
  ];
  var key = parts.join(':').replace(/:+$/g, '').replace(/^:+/g, '');
  return key || String(input && input.request_id || buildId_('ENTITY'));
}

function normalizeActionKey_(action) {
  return String(action || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function buildId_(prefix) {
  if (typeof generateId === 'function') {
    return generateId(prefix);
  }
  return String(prefix || 'ID') + '-' + new Date().getTime();
}

if (typeof module !== 'undefined') {
  module.exports = {
    createProposal: createProposal,
    createDraft: createDraft,
    persistIngressDraft: persistIngressDraft,
    getProposal: getProposal,
    updateProposalState: updateProposalState,
    revalidateProposalForCommit: revalidateProposalForCommit,
    commitApprovedProposal: commitApprovedProposal,
    computeProposalHash_: computeProposalHash_,
    requiresApprovalForAction_: requiresApprovalForAction_,
    ProposalStore_: ProposalStore_
  };
}
