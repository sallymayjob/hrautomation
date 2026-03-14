/** @fileoverview Ingress orchestrator wrapper for onboarding row processing. */

function onboardingProcessIngressRow_(processor, sheet, rowIndex, workflowContext, repositories) {
  return processor(sheet, rowIndex, workflowContext, repositories);
}

if (typeof module !== 'undefined') module.exports = { onboardingProcessIngressRow_: onboardingProcessIngressRow_ };
