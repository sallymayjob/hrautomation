/* global Config, CoreConstants */
/**
 * @fileoverview Durable proposal persistence for governance submissions/approvals sheets.
 */

var SubmissionRepoBindings_ = null;
if (typeof module !== 'undefined') {
  SubmissionRepoBindings_ = {
    SheetClient: require('./SheetClient.gs').SheetClient,
    VersioningService: require('./VersioningService.gs')
  };
}

var SUBMISSION_HEADERS = (typeof CoreConstants !== 'undefined' && CoreConstants && CoreConstants.SCHEMA && CoreConstants.SCHEMA.REPOSITORY_HEADERS && CoreConstants.SCHEMA.REPOSITORY_HEADERS.submissions ? CoreConstants.SCHEMA.REPOSITORY_HEADERS.submissions.slice() : [
  'submission_id', 'entity_type', 'entity_key', 'payload_json', 'approval_status',
  'submitted_by', 'approved_by', 'trace_id', 'version', 'source',
  'submitted_at', 'approved_at', 'created_at', 'updated_at', 'action',
  'request_id', 'idempotency_key', 'requires_approval', 'proposal_hash', 'approval_hash', 'approval_version',
  'rejection_reason', 'committed_at'
]);

function getSheetClientForSubmission_() {
  if (typeof SheetClient !== 'undefined' && SheetClient) return SheetClient;
  return SubmissionRepoBindings_ ? SubmissionRepoBindings_.SheetClient : null;
}

function getVersioningServiceForSubmission_() {
  return SubmissionRepoBindings_ ? SubmissionRepoBindings_.VersioningService : null;
}

function SubmissionRepository(sheetClient) {
  this.sheetClient = sheetClient || (getSheetClientForSubmission_() ? new (getSheetClientForSubmission_())() : null);
}

SubmissionRepository.prototype.createProposal = function (proposal) {
  return this.saveProposal(proposal);
};

SubmissionRepository.prototype.getProposal = function (proposalId) {
  return this.getProposalById(proposalId);
};

SubmissionRepository.prototype.getProposalByIdempotencyKey = function (idempotencyKey) {
  if (!this.sheetClient) return null;
  var normalizedKey = String(idempotencyKey || '');
  if (!normalizedKey) return null;
  var sheet = this.ensureSheet_();
  var keyColumn = this.sheetClient.getColumnIndexByHeaderKey_(sheet, 'idempotency_key', true);
  var rowIndex = this.sheetClient.findRowIndexByValue_(sheet, keyColumn, normalizedKey);
  if (rowIndex < 0) return null;
  var values = sheet.getRange(rowIndex, 1, 1, SUBMISSION_HEADERS.length).getValues()[0];
  return this.fromRow_(values);
};


SubmissionRepository.prototype.updateProposal = function (proposalId, patch) {
  var proposal = this.getProposalById(proposalId);
  if (!proposal) return null;

  var updates = patch || {};
  var keys = Object.keys(updates);
  for (var i = 0; i < keys.length; i += 1) {
    proposal[keys[i]] = updates[keys[i]];
  }

  this.saveProposal(proposal);
  return proposal;
};

SubmissionRepository.prototype.commitProposal = function (proposal, options) {
  if (!proposal) {
    throw new Error('Proposal is required.');
  }

  var opts = options || {};
  var persisted = this.getProposalById(proposal.id);
  if (!persisted) {
    throw new Error('Proposal not found: ' + proposal.id);
  }

  if (opts.expectedProposalVersion !== undefined && Number(persisted.proposal_version || 1) !== Number(opts.expectedProposalVersion)) {
    throw new Error('Optimistic commit failed: proposal version mismatch for ' + proposal.id + '.');
  }
  if (opts.expectedProposalHash && String(persisted.proposal_hash || '') !== String(opts.expectedProposalHash)) {
    throw new Error('Optimistic commit failed: proposal hash mismatch for ' + proposal.id + '.');
  }

  this.saveProposal(proposal);
  return proposal;
};

SubmissionRepository.prototype.writeDraftProposal = function (proposal) {
  return this.createProposal(proposal);
};

SubmissionRepository.prototype.writeProposalDraft = function (proposal) {
  return this.createProposal(proposal);
};

SubmissionRepository.prototype.writeProposal = function (proposal) {
  return this.createProposal(proposal);
};

SubmissionRepository.prototype.ensureSheet_ = function () {
  if (!this.sheetClient) return null;
  var sheet = this.sheetClient.ensureSheetWithHeaders(Config.getSubmissionsSheetName(), SUBMISSION_HEADERS);
  var expectedVersion = (typeof CoreConstants !== 'undefined' && CoreConstants && CoreConstants.SCHEMA && CoreConstants.SCHEMA.SHEET_DEFINITIONS && CoreConstants.SCHEMA.SHEET_DEFINITIONS.submissions) ? CoreConstants.SCHEMA.SHEET_DEFINITIONS.submissions.expectedVersion : 1;
  if (typeof this.sheetClient.getSchemaVersionFromConfig_ === 'function' && typeof this.sheetClient.assertSchemaVersionCompatibility_ === 'function') {
    var configuredVersion = this.sheetClient.getSchemaVersionFromConfig_(sheet.getParent(), sheet.getName());
    if (configuredVersion) {
      this.sheetClient.assertSchemaVersionCompatibility_(sheet.getName(), expectedVersion, configuredVersion, { strict: true });
    }
  } else {
    var versioning = getVersioningServiceForSubmission_();
    if (versioning && typeof versioning.assertSchemaVersionCompatibility === 'function') {
      versioning.assertSchemaVersionCompatibility(sheet.getName(), expectedVersion, String(expectedVersion), { strict: true });
    }
  }
  return sheet;
};

