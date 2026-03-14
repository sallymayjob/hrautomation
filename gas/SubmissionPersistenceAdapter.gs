/* global SubmissionRepository, SheetClient */
/**
 * @fileoverview Persistence adapter for submission proposals.
 */

var SubmissionControllerBindings_ = null;
if (typeof module !== 'undefined') {
  SubmissionControllerBindings_ = {
    SubmissionRepository: require('./SubmissionRepository.gs').SubmissionRepository,
    SheetClient: require('./SheetClient.gs').SheetClient
  };
}

var SubmissionRepositoryOverride_ = null;

function submissionGetDefaultRepository_() {
  if (SubmissionRepositoryOverride_) return SubmissionRepositoryOverride_;
  if (typeof SpreadsheetApp === 'undefined') return null;
  if (typeof SubmissionRepository !== 'undefined' && SubmissionRepository && typeof SheetClient !== 'undefined' && SheetClient) {
    return new SubmissionRepository(new SheetClient());
  }
  if (SubmissionControllerBindings_ && SubmissionControllerBindings_.SubmissionRepository && SubmissionControllerBindings_.SheetClient) {
    return new SubmissionControllerBindings_.SubmissionRepository(new SubmissionControllerBindings_.SheetClient());
  }
  return null;
}

function submissionPersistProposal_(proposal, repository) {
  var repo = repository || submissionGetDefaultRepository_();
  if (repo && typeof repo.saveProposal === 'function') repo.saveProposal(proposal);
}

function submissionLoadPersistedProposal_(proposalId) {
  var repo = submissionGetDefaultRepository_();
  if (!repo || typeof repo.getProposalById !== 'function') return null;
  return repo.getProposalById(proposalId);
}

function submissionSetRepositoryForTests_(repository) {
  SubmissionRepositoryOverride_ = repository || null;
}

if (typeof module !== 'undefined') {
  module.exports = {
    submissionGetDefaultRepository_: submissionGetDefaultRepository_,
    submissionPersistProposal_: submissionPersistProposal_,
    submissionLoadPersistedProposal_: submissionLoadPersistedProposal_,
    submissionSetRepositoryForTests_: submissionSetRepositoryForTests_
  };
}
