/* global VersioningService, MappingService, DuplicateDetector */
/**
 * @fileoverview Integration adapter for governed LMS submission lifecycle.
 */

var SubmissionControllerBindings_ = null;
if (typeof module !== 'undefined') {
  SubmissionControllerBindings_ = {
    VersioningService: require('./VersioningService.gs'),
    MappingService: require('./MappingService.gs'),
    DuplicateDetector: require('./DuplicateDetector.gs'),
    policy: require('./SubmissionPolicy.gs'),
    ingress: require('./SubmissionIngress.gs'),
    persistence: require('./SubmissionPersistenceAdapter.gs')
  };
}

function getSubmissionPolicy_() {
  return typeof submissionNormalizeActionKey_ === 'function'
    ? this
    : SubmissionControllerBindings_.policy;
}

function getSubmissionIngress_() {
  return typeof submissionCreateProposal_ === 'function'
    ? this
    : SubmissionControllerBindings_.ingress;
}

function getSubmissionPersistence_() {
  return typeof submissionGetDefaultRepository_ === 'function'
    ? this
    : SubmissionControllerBindings_.persistence;
}

function createProposal(input) {
  return getSubmissionIngress_().submissionCreateProposal_(input, getSubmissionPolicy_(), getSubmissionPersistence_());
}

function createDraft(input) { return createProposal(input); }

function persistIngressDraft(input, options) {
  var proposal = createDraft(input);
  var opts = options || {};
  var repository = opts.repository || getSubmissionPersistence_().submissionGetDefaultRepository_();
  if (repository && typeof repository.writeDraftProposal === 'function') repository.writeDraftProposal(proposal, opts);
  else if (repository && typeof repository.writeProposalDraft === 'function') repository.writeProposalDraft(proposal, opts);
  else if (repository && typeof repository.writeProposal === 'function') repository.writeProposal(proposal, opts);
  getSubmissionPersistence_().submissionPersistProposal_(proposal, repository);
  return proposal;
}

function getProposal(proposalId) {
  return getSubmissionIngress_().submissionGetProposal_(proposalId, getSubmissionPersistence_());
}

function updateProposalState(proposalId, patch) {
  return getSubmissionIngress_().submissionUpdateProposalState_(proposalId, patch, getSubmissionPersistence_());
}

function revalidateProposalForCommit(proposal) {
  return getSubmissionPolicy_().submissionRevalidateProposalForCommit_(proposal);
}

function getVersioningService_(opts) {
  if (opts.versioningService) return opts.versioningService;
  if (typeof VersioningService !== 'undefined' && VersioningService) return VersioningService;
  return SubmissionControllerBindings_ ? SubmissionControllerBindings_.VersioningService : null;
}
function getMappingService_(opts) {
  if (opts.mappingService) return opts.mappingService;
  if (typeof MappingService !== 'undefined' && MappingService) return MappingService;
  return SubmissionControllerBindings_ ? SubmissionControllerBindings_.MappingService : null;
}
function getDuplicateDetector_(opts) {
  if (opts.duplicateDetector) return opts.duplicateDetector;
  if (typeof DuplicateDetector !== 'undefined' && DuplicateDetector) return DuplicateDetector;
  return SubmissionControllerBindings_ ? SubmissionControllerBindings_.DuplicateDetector : null;
}

function runCommitGates_(proposal, opts) {
  var gateContext = opts.gateContext || {};
  var versioning = getVersioningService_(opts);
  var mapping = getMappingService_(opts);
  var duplicateDetector = getDuplicateDetector_(opts);
  if (!versioning || !mapping || !duplicateDetector) throw new Error('Commit gates are not fully configured.');

  var existingRows = gateContext.existingRows || [];
  var keyField = gateContext.keyField || 'entity_key';
  var versionField = gateContext.versionField || 'version';
  var entityKey = proposal.entity_key;
  var nextVersion = versioning.calculateNextVersion_(existingRows, keyField, entityKey, versionField);
  versioning.assertImmutableHistoricalRows_(existingRows, keyField, entityKey, nextVersion, versionField);
  mapping.validateMappingConstraints_(proposal.payload || {}, gateContext.mapping || {});
  var duplicateCheck = duplicateDetector.detectDuplicate_(proposal, gateContext.existingRecords || [], gateContext.duplicate || {});
  if (duplicateCheck.duplicate) throw new Error('Duplicate gate failed: ' + duplicateCheck.reason);
  proposal.proposal_version = Number(nextVersion || proposal.proposal_version || 1);
}

function commitApprovedProposal(proposalId, options) {
  var opts = options || {};
  var proposal = getProposal(proposalId);
  revalidateProposalForCommit(proposal);
  runCommitGates_(proposal, opts);

  var repository = opts.repository;
  if (!repository || typeof repository.commitProposal !== 'function') throw new Error('Repository with commitProposal is required for final commit.');
  repository.commitProposal(proposal, opts);
  if (opts.auditService && typeof opts.auditService.logEvent === 'function') {
    opts.auditService.logEvent({ actorEmail: String(opts.actor || proposal.approved_by || proposal.actor || 'system'), entityType: String(proposal.entity_type || 'proposal'), entityId: String(proposal.entity_key || proposal.id), action: 'COMMIT', details: 'Proposal committed via repository; trace_id=' + String(proposal.trace_id || '') });
  }
  proposal.committed_at = new Date().toISOString();
  proposal.approval_status = String(proposal.approval_status || '').toUpperCase() || 'APPROVED';
  getSubmissionIngress_().ProposalStore_.proposals[proposal.id] = proposal;
  getSubmissionPersistence_().submissionPersistProposal_(proposal, repository);
  return proposal;
}

function computeProposalHash_(proposal) {
  return getSubmissionPolicy_().submissionComputeProposalHash_(proposal);
}
function requiresApprovalForAction_(entityType, action) {
  return getSubmissionPolicy_().submissionRequiresApprovalForAction_(entityType, action);
}
function setSubmissionRepositoryForTests_(repository) {
  return getSubmissionPersistence_().submissionSetRepositoryForTests_(repository);
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
    runCommitGates_: runCommitGates_,
    computeProposalHash_: computeProposalHash_,
    requiresApprovalForAction_: requiresApprovalForAction_,
    ProposalStore_: getSubmissionIngress_().ProposalStore_,
    setSubmissionRepositoryForTests_: setSubmissionRepositoryForTests_
  };
}
