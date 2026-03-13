/* global Config */
/**
 * @fileoverview Gemini proposal validation and clarification classifier.
 */

function validateAndClarify(proposal) {
  var candidate = proposal || {};
  var payload = candidate.payload || {};
  var action = String(candidate.action || payload.action || '').trim().toLowerCase();

  if (!action) {
    return {
      status: 'rejected',
      reason: 'Missing action.'
    };
  }

  if (requiresClarification_(candidate, payload)) {
    return {
      status: 'needs_clarification',
      reason: 'Proposal is missing required details for governed processing.'
    };
  }

  if (isRejectedProposal_(candidate, payload)) {
    return {
      status: 'rejected',
      reason: 'Proposal violates governance validation checks.'
    };
  }

  return {
    status: 'valid_proposal',
    reason: 'Proposal is valid for approval routing.'
  };
}

function requiresClarification_(proposal, payload) {
  if (!proposal.entity_key || !proposal.trace_id) {
    return true;
  }
  if (String(proposal.entity_type || '').toLowerCase() === 'lesson' && !payload.lesson_id && !payload.module_code) {
    return true;
  }
  return false;
}

function isRejectedProposal_(proposal, payload) {
  var governanceEnabled = true;
  if (typeof Config !== 'undefined' && Config && typeof Config.isGovernanceEnabled === 'function') {
    governanceEnabled = Config.isGovernanceEnabled();
  }
  if (!governanceEnabled) {
    return true;
  }

  if (payload && payload.force_reject === true) {
    return true;
  }

  return false;
}

if (typeof module !== 'undefined') {
  module.exports = {
    validateAndClarify: validateAndClarify,
    requiresClarification_: requiresClarification_,
    isRejectedProposal_: isRejectedProposal_
  };
}
