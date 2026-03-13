/* global SubmissionController, ApprovalController */
/**
 * @fileoverview Legacy approval helpers now constrained to governed proposal commit flow only.
 */

function postApprovalRequest(proposalId, approver, context) {
  if (!proposalId) {
    throw new Error('proposalId is required for governed approval request.');
  }
  var proposal = getSubmissionControllerForApprovals_().getProposal(proposalId);
  if (!proposal) {
    throw new Error('Proposal not found: ' + proposalId);
  }
  var payload = context || {};
  payload.proposal = proposal;
  if (approver) {
    payload.approver = approver;
  }
  if (proposal.requires_approval && getApprovalControllerForApprovals_().requestLiamApproval) {
    return getApprovalControllerForApprovals_().requestLiamApproval(payload);
  }
  return getApprovalControllerForApprovals_().requestApproval(payload);
}

function handleApprovalResponse(proposalId, decision, options) {
  var opts = options || {};
  if (!proposalId) {
    throw new Error('proposalId is required for approval response handling.');
  }
  var normalized = String(decision || '').trim().toUpperCase();
  if (normalized !== 'APPROVE' && normalized !== 'APPROVED' && normalized !== 'REJECT' && normalized !== 'REJECTED') {
    throw new Error('Unsupported decision. Use APPROVE or REJECT.');
  }

  var approved;
  if (normalized === 'APPROVE' || normalized === 'APPROVED') {
    approved = getApprovalControllerForApprovals_().approveProposal({
      proposal_id: proposalId,
      actor: opts.actor,
      allowed_actors: opts.allowed_actors
    });

    if (!opts.repository || typeof opts.repository.commitProposal !== 'function') {
      throw new Error('Governed commit repository is required. Direct sheet writes are not allowed.');
    }

    return getSubmissionControllerForApprovals_().commitApprovedProposal(proposalId, {
      repository: opts.repository,
      auditService: opts.auditService,
      actor: opts.actor,
      gateContext: opts.gateContext || {}
    });
  }

  return getApprovalControllerForApprovals_().rejectProposal({
    proposal_id: proposalId,
    actor: opts.actor,
    allowed_actors: opts.allowed_actors,
    reason: opts.reason
  });
}

function getSubmissionControllerForApprovals_() {
  if (typeof SubmissionController !== 'undefined' && SubmissionController) {
    return SubmissionController;
  }
  if (typeof require === 'function') {
    return require('./SubmissionController.gs');
  }
  throw new Error('SubmissionController is required.');
}

function getApprovalControllerForApprovals_() {
  if (typeof ApprovalController !== 'undefined' && ApprovalController) {
    return ApprovalController;
  }
  if (typeof require === 'function') {
    return require('./ApprovalController.gs');
  }
  throw new Error('ApprovalController is required.');
}

if (typeof module !== 'undefined') {
  module.exports = {
    postApprovalRequest: postApprovalRequest,
    handleApprovalResponse: handleApprovalResponse
  };
}
