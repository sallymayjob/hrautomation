/* global */
/**
 * @fileoverview Backward-compatible repository barrel.
 */

var OnboardingRepositoriesBindings_ = null;
if (typeof module !== 'undefined') {
  OnboardingRepositoriesBindings_ = {
    OnboardingRepository: require('./OnboardingRepository.gs').OnboardingRepository,
    TrainingRepository: require('./TrainingRepository.gs').TrainingRepository,
    AuditRepository: require('./AuditRepository.gs').AuditRepository
  };
  module.exports = OnboardingRepositoriesBindings_;
}
