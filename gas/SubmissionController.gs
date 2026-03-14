/* global generateId, Config, computeHash, SubmissionRepository, SheetClient */
/**
 * @fileoverview Proposal lifecycle controller for governed LMS lesson mutations.
 */

var SubmissionControllerBindings_ = null;
if (typeof module !== 'undefined') {
  SubmissionControllerBindings_ = {
    VersioningService: require('./VersioningService.gs'),
    MappingService: require('./MappingService.gs'),
    DuplicateDetector: require('./DuplicateDetector.gs'),
    SubmissionRepository: require('./SubmissionRepository.gs').SubmissionRepository,
    SheetClient: require('./SheetClient.gs').SheetClient
  };
}

var ProposalStore_ = {
  proposals: {}
};

var SubmissionRepositoryOverride_ = null;


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

  return createProposalInRepository_(proposal, proposalInput.repository);
}

function createDraft(input) {
  return createProposal(input);
}

function persistIngressDraft(input, options) {
  var proposal = createDraft(input);
  var opts = options || {};
  var repository = opts.repository || getDefaultSubmissionRepository_();
  if (!repository) {
    return proposal;
  }
  if (typeof repository.writeDraftProposal === 'function') {
    return repository.writeDraftProposal(proposal, opts);
  }
  if (typeof repository.writeProposalDraft === 'function') {
    return repository.writeProposalDraft(proposal, opts);
  }
  if (typeof repository.writeProposal === 'function') {
    return repository.writeProposal(proposal, opts);
  }
  if (typeof repository.createProposal === 'function') {
    return repository.createProposal(proposal, opts);
  }
  return persistProposal_(proposal, repository);
}

function getProposal(proposalId, options) {
  var repository = getRepositoryFromOptions_(options);
  var normalizedId = String(proposalId || '');
  var proposal = loadPersistedProposal_(normalizedId, repository);
  if (proposal && shouldUseProposalCache_(options)) {
    ProposalStore_.proposals[normalizedId] = proposal;
  }
  if (proposal) {
    return proposal;
  }
  if (!repository || (!repository.getProposal && !repository.getProposalById)) {
    return ProposalStore_.proposals[normalizedId] || null;
  }
  return null;
}

function updateProposalState(proposalId, patch, options) {
  var repository = getRepositoryFromOptions_(options);
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

  var updated = updateProposalInRepository_(proposal.id, proposal, repository);
  if (shouldUseProposalCache_(options)) {
    ProposalStore_.proposals[updated.id] = updated;
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
    ProposalStore_.proposals[proposal.id] = committed;
  }
  return committed;
}

function getDefaultSubmissionRepository_() {
  if (SubmissionRepositoryOverride_) {
    return SubmissionRepositoryOverride_;
  }
  if (typeof SpreadsheetApp === 'undefined') {
    return null;
  }
  if (typeof SubmissionRepository !== 'undefined' && SubmissionRepository && typeof SheetClient !== 'undefined' && SheetClient) {
    return new SubmissionRepository(new SheetClient());
  }
  if (SubmissionControllerBindings_ && SubmissionControllerBindings_.SubmissionRepository && SubmissionControllerBindings_.SheetClient) {
    return new SubmissionControllerBindings_.SubmissionRepository(new SubmissionControllerBindings_.SheetClient());
  }
  return null;
}

function getRepositoryFromOptions_(options) {
  if (options && options.repository) {
    return options.repository;
  }
  return getDefaultSubmissionRepository_();
}

function createProposalInRepository_(proposal, repository) {
  var repo = repository || getDefaultSubmissionRepository_();
  var persisted = persistProposal_(proposal, repo);
  if (shouldUseProposalCache_({ repository: repo })) {
    ProposalStore_.proposals[persisted.id] = persisted;
  }
  return persisted;
}

function persistProposal_(proposal, repository) {
  var repo = repository || getDefaultSubmissionRepository_();
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

function updateProposalInRepository_(proposalId, proposal, repository) {
  var repo = repository || getDefaultSubmissionRepository_();
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

  if (!versioning || !mapping || !duplicateDetector) {
    throw new Error('Commit gates are not fully configured.');
  }

  var existingRows = gateContext.existingRows || [];
  var keyField = gateContext.keyField || 'entity_key';
  var versionField = gateContext.versionField || 'version';
  var entityKey = proposal.entity_key;
  var nextVersion = versioning.calculateNextVersion_(existingRows, keyField, entityKey, versionField);
  versioning.assertImmutableHistoricalRows_(existingRows, keyField, entityKey, nextVersion, versionField);

  mapping.validateMappingConstraints_(proposal.payload || {}, gateContext.mapping || {});

  var duplicateCheck = duplicateDetector.detectDuplicate_(proposal, gateContext.existingRecords || [], gateContext.duplicate || {});
  if (duplicateCheck.duplicate) {
    throw new Error('Duplicate gate failed: ' + duplicateCheck.reason);
  }

  proposal.proposal_version = Number(nextVersion || proposal.proposal_version || 1);
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


function setSubmissionRepositoryForTests_(repository) {
  SubmissionRepositoryOverride_ = repository || null;
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
    ProposalStore_: ProposalStore_,
    setSubmissionRepositoryForTests_: setSubmissionRepositoryForTests_
  };
}
