/* global handleCommandsPost_, routeSlackCommand_, handleOnboardingStatusCommand_, extractSlackJsonBodyForChallenge_, parseSlackPayloadEnvelope_, handleSlackInteractivePayload_, detectWriteIntent_, formatCommandOutput_, toSlackChallengeOutput_, parseStatusCommandInput_, resolveOnboardingCandidates_, buildPhaseSnapshot_, formatOnboardingStatusSummary_, prioritizeDueItemsForTeam_, formatDisambiguationMessage_, scoreFuzzyNameMatch_, normalizeForMatch_, parseSlackUserIdFromQuery_, performOnboardingStatusLookup_, logOnboardingStatusRead_, READ_ONLY_COMMANDS, TEAM_VIEW_CONFIG, COMMAND_NAME_ONBOARDING_STATUS, COMMAND_NAME_IT_STATUS, COMMAND_NAME_FINANCE_STATUS, COMMAND_NAME_HR_STATUS, COMMAND_NAME_CHECKLIST_STATUS, COMMAND_NAME_CHECKLIST_PROGRESS, formatDateForDisplay_ */
/**
 * @fileoverview Compatibility facade for command modules.
 */

var CommandsBindings_ = null;

function getCommandsBindings_() {
  if (CommandsBindings_) return CommandsBindings_;

  if (typeof module !== 'undefined') {
    CommandsBindings_ = {
      ingress: require('./CommandsIngress.gs'),
      policy: require('./CommandsPolicy.gs'),
      persistence: require('./CommandsPersistenceAdapter.gs')
    };
    return CommandsBindings_;
  }

  CommandsBindings_ = {
    ingress: {
      handleCommandsPost_: handleCommandsPost_,
      routeSlackCommand_: routeSlackCommand_,
      handleOnboardingStatusCommand_: handleOnboardingStatusCommand_,
      extractSlackJsonBodyForChallenge_: extractSlackJsonBodyForChallenge_,
      parseSlackPayloadEnvelope_: parseSlackPayloadEnvelope_,
      handleSlackInteractivePayload_: handleSlackInteractivePayload_,
      detectWriteIntent_: detectWriteIntent_,
      formatCommandOutput_: formatCommandOutput_,
      toSlackChallengeOutput_: toSlackChallengeOutput_
    },
    policy: {
      TEAM_VIEW_CONFIG: TEAM_VIEW_CONFIG,
      READ_ONLY_COMMANDS: READ_ONLY_COMMANDS,
      COMMAND_NAME_ONBOARDING_STATUS: COMMAND_NAME_ONBOARDING_STATUS,
      COMMAND_NAME_IT_STATUS: COMMAND_NAME_IT_STATUS,
      COMMAND_NAME_FINANCE_STATUS: COMMAND_NAME_FINANCE_STATUS,
      COMMAND_NAME_HR_STATUS: COMMAND_NAME_HR_STATUS,
      COMMAND_NAME_CHECKLIST_STATUS: COMMAND_NAME_CHECKLIST_STATUS,
      COMMAND_NAME_CHECKLIST_PROGRESS: COMMAND_NAME_CHECKLIST_PROGRESS,
      parseStatusCommandInput_: parseStatusCommandInput_,
      resolveOnboardingCandidates_: resolveOnboardingCandidates_,
      buildPhaseSnapshot_: buildPhaseSnapshot_,
      formatOnboardingStatusSummary_: formatOnboardingStatusSummary_,
      prioritizeDueItemsForTeam_: prioritizeDueItemsForTeam_,
      formatDisambiguationMessage_: formatDisambiguationMessage_,
      scoreFuzzyNameMatch_: scoreFuzzyNameMatch_,
      normalizeForMatch_: normalizeForMatch_,
      parseSlackUserIdFromQuery_: parseSlackUserIdFromQuery_,
      formatDateForDisplay_: formatDateForDisplay_
    },
    persistence: {
      performOnboardingStatusLookup_: performOnboardingStatusLookup_,
      logOnboardingStatusRead_: logOnboardingStatusRead_
    }
  };

  return CommandsBindings_;
}

