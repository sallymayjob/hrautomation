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


function buildSubmissionId_(prefix) {
  if (typeof generateId === 'function') {
    return generateId(prefix);
  }
  return String(prefix || 'ID') + '-' + new Date().getTime();
}

function normalizeActionKeyForSubmission_(action) {
  return getSubmissionPolicy_().submissionNormalizeActionKey_(action);
}

function inferEntityTypeForSubmission_(input) {
  return getSubmissionPolicy_().submissionInferEntityType_(input);
}

function inferEntityKeyForSubmission_(input) {
  return getSubmissionPolicy_().submissionInferEntityKey_(input);
}

function createProposal(input) {
  var proposalInput = input || {};
  var normalizedAction = normalizeActionKeyForSubmission_(proposalInput.action || proposalInput.intent || '');
  var entityType = String(proposalInput.entity_type || inferEntityTypeForSubmission_(proposalInput)).toLowerCase();
  var proposal = {
    id: String(proposalInput.id || buildSubmissionId_('PROP')),
    source: String(proposalInput.source || 'unknown'),
    action: normalizedAction,
    actor: String(proposalInput.actor || 'unknown'),
    request_id: String(proposalInput.request_id || ''),
    payload: proposalInput.payload || {},
    approval_status: String(proposalInput.approval_status || 'PENDING').toUpperCase(),
    approved_by: String(proposalInput.approved_by || ''),
    approved_at: proposalInput.approved_at || '',
    trace_id: String(proposalInput.trace_id || buildSubmissionId_('TRACE')),
    entity_type: entityType || 'proposal',
    entity_key: String(proposalInput.entity_key || inferEntityKeyForSubmission_(proposalInput)),
    requires_approval: requiresApprovalForAction_(entityType, normalizedAction),
    proposal_version: Number(proposalInput.proposal_version || 1),
    proposal_hash: String(proposalInput.proposal_hash || ''),
    committed_at: ''
  };

  if (!proposal.proposal_hash) {
    proposal.proposal_hash = computeProposalHash_(proposal);
  }

  return createProposalInRepository_(proposal, proposalInput.repository, proposalInput);
}

function createDraft(input) { return createProposal(input); }

function persistIngressDraft(input, options) {
  var opts = options || {};
  var repository = opts.repository || getDefaultSubmissionRepository_();
  if (isDurableRepositoryRequired_(opts)) {
    assertDurableRepository_(repository, 'persistIngressDraft');
  }
  var proposal = createDraft(input);
  if (!repository) return proposal;

  if (typeof repository.writeDraftProposal === 'function') {
    repository.writeDraftProposal(proposal, opts);
    return loadPersistedProposal_(proposal.id, repository) || proposal;
  }
  if (typeof repository.writeProposalDraft === 'function') {
    repository.writeProposalDraft(proposal, opts);
    return loadPersistedProposal_(proposal.id, repository) || proposal;
  }
  if (typeof repository.writeProposal === 'function') {
    repository.writeProposal(proposal, opts);
    return loadPersistedProposal_(proposal.id, repository) || proposal;
  }
  if (typeof repository.createProposal === 'function') {
    repository.createProposal(proposal, opts);
    return loadPersistedProposal_(proposal.id, repository) || proposal;
  }
  persistProposal_(proposal, repository, opts);
  return loadPersistedProposal_(proposal.id, repository) || proposal;
}

function getProposal(proposalId, options) {
  var opts = options || {};
  var repository = getRepositoryFromOptions_(opts);
  if (isDurableRepositoryRequired_(opts)) {
    assertDurableRepository_(repository, 'getProposal');
  }
  var normalizedId = String(proposalId || '');
  var proposal = loadPersistedProposal_(normalizedId, repository);
  if (proposal && shouldUseProposalCache_(opts)) {
    getSubmissionIngress_().ProposalStore_.proposals[normalizedId] = proposal;
  }
  if (proposal) return proposal;
  if (!isDurableRepositoryRequired_(opts) && (!repository || (!repository.getProposal && !repository.getProposalById))) {
    return getSubmissionIngress_().ProposalStore_.proposals[normalizedId] || null;
  }
  return null;
}

function updateProposalState(proposalId, patch, options) {
  var opts = options || {};
  var repository = getRepositoryFromOptions_(opts);
  if (isDurableRepositoryRequired_(opts)) {
    assertDurableRepository_(repository, 'updateProposalState');
  }
  var proposal = getProposal(proposalId, { repository: repository, useCache: false });
  if (!proposal) {
    throw new Error('Proposal not found: ' + proposalId);
  }

  var updates = patch || {};
  var keys = Object.keys(updates);
  for (var i = 0; i < keys.length; i += 1) {
    proposal[keys[i]] = updates[keys[i]];
  }

  if (!proposal.proposal_hash) {
    proposal.proposal_hash = computeProposalHash_(proposal);
  }

  var updated = updateProposalInRepository_(proposal.id, proposal, repository, opts);
  if (shouldUseProposalCache_(opts)) {
    getSubmissionIngress_().ProposalStore_.proposals[updated.id] = updated;
  }
  return updated;
}

function revalidateProposalForCommit(proposal, persistedProposal) {
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

  if (persistedProposal) {
    if (Number(persistedProposal.proposal_version || 1) !== Number(proposal.proposal_version || 1)) {
      throw new Error('Governed action cannot commit because persisted proposal version changed.');
    }
    if (String(persistedProposal.proposal_hash || '') !== String(proposal.proposal_hash || '')) {
      throw new Error('Governed action cannot commit because persisted proposal hash changed.');
    }
  }

  return true;
}

