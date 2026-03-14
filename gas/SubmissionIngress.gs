/* global generateId */
/**
 * @fileoverview Ingress parsing/routing for submission proposal lifecycle.
 */

var ProposalStore_ = { proposals: {} };

function submissionBuildId_(prefix) {
  if (typeof generateId === 'function') return generateId(prefix);
  return String(prefix || 'ID') + '-' + new Date().getTime();
}

function submissionCreateProposal_(input, policy, persistence) {
  var proposalInput = input || {};
  var action = policy.submissionNormalizeActionKey_(proposalInput.action || proposalInput.intent || '');
  var entityType = String(proposalInput.entity_type || policy.submissionInferEntityType_(proposalInput)).toLowerCase();
  var proposal = {
    id: String(proposalInput.id || submissionBuildId_('PROP')),
    source: String(proposalInput.source || 'unknown'),
    action: action,
    actor: String(proposalInput.actor || 'unknown'),
    request_id: String(proposalInput.request_id || ''),
    payload: proposalInput.payload || {},
    approval_status: String(proposalInput.approval_status || 'PENDING').toUpperCase(),
    approved_by: String(proposalInput.approved_by || ''),
    approved_at: proposalInput.approved_at || '',
    trace_id: String(proposalInput.trace_id || submissionBuildId_('TRACE')),
    entity_type: entityType || 'proposal',
    entity_key: String(proposalInput.entity_key || policy.submissionInferEntityKey_(proposalInput)),
    requires_approval: policy.submissionRequiresApprovalForAction_(entityType, action),
    proposal_version: Number(proposalInput.proposal_version || 1),
    proposal_hash: String(proposalInput.proposal_hash || ''),
    committed_at: ''
  };
  if (!proposal.proposal_hash) proposal.proposal_hash = policy.submissionComputeProposalHash_(proposal);
  ProposalStore_.proposals[proposal.id] = proposal;
  persistence.submissionPersistProposal_(proposal, proposalInput.repository);
  return proposal;
}

function submissionGetProposal_(proposalId, persistence) {
  var normalizedId = String(proposalId || '');
  var persisted = persistence.submissionLoadPersistedProposal_(normalizedId);
  if (persisted) {
    ProposalStore_.proposals[normalizedId] = persisted;
    return persisted;
  }
  return ProposalStore_.proposals[normalizedId] || null;
}

function submissionUpdateProposalState_(proposalId, patch, persistence) {
  var proposal = submissionGetProposal_(proposalId, persistence);
  if (!proposal) throw new Error('Proposal not found: ' + proposalId);
  var updates = patch || {};
  var keys = Object.keys(updates);
  for (var i = 0; i < keys.length; i += 1) proposal[keys[i]] = updates[keys[i]];
  ProposalStore_.proposals[proposal.id] = proposal;
  persistence.submissionPersistProposal_(proposal);
  return proposal;
}

if (typeof module !== 'undefined') {
  module.exports = {
    ProposalStore_: ProposalStore_,
    submissionCreateProposal_: submissionCreateProposal_,
    submissionGetProposal_: submissionGetProposal_,
    submissionUpdateProposalState_: submissionUpdateProposalState_
  };
}
