/* global OnboardingRepository */
/** @fileoverview Learner-focused repository facade. */

function LearnerRepository(sheetClient) {
  this.onboardingRepository = new OnboardingRepository(sheetClient);
}

LearnerRepository.prototype.getRows = function () {
  return this.onboardingRepository.getRows();
};

LearnerRepository.prototype.findById = function (learnerId) {
  return this.onboardingRepository.findByEmployeeId(learnerId);
};

LearnerRepository.prototype.upsert = function (learnerId, rowValues) {
  return this.onboardingRepository.upsertRow(learnerId, rowValues);
};

if (typeof module !== 'undefined') module.exports = { LearnerRepository: LearnerRepository };