function commitApprovedProposal(proposalId, options) {
  var opts = options || {};
  var repository = opts.repository;
  if (isDurableRepositoryRequired_(opts)) {
    assertDurableRepository_(repository, 'commitApprovedProposal');
  }
  if (!repository || typeof repository.commitProposal !== 'function') {
    throw new Error('Repository with commitProposal is required for final commit.');
  }

  var proposal = getProposal(proposalId, { repository: repository, useCache: false });
  if (!proposal) {
    throw new Error('Proposal not found: ' + proposalId);
  }

  var persisted = loadPersistedProposal_(proposal.id, repository);
  revalidateProposalForCommit(proposal, persisted);
  runCommitGates_(proposal, opts);

  proposal.committed_at = new Date().toISOString();
  proposal.approval_status = String(proposal.approval_status || '').toUpperCase() || 'APPROVED';
  var committed = repository.commitProposal(proposal, {
    expectedProposalVersion: persisted ? Number(persisted.proposal_version || 1) : Number(proposal.proposal_version || 1),
    expectedProposalHash: persisted ? String(persisted.proposal_hash || '') : String(proposal.proposal_hash || '')
  });

  if (opts.auditService && typeof opts.auditService.logEvent === 'function') {
    opts.auditService.logEvent({
      actorEmail: String(opts.actor || proposal.approved_by || proposal.actor || 'system'),
      entityType: String(proposal.entity_type || 'proposal'),
      entityId: String(proposal.entity_key || proposal.id),
      action: 'COMMIT',
      details: 'Proposal committed via repository; trace_id=' + String(proposal.trace_id || '') + '; proposal_id=' + String(proposal.id || '') + '; version=' + String(proposal.proposal_version || 1) + '; hash=' + String(proposal.proposal_hash || '')
    });
  }

  if (shouldUseProposalCache_(opts)) {
    getSubmissionIngress_().ProposalStore_.proposals[proposal.id] = committed;
  }
  return committed;
}

function getDefaultSubmissionRepository_() {
  return getSubmissionPersistence_().submissionGetDefaultRepository_();
}

function getRepositoryFromOptions_(options) {
  if (options && options.repository) {
    return options.repository;
  }
  return getDefaultSubmissionRepository_();
}

function createProposalInRepository_(proposal, repository, options) {
  var repo = repository || getDefaultSubmissionRepository_();
  var persisted = persistProposal_(proposal, repo, options);
  if (shouldUseProposalCache_({ repository: repo })) {
    getSubmissionIngress_().ProposalStore_.proposals[persisted.id] = persisted;
  }
  return persisted;
}

function persistProposal_(proposal, repository, options) {
  var repo = repository || getDefaultSubmissionRepository_();
  if (isDurableRepositoryRequired_(options)) {
    assertDurableRepository_(repo, 'persistProposal');
  }
  if (!repo) {
    return proposal;
  }
  if (typeof repo.createProposal === 'function') {
    return repo.createProposal(proposal);
  }
  if (typeof repo.saveProposal === 'function') {
    return repo.saveProposal(proposal);
  }
  return proposal;
}

function updateProposalInRepository_(proposalId, proposal, repository, options) {
  var repo = repository || getDefaultSubmissionRepository_();
  if (isDurableRepositoryRequired_(options)) {
    assertDurableRepository_(repo, 'updateProposalInRepository');
  }
  if (!repo) {
    return proposal;
  }
  if (typeof repo.updateProposal === 'function') {
    return repo.updateProposal(proposalId, proposal);
  }
  if (typeof repo.saveProposal === 'function') {
    return repo.saveProposal(proposal);
  }
  return proposal;
}

function loadPersistedProposal_(proposalId, repository) {
  var repo = repository || getDefaultSubmissionRepository_();
  if (!repo) {
    return null;
  }
  if (typeof repo.getProposal === 'function') {
    return repo.getProposal(proposalId);
  }
  if (typeof repo.getProposalById === 'function') {
    return repo.getProposalById(proposalId);
  }
  return null;
}

function shouldUseProposalCache_(options) {
  return !options || options.useCache !== false;
}

function isDurableRepositoryRequired_(options) {
  if (options && options.requireDurableRepository !== undefined) {
    return !!options.requireDurableRepository;
  }
  if (options && options.productionMode !== undefined) {
    return !!options.productionMode;
  }
  return typeof SpreadsheetApp !== 'undefined';
}

function assertDurableRepository_(repository, operation) {
  if (!repository) {
    throw new Error('Durable repository is required for ' + operation + '.');
  }
  var supportsRead = typeof repository.getProposal === 'function' || typeof repository.getProposalById === 'function';
  var supportsCreate = typeof repository.createProposal === 'function' || typeof repository.saveProposal === 'function' || typeof repository.writeDraftProposal === 'function' || typeof repository.writeProposalDraft === 'function' || typeof repository.writeProposal === 'function';
  var supportsUpdate = typeof repository.updateProposal === 'function' || typeof repository.saveProposal === 'function';
  if (!supportsRead || !supportsCreate || !supportsUpdate) {
    throw new Error('Durable repository missing required proposal persistence operations for ' + operation + '.');
  }
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
