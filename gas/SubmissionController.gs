/* global generateId */
/**
 * @fileoverview Proposal lifecycle controller for governed LMS lesson mutations.
 */

var ProposalStore_ = {
  proposals: {}
};

var GOVERNED_LESSON_ACTIONS_ = {
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
};

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
    entity_type: entityType || 'proposal',
    entity_key: String(proposalInput.entity_key || inferEntityKey_(proposalInput)),
    requires_approval: requiresApprovalForAction_(entityType, normalizedAction),
    committed_at: ''
  };

  ProposalStore_.proposals[proposal.id] = proposal;
  return proposal;
}

function createDraft(input) {
  return createProposal(input);
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
  return true;
}

function commitApprovedProposal(proposalId, options) {
  var opts = options || {};
  var proposal = getProposal(proposalId);
  revalidateProposalForCommit(proposal);

  var repository = opts.repository;
  if (!repository || typeof repository.writeProposal !== 'function') {
    throw new Error('Repository with writeProposal is required for commit.');
  }

  repository.writeProposal(proposal, opts);
  proposal.committed_at = new Date().toISOString();
  proposal.approval_status = String(proposal.approval_status || '').toUpperCase() || 'APPROVED';
  ProposalStore_.proposals[proposal.id] = proposal;
  return proposal;
}

function requiresApprovalForAction_(entityType, action) {
  if (String(entityType || '').toLowerCase() !== 'lesson') {
    return false;
  }
  return Boolean(GOVERNED_LESSON_ACTIONS_[String(action || '').toLowerCase()]);
}

function inferEntityType_(input) {
  var payload = input && input.payload ? input.payload : {};
  var explicit = String(input && input.entity_type || payload.entity_type || '').trim();
  if (explicit) {
    return explicit;
  }
  var action = normalizeActionKey_(input && (input.action || input.intent) || payload.action || '');
  return action.indexOf('lesson') > -1 ? 'lesson' : 'proposal';
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
    getProposal: getProposal,
    updateProposalState: updateProposalState,
    revalidateProposalForCommit: revalidateProposalForCommit,
    commitApprovedProposal: commitApprovedProposal,
    requiresApprovalForAction_: requiresApprovalForAction_,
    ProposalStore_: ProposalStore_
  };
}
