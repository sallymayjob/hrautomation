/**
 * @fileoverview Local integration adapter for Slack command ingress.
 */

var CommandsBindings_ = null;
if (typeof module !== 'undefined') {
  CommandsBindings_ = {
    ingress: require('./CommandsIngress.gs'),
    policy: require('./CommandsPolicy.gs'),
    persistence: require('./CommandsPersistenceAdapter.gs')
  };
}

function getCommandsBindings_() {
  if (CommandsBindings_) return CommandsBindings_;
  return {
    ingress: this,
    policy: this,
    persistence: this
  };
}

function doPost(e) {
  var b = getCommandsBindings_();
  return b.ingress.handleCommandsPost_(e, b.policy, b.persistence);
}

if (typeof module !== 'undefined') {
  function routeSlackCommand(payload) {
    var b = getCommandsBindings_();
    return b.ingress.routeSlackCommand_(payload, b.policy, b.persistence);
  }
  function handleOnboardingStatusCommand(payload, teamViewKey, sheetClient, auditService, slackClient) {
    var b = getCommandsBindings_();
    return b.ingress.handleOnboardingStatusCommand_(payload, teamViewKey, sheetClient, auditService, slackClient, b.policy, b.persistence);
  }
  function resolveOnboardingCandidates(query, sheetClient) {
    return getCommandsBindings_().policy.resolveOnboardingCandidates_(query, sheetClient.getOnboardingRows());
  }
  function performOnboardingStatusLookup(query, sheetClient) {
    var b = getCommandsBindings_();
    return b.persistence.performOnboardingStatusLookup_(query, sheetClient, b.policy);
  }

  module.exports = {
    doPost: doPost,
    handleCommandsPost_: doPost,
    routeSlackCommand_: routeSlackCommand,
    handleOnboardingStatusCommand_: handleOnboardingStatusCommand,
    parseStatusCommandInput_: getCommandsBindings_().policy.parseStatusCommandInput_,
    performOnboardingStatusLookup_: performOnboardingStatusLookup,
    resolveOnboardingCandidates_: resolveOnboardingCandidates,
    buildPhaseSnapshot_: getCommandsBindings_().policy.buildPhaseSnapshot_,
    formatOnboardingStatusSummary_: getCommandsBindings_().policy.formatOnboardingStatusSummary_,
    prioritizeDueItemsForTeam_: getCommandsBindings_().policy.prioritizeDueItemsForTeam_,
    formatDisambiguationMessage_: getCommandsBindings_().policy.formatDisambiguationMessage_,
    scoreFuzzyNameMatch_: getCommandsBindings_().policy.scoreFuzzyNameMatch_,
    normalizeForMatch_: getCommandsBindings_().policy.normalizeForMatch_,
    logOnboardingStatusRead_: getCommandsBindings_().persistence.logOnboardingStatusRead_,
    extractSlackJsonBodyForChallenge_: getCommandsBindings_().ingress.extractSlackJsonBodyForChallenge_,
    parseSlackPayloadEnvelope_: getCommandsBindings_().ingress.parseSlackPayloadEnvelope_,
    handleSlackInteractivePayload_: getCommandsBindings_().ingress.handleSlackInteractivePayload_,
    parseSlackUserIdFromQuery_: getCommandsBindings_().policy.parseSlackUserIdFromQuery_,
    detectWriteIntent_: function (text) { return getCommandsBindings_().ingress.detectWriteIntent_(text, getCommandsBindings_().policy); },
    formatCommandOutput_: getCommandsBindings_().ingress.formatCommandOutput_,
    toSlackChallengeOutput_: getCommandsBindings_().ingress.toSlackChallengeOutput_,
    READ_ONLY_COMMANDS: getCommandsBindings_().policy.READ_ONLY_COMMANDS
  };
}
