/* global Config, computeHash */
/**
 * @fileoverview Business policy helpers for governed submission proposals.
 */

function submissionGetGovernanceConfig_() {
  if (typeof Config !== 'undefined' && Config) return Config;
  return {
    ENTITY_NAMES: { LESSON: 'lesson', PROPOSAL: 'proposal' },
    APPROVAL_REQUIRED_ACTIONS: {
      lesson_create: true, lesson_edit: true, lesson_overwrite: true, lesson_version: true,
      lesson_mapping_change: true, create_lesson: true, edit_lesson: true,
      overwrite_lesson: true, version_lesson: true, update_lesson_mapping: true
    },
    isGovernanceEnabled: function () { return true; },
    isGovernanceApprovalRequired: function () { return true; }
  };
}

function submissionNormalizeActionKey_(action) {
  return String(action || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function submissionInferEntityType_(input) {
  var payload = input && input.payload ? input.payload : {};
  var explicit = String(input && input.entity_type || payload.entity_type || '').trim();
  if (explicit) return explicit;
  var action = submissionNormalizeActionKey_(input && (input.action || input.intent) || payload.action || '');
  var cfg = submissionGetGovernanceConfig_();
  return action.indexOf('lesson') > -1 ? cfg.ENTITY_NAMES.LESSON : cfg.ENTITY_NAMES.PROPOSAL;
}

function submissionInferEntityKey_(input) {
  var payload = input && input.payload ? input.payload : {};
  if (input && input.entity_key) return String(input.entity_key);
  var parts = [payload.lesson_id || payload.lesson_key || payload.module_code || '', payload.version || payload.lesson_version || '', payload.mapping_id || ''];
  var key = parts.join(':').replace(/:+$/g, '').replace(/^:+/g, '');
  return key || String(input && input.request_id || 'ENTITY');
}

function submissionRequiresApprovalForAction_(entityType, action) {
  if (String(entityType || '').toLowerCase() !== 'lesson') return false;
  var cfg = submissionGetGovernanceConfig_();
  if (!cfg.isGovernanceEnabled() || !cfg.isGovernanceApprovalRequired()) return false;
  return Boolean(cfg.APPROVAL_REQUIRED_ACTIONS[String(action || '').toLowerCase()]);
}

function submissionComputeProposalHash_(proposal) {
  if (typeof computeHash !== 'function') return String(proposal.id || '');
  return computeHash([proposal.action, proposal.entity_type, proposal.entity_key, JSON.stringify(proposal.payload || {}), proposal.request_id, proposal.trace_id]);
}

function submissionRevalidateProposalForCommit_(proposal) {
  if (!proposal) throw new Error('Proposal is required for commit.');
  if (!proposal.trace_id || !proposal.entity_type || !proposal.entity_key) throw new Error('Proposal missing approval entity fields.');
  if (proposal.requires_approval && String(proposal.approval_status || '').toUpperCase() !== 'APPROVED') throw new Error('Governed action cannot commit without APPROVED state.');
  var currentHash = submissionComputeProposalHash_(proposal);
  if (proposal.approval_hash && String(proposal.approval_hash) !== currentHash) throw new Error('Governed action cannot commit because proposal hash changed after approval.');
  if (proposal.approval_version !== undefined && Number(proposal.approval_version) !== Number(proposal.proposal_version || 1)) throw new Error('Governed action cannot commit because proposal version changed after approval.');
  return true;
}

if (typeof module !== 'undefined') {
  module.exports = {
    submissionNormalizeActionKey_: submissionNormalizeActionKey_,
    submissionInferEntityType_: submissionInferEntityType_,
    submissionInferEntityKey_: submissionInferEntityKey_,
    submissionRequiresApprovalForAction_: submissionRequiresApprovalForAction_,
    submissionComputeProposalHash_: submissionComputeProposalHash_,
    submissionRevalidateProposalForCommit_: submissionRevalidateProposalForCommit_
  };
}
