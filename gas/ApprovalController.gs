/* global SubmissionController */
/**
 * @fileoverview Approval decision handlers for proposal state transitions.
 */

function requestApproval(context) {
  var payload = context || {};
  var proposal = payload.proposal || null;
  if (!proposal || !proposal.id) {
    return { ok: false, message: 'Missing proposal for approval request.' };
  }

  return {
    ok: true,
    proposal_id: proposal.id,
    approval_status: String(proposal.approval_status || 'PENDING').toUpperCase()
  };
}


function requestLiamApproval(context) {
  var payload = context || {};
  var proposal = payload.proposal || null;
  if (!proposal || !proposal.id) {
    return { ok: false, message: 'Missing proposal for Liam approval request.' };
  }
  if (!proposal.requires_approval) {
    return {
      ok: true,
      skipped: true,
      proposal_id: proposal.id,
      approval_status: String(proposal.approval_status || 'NOT_REQUIRED').toUpperCase()
    };
  }

  var targetApprover = String(payload.approver || 'liam').toLowerCase();
  return {
    ok: true,
    proposal_id: proposal.id,
    approver: targetApprover,
    approval_status: String(proposal.approval_status || 'PENDING').toUpperCase(),
    governed: true
  };
}

function approveProposal(input) {
  var decision = input || {};
  var proposal = getSubmissionController_().getProposal(decision.proposal_id);
  assertActorAuthorized_(proposal, decision.actor, decision.allowed_actors);

  return getSubmissionController_().updateProposalState(proposal.id, {
    approval_status: 'APPROVED',
    approved_by: String(decision.actor || ''),
    approved_at: new Date().toISOString(),
    approval_hash: String(proposal.proposal_hash || ''),
    approval_version: Number(proposal.proposal_version || 1),
    rejection_reason: ''
  });
}

function rejectProposal(input) {
  var decision = input || {};
  var proposal = getSubmissionController_().getProposal(decision.proposal_id);
  assertActorAuthorized_(proposal, decision.actor, decision.allowed_actors);

  return getSubmissionController_().updateProposalState(proposal.id, {
    approval_status: 'REJECTED',
    approved_by: String(decision.actor || ''),
    approved_at: new Date().toISOString(),
    rejection_reason: String(decision.reason || 'Rejected by approver')
  });
}

function assertActorAuthorized_(proposal, actor, allowedActors) {
  if (!proposal) {
    throw new Error('Proposal not found for approval decision.');
  }
  var normalizedActor = String(actor || '').trim().toLowerCase();
  if (!normalizedActor) {
    throw new Error('Actor is required.');
  }

  var allowList = Array.isArray(allowedActors) ? allowedActors : [];
  var normalizedAllowList = [];
  for (var i = 0; i < allowList.length; i += 1) {
    normalizedAllowList.push(String(allowList[i] || '').trim().toLowerCase());
  }

  if (normalizedAllowList.length > 0 && normalizedAllowList.indexOf(normalizedActor) === -1) {
    throw new Error('Actor is not authorized to approve/reject this proposal.');
  }
}

function getSubmissionController_() {
  if (typeof SubmissionController !== 'undefined' && SubmissionController) {
    return SubmissionController;
  }
  if (typeof require === 'function') {
    return require('./SubmissionController.gs');
  }
  throw new Error('SubmissionController is required.');
}

if (typeof module !== 'undefined') {
  module.exports = {
    requestApproval: requestApproval,
    requestLiamApproval: requestLiamApproval,
    approveProposal: approveProposal,
    rejectProposal: rejectProposal,
    assertActorAuthorized_: assertActorAuthorized_
  };
}