SubmissionRepository.prototype.saveProposal = function (proposal) {
  if (!this.sheetClient) return proposal;
  var sheet = this.ensureSheet_();
  var idColumn = this.sheetClient.getColumnIndexByHeaderKey_(sheet, 'submission_id', true);
  var existingRow = this.sheetClient.findRowIndexByValue_(sheet, idColumn, proposal.id);
  var idempotencyKey = String(proposal.idempotency_key || proposal.request_id || proposal.trace_id || '');
  var idempotencyColumn = this.sheetClient.getColumnIndexByHeaderKey_(sheet, 'idempotency_key', true);
  var existingByKey = idempotencyKey ? this.sheetClient.findRowIndexByValue_(sheet, idempotencyColumn, idempotencyKey) : -1;
  if (existingByKey > -1 && existingRow < 0) {
    var existingValues = sheet.getRange(existingByKey, 1, 1, SUBMISSION_HEADERS.length).getValues()[0];
    return this.fromRow_(existingValues);
  }
  var row = this.toRow_(proposal);
  if (existingRow > -1) {
    this.sheetClient.writeRow_(sheet, existingRow, row);
  } else {
    this.sheetClient.appendRow_(sheet, row);
  }
  return proposal;
};

SubmissionRepository.prototype.getProposalById = function (proposalId) {
  if (!this.sheetClient) return null;
  var sheet = this.ensureSheet_();
  var idColumn = this.sheetClient.getColumnIndexByHeaderKey_(sheet, 'submission_id', true);
  var rowIndex = this.sheetClient.findRowIndexByValue_(sheet, idColumn, String(proposalId || ''));
  if (rowIndex < 0) return null;
  var values = sheet.getRange(rowIndex, 1, 1, SUBMISSION_HEADERS.length).getValues()[0];
  return this.fromRow_(values);
};

SubmissionRepository.prototype.toRow_ = function (proposal) {
  var payloadJson = '{}';
  try {
    payloadJson = JSON.stringify(proposal.payload || {});
  } catch (err) {
    payloadJson = '{}';
  }

  return [
    String(proposal.id || ''),
    String(proposal.entity_type || ''),
    String(proposal.entity_key || ''),
    payloadJson,
    String(proposal.approval_status || 'PENDING'),
    String(proposal.actor || ''),
    String(proposal.approved_by || ''),
    String(proposal.trace_id || ''),
    Number(proposal.proposal_version || 1),
    String(proposal.source || ''),
    String(proposal.submitted_at || ''),
    String(proposal.approved_at || ''),
    String(proposal.created_at || ''),
    String(proposal.updated_at || ''),
    String(proposal.action || ''),
    String(proposal.request_id || ''),
    String(proposal.idempotency_key || proposal.request_id || proposal.trace_id || ''),
    proposal.requires_approval ? 'true' : 'false',
    String(proposal.proposal_hash || ''),
    String(proposal.approval_hash || ''),
    proposal.approval_version === undefined ? '' : Number(proposal.approval_version),
    String(proposal.rejection_reason || ''),
    String(proposal.committed_at || '')
  ];
};

SubmissionRepository.prototype.fromRow_ = function (row) {
  var payload = {};
  try {
    payload = JSON.parse(String(row[3] || '{}'));
  } catch (err) {
    payload = {};
  }
  return {
    id: String(row[0] || ''),
    entity_type: String(row[1] || ''),
    entity_key: String(row[2] || ''),
    payload: payload,
    approval_status: String(row[4] || 'PENDING'),
    actor: String(row[5] || ''),
    approved_by: String(row[6] || ''),
    trace_id: String(row[7] || ''),
    proposal_version: Number(row[8] || 1),
    source: String(row[9] || ''),
    submitted_at: String(row[10] || ''),
    approved_at: String(row[11] || ''),
    created_at: String(row[12] || ''),
    updated_at: String(row[13] || ''),
    action: String(row[14] || ''),
    request_id: String(row[15] || ''),
    idempotency_key: String(row[16] || row[15] || row[7] || ''),
    requires_approval: String(row[17] || '').toLowerCase() === 'true',
    proposal_hash: String(row[18] || ''),
    approval_hash: String(row[19] || ''),
    approval_version: row[20] === '' ? undefined : Number(row[20]),
    rejection_reason: String(row[21] || ''),
    committed_at: String(row[22] || '')
  };
};

if (typeof module !== 'undefined') {
  module.exports = { SubmissionRepository: SubmissionRepository };
}