function doPost(e) {
  var b = getCommandsBindings_();
  return b.ingress.handleCommandsPost_(e, b.policy, b.persistence);
}

if (typeof module !== 'undefined') {
  function routeSlackCommandFacade_(payload) {
    var b = getCommandsBindings_();
    return b.ingress.routeSlackCommand_(payload, b.policy, b.persistence);
  }

  function handleOnboardingStatusCommandFacade_(payload, teamViewKey, sheetClient, auditService, slackClient) {
    var b = getCommandsBindings_();
    return b.ingress.handleOnboardingStatusCommand_(payload, teamViewKey, sheetClient, auditService, slackClient, b.policy, b.persistence);
  }

  module.exports = {
    doPost: doPost,
    handleCommandsPost_: doPost,
    routeSlackCommand_: routeSlackCommandFacade_,
    handleOnboardingStatusCommand_: handleOnboardingStatusCommandFacade_,
    parseStatusCommandInput_: function (rawText) { return getCommandsBindings_().policy.parseStatusCommandInput_(rawText); },
    performOnboardingStatusLookup_: function (query, sheetClient) {
      var b = getCommandsBindings_();
      return b.persistence.performOnboardingStatusLookup_(query, sheetClient, b.policy);
    },
    resolveOnboardingCandidates_: function (query, sheetClient) {
      return getCommandsBindings_().policy.resolveOnboardingCandidates_(query, sheetClient.getOnboardingRows());
    },
    buildPhaseSnapshot_: function (onboardingId, checklistRows) { return getCommandsBindings_().policy.buildPhaseSnapshot_(onboardingId, checklistRows); },
    formatOnboardingStatusSummary_: function (candidate, snapshot, teamView) { return getCommandsBindings_().policy.formatOnboardingStatusSummary_(candidate, snapshot, teamView); },
    prioritizeDueItemsForTeam_: function (dueItems, focusTeams) { return getCommandsBindings_().policy.prioritizeDueItemsForTeam_(dueItems, focusTeams); },
    formatDisambiguationMessage_: function (query, candidates) { return getCommandsBindings_().policy.formatDisambiguationMessage_(query, candidates); },
    scoreFuzzyNameMatch_: function (candidateName, query) { return getCommandsBindings_().policy.scoreFuzzyNameMatch_(candidateName, query); },
    normalizeForMatch_: function (value) { return getCommandsBindings_().policy.normalizeForMatch_(value); },
    logOnboardingStatusRead_: function (auditService, actor, query, teamLabel, matchType, resultCount, commandName) {
      return getCommandsBindings_().persistence.logOnboardingStatusRead_(auditService, actor, query, teamLabel, matchType, resultCount, commandName);
    },
    extractSlackJsonBodyForChallenge_: function (event) { return getCommandsBindings_().ingress.extractSlackJsonBodyForChallenge_(event); },
    parseSlackPayloadEnvelope_: function (envelope) { return getCommandsBindings_().ingress.parseSlackPayloadEnvelope_(envelope); },
    handleSlackInteractivePayload_: function (payload) { return getCommandsBindings_().ingress.handleSlackInteractivePayload_(payload); },
    parseSlackUserIdFromQuery_: function (query) { return getCommandsBindings_().policy.parseSlackUserIdFromQuery_(query); },
    detectWriteIntent_: function (text) {
      var b = getCommandsBindings_();
      return b.ingress.detectWriteIntent_(text, b.policy);
    },
    formatCommandOutput_: function (responsePayload) { return getCommandsBindings_().ingress.formatCommandOutput_(responsePayload); },
    toSlackChallengeOutput_: function (payload) { return getCommandsBindings_().ingress.toSlackChallengeOutput_(payload); },
    READ_ONLY_COMMANDS: getCommandsBindings_().policy.READ_ONLY_COMMANDS
  };
}
