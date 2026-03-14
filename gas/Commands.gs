/* global handleCommandsPost_, routeSlackCommand_, handleOnboardingStatusCommand_, extractSlackJsonBodyForChallenge_, parseSlackPayloadEnvelope_, handleSlackInteractivePayload_, detectWriteIntent_, formatCommandOutput_, toSlackChallengeOutput_, parseStatusCommandInput_, resolveOnboardingCandidates_, buildPhaseSnapshot_, formatOnboardingStatusSummary_, prioritizeDueItemsForTeam_, formatDisambiguationMessage_, scoreFuzzyNameMatch_, normalizeForMatch_, parseSlackUserIdFromQuery_, performOnboardingStatusLookup_, logOnboardingStatusRead_, READ_ONLY_COMMANDS, TEAM_VIEW_CONFIG, COMMAND_NAME_ONBOARDING_STATUS, COMMAND_NAME_IT_STATUS, COMMAND_NAME_FINANCE_STATUS, COMMAND_NAME_HR_STATUS, COMMAND_NAME_CHECKLIST_STATUS, COMMAND_NAME_CHECKLIST_PROGRESS, formatDateForDisplay_ */
/**
 * @fileoverview Compatibility facade for command modules.
 */

var CommandsBindings_ = null;

var CommandSecurityBindings_ = null;
var CommandIngressBindings_ = null;
var CommandsBindings_ = null;
if (typeof module !== 'undefined') {
  CommandSecurityBindings_ = require('./SecurityUtils.gs');
  CommandIngressBindings_ = require('./SlackIngress.gs');
  CommandsBindings_ = {
    ingress: require('./CommandsIngress.gs'),
    policy: require('./CommandsPolicy.gs'),
    persistence: require('./CommandsPersistenceAdapter.gs')
  };
}

function verifySlackRequestForCommands_(event) {
  if (typeof verifySlackIngressWithHooks_ === 'function') {
    return verifySlackIngressWithHooks_(event, { route: 'commands' });
  }
  if (CommandIngressBindings_ && typeof CommandIngressBindings_.verifySlackIngressWithHooks_ === 'function') {
    return CommandIngressBindings_.verifySlackIngressWithHooks_(event, { route: 'commands' });
  }
  if (typeof verifySlackIngressRequest_ === 'function') {
    return verifySlackIngressRequest_(event, { route: 'commands' });
  }
  return CommandSecurityBindings_.verifySlackIngressRequest_(event, { route: 'commands' });
}

function sanitizeForCommandLog_(value) {
  if (typeof sanitizeSlackIngressLogText_ === 'function') return sanitizeSlackIngressLogText_(value);
  return CommandIngressBindings_ && CommandIngressBindings_.sanitizeSlackIngressLogText_
    ? CommandIngressBindings_.sanitizeSlackIngressLogText_(value)
    : (typeof sanitizeTextForLog === 'function' ? sanitizeTextForLog(value) : String(value || ''));
}

function sanitizePayloadForCommandLog_(payload) {
  if (typeof sanitizePayloadForLog === 'function') return sanitizePayloadForLog(payload);
  return CommandSecurityBindings_ && CommandSecurityBindings_.sanitizePayloadForLog
    ? CommandSecurityBindings_.sanitizePayloadForLog(payload)
    : payload;
}


function createCommandAuditService_(sheetClient) {
  if (typeof AuditService !== 'undefined' && AuditService) {
    return new AuditService(sheetClient);
  }
  return {
    logEvent: function (payload) {
      if (!sheetClient || typeof sheetClient.appendAuditRow !== 'function') return;
      sheetClient.appendAuditRow([
        '',
        new Date(),
        payload.actorEmail || 'system',
        payload.entityType || 'System',
        payload.entityId || '',
        payload.action || 'UPDATE',
        payload.details || '',
        ''
      ]);
    }
  };
}


var TEAM_VIEW_CONFIG = {
  default: {
    label: 'HR',
    focusTeams: ['PEOPLE', 'HR', 'LEGAL'],
    channelGetterName: 'getHrTeamChannelId'
  },
  it: {
    label: 'IT',
    focusTeams: ['IT', 'SECURITY'],
    channelGetterName: 'getItTeamChannelId'
  },
  finance: {
    label: 'Finance',
    focusTeams: ['FINANCE', 'PAYROLL', 'COMPLIANCE'],
    channelGetterName: 'getFinanceTeamChannelId'
  },
  hr: {
    label: 'HR',
    focusTeams: ['PEOPLE', 'HR', 'LEGAL'],
    channelGetterName: 'getHrTeamChannelId'
  },
  admin: {
    label: 'Admin',
    focusTeams: ['ADMIN', 'WORKSPACE', 'GOOGLE CHROME', 'SALESFORCE', 'SLACK', 'PRE-ONBOARDING', 'SIGNATURE STATION'],
    channelGetterName: 'getAdminTeamChannelId'
  },
  marketing: {
    label: 'Marketing',
    focusTeams: ['MARKETING'],
    channelGetterName: 'getDefaultAssignmentsChannelId'
  },
  manager: {
    label: 'Manager',
    focusTeams: ['MANAGER', 'PEOPLE OPS', 'HR'],
    channelGetterName: 'getHrTeamChannelId'
  }
};

function handleCommandsPost_(e) {
  var parsedIngress = (typeof parseSlackIngressEnvelope_ === 'function')
    ? parseSlackIngressEnvelope_(e)
    : (CommandIngressBindings_ ? CommandIngressBindings_.parseSlackIngressEnvelope_(e) : { payload: {} });

  var preflightPayload = parsedIngress && parsedIngress.payload;
  if (preflightPayload && preflightPayload.type === 'url_verification') {
    return toSlackChallengeOutput_(preflightPayload);
  }

  var verification = verifySlackRequestForCommands_(e);
  if (!verification.ok) {
    console.warn('Slack ingress rejected: ' + sanitizeForCommandLog_(verification.errorCode + ' ' + verification.reason));
    var ingressErrorResponse = typeof createSlackIngressErrorResponse_ === 'function'
      ? createSlackIngressErrorResponse_(verification.errorCode, verification.reason)
      : (CommandIngressBindings_ && CommandIngressBindings_.createSlackIngressErrorResponse_
        ? CommandIngressBindings_.createSlackIngressErrorResponse_(verification.errorCode, verification.reason)
        : { response_type: 'ephemeral', text: 'Unauthorized Slack request (' + verification.errorCode + ').' });
    ingressErrorResponse.ok = false;
    ingressErrorResponse.code = verification.errorCode;
    return toSlackTextOutput_(ingressErrorResponse);
  }

  var payload = verification.parsedPayload || (parsedIngress && parsedIngress.payload) || {};
  if (payload && payload.type === 'url_verification') {
    return toSlackChallengeOutput_(payload);
  }

  var isInteractivityPayload = (typeof guardSlackInteractivityShape_ === 'function')
    ? guardSlackInteractivityShape_(payload)
    : (CommandIngressBindings_ && CommandIngressBindings_.guardSlackInteractivityShape_
      ? CommandIngressBindings_.guardSlackInteractivityShape_(payload)
      : Boolean(payload && payload.type));

  var response = payload && payload.directResponse
    ? payload.directResponse
    : (isInteractivityPayload
      ? handleSlackInteractivePayload_(payload)
      : routeSlackCommand_(payload));
  return toSlackTextOutput_(response);
}

function extractSlackJsonBodyForChallenge_(event) {
  var rawBody = event && event.postData && event.postData.contents;
  if (!rawBody) {
    return null;
  }
  try {
    var parsed = JSON.parse(rawBody);
    return parsed && parsed.type === 'url_verification' ? parsed : null;
  } catch (err) {
    return null;
  }
}

function parseSlackPayloadEnvelope_(envelope) {
  var parsed = (typeof parseSlackIngressEnvelope_ === 'function')
    ? parseSlackIngressEnvelope_({ parameter: envelope || {} })
    : (CommandIngressBindings_ ? CommandIngressBindings_.parseSlackIngressEnvelope_({ parameter: envelope || {} }) : { payload: envelope || {}, parseError: '' });

  if (!parsed.parseError) {
    return parsed.payload || {};
  }

  return {
    directResponse: {
      response_type: 'ephemeral',
      text: 'Unable to parse Slack payload. Slack commands are read-only; edit statuses directly in Google Sheets.'
    }
  };
}

function handleSlackInteractivePayload_(payload) {
  var responseText = 'Slack interactions are read-only in this workflow. To edit onboarding or checklist statuses, use Google Sheets.';
  if (typeof createSlackEphemeralResponse_ === 'function') {
    return createSlackEphemeralResponse_(responseText);
  }
  if (CommandIngressBindings_ && typeof CommandIngressBindings_.createSlackEphemeralResponse_ === 'function') {
    return CommandIngressBindings_.createSlackEphemeralResponse_(responseText);
  }
  return { response_type: 'ephemeral', text: responseText };
}

function routeSlackCommand_(payload) {
  var commandName = String(payload.command || '').trim();
  var actor = String(payload.user_name || payload.user_id || 'unknown');
  var writeIntent = detectWriteIntent_(payload.text || '');

  if (writeIntent.isWriteLikeIntent) {
    return routeWriteIntentToProposal_(payload, actor, writeIntent);
  }

  if (READ_ONLY_COMMANDS.indexOf(commandName) === -1) {
    console.info('Unsupported Slack command payload=' + JSON.stringify(sanitizePayloadForCommandLog_({ command: commandName, user_name: payload.user_name })));
    return formatCommandOutput_({
      responseType: 'ephemeral',
      text: 'Unsupported slash command: ' + (commandName || '(empty)')
    });
  }

  if (commandName === COMMAND_NAME_ONBOARDING_STATUS || commandName === COMMAND_NAME_CHECKLIST_STATUS || commandName === COMMAND_NAME_CHECKLIST_PROGRESS) {
    var defaultClient = new SheetClient();
    return handleOnboardingStatusCommand_(payload, 'default', defaultClient, createCommandAuditService_(defaultClient), new SlackClient());
  }
  if (commandName === COMMAND_NAME_IT_STATUS) {
    var itClient = new SheetClient();
    return handleOnboardingStatusCommand_(payload, 'it', itClient, createCommandAuditService_(itClient), new SlackClient());
  }
  if (commandName === COMMAND_NAME_FINANCE_STATUS) {
    var financeClient = new SheetClient();
    return handleOnboardingStatusCommand_(payload, 'finance', financeClient, createCommandAuditService_(financeClient), new SlackClient());
  }
  if (commandName === COMMAND_NAME_HR_STATUS) {
    var hrClient = new SheetClient();
    return handleOnboardingStatusCommand_(payload, 'hr', hrClient, createCommandAuditService_(hrClient), new SlackClient());
  }

  return formatCommandOutput_({
    responseType: 'ephemeral',
    text: 'Unsupported slash command: ' + (commandName || '(empty)')
  });
}

function routeWriteIntentToProposal_(payload, actor, writeIntent) {
  if (typeof SubmissionController === 'undefined' || !SubmissionController) {
    return formatCommandOutput_({
      responseType: 'ephemeral',
      text: 'Write-like requests are blocked in Slack commands. Submission proposals are currently unavailable; please use Google Sheets.'
    });
  }

  var proposalInput = {
    actor: actor,
    source: 'slack_command',
    action: writeIntent.intent,
    request_id: String(payload.trigger_id || payload.command_ts || ''),
    trace_id: String(payload.trigger_id || payload.command_ts || ''),
    command: String(payload.command || ''),
    text: String(payload.text || ''),
    intent: writeIntent.intent,
    payload: payload,
    approval_status: 'PENDING',
    entity_type: 'slack_command',
    entity_key: String(payload.command || '') + ':' + writeIntent.intent
  };

  var proposal = null;
  if (typeof SubmissionController.persistIngressDraft === 'function') {
    proposal = SubmissionController.persistIngressDraft(proposalInput);
  } else if (typeof SubmissionController.createDraft === 'function') {
    proposal = SubmissionController.createDraft(proposalInput);
  } else if (typeof SubmissionController.createProposal === 'function') {
    proposal = SubmissionController.createProposal(proposalInput);
  }

  if (!proposal) {
    return formatCommandOutput_({
      responseType: 'ephemeral',
      text: 'Write-like requests are blocked in Slack commands. Submission proposals are currently unavailable; please use Google Sheets.'
    });
  }

  var clarification = null;
  if (typeof GeminiService !== 'undefined' && GeminiService && typeof GeminiService.validateAndClarify === 'function') {
    clarification = GeminiService.validateAndClarify(proposal);
    if (clarification && clarification.status === 'rejected') {
      return formatCommandOutput_({
        responseType: 'ephemeral',
        text: 'Captured your request as proposal ' + proposal.id + ', but Gemini validation rejected it: ' + String(clarification.reason || 'insufficient detail')
      });
    }
  }

  if (typeof ApprovalController !== 'undefined' && ApprovalController) {
    if (proposal.requires_approval && typeof ApprovalController.requestLiamApproval === 'function') {
      ApprovalController.requestLiamApproval({ proposal: proposal, clarification: clarification, approval_status: 'PENDING' });
    } else if (typeof ApprovalController.requestApproval === 'function') {
      ApprovalController.requestApproval({ proposal: proposal, clarification: clarification, approval_status: 'PENDING' });
    }
  }

  return formatCommandOutput_({
    responseType: 'ephemeral',
    text: 'Captured your request as a proposal' + (proposal && proposal.id ? ' (' + proposal.id + ')' : '') + '. It is now queued for Gemini + approval review before any write can happen.'
  });
}

function detectWriteIntent_(rawText) {
  var normalized = normalizeForMatch_(rawText);
  var writeVerbs = ['update', 'set', 'change', 'edit', 'complete', 'reopen', 'close', 'approve', 'reject', 'delete', 'create', 'add'];

  for (var i = 0; i < writeVerbs.length; i += 1) {
    if (normalized.indexOf(writeVerbs[i] + ' ') === 0 || normalized.indexOf(' ' + writeVerbs[i] + ' ') > -1) {
      return {
        isWriteLikeIntent: true,
        intent: writeVerbs[i]
      };
    }
  }

  return {
    isWriteLikeIntent: false,
    intent: ''
  };
}

function handleOnboardingStatusCommand_(payload, teamViewKey, sheetClient, auditService, slackClient) {
  var parsedInput = parseStatusCommandInput_(payload.text || '');
  var query = parsedInput.query;
  var shareToTeamChannel = parsedInput.shareToTeamChannel;
  var actor = String(payload.user_name || payload.user_id || 'unknown');
  var teamView = TEAM_VIEW_CONFIG[teamViewKey] || TEAM_VIEW_CONFIG.default;

  if (!query) {
    logOnboardingStatusRead_(auditService, actor, query, teamView.label, 'invalid_query', 0);
    return formatCommandOutput_({
      responseType: 'ephemeral',
      text: 'Usage: /onboarding-status <new hire name>\nExample: /onboarding-status Amelia Thompson'
    });
  }

  var lookupResult = performOnboardingStatusLookup_(query, sheetClient);
  logOnboardingStatusRead_(auditService, actor, query, teamView.label, lookupResult.matchType, lookupResult.candidates.length);

  if (lookupResult.candidates.length === 0) {
    return formatCommandOutput_({
      responseType: 'ephemeral',
      text: 'No onboarding records found for "' + query + '".'
    });
  }

  if (lookupResult.candidates.length > 1) {
    return formatCommandOutput_({
      responseType: 'ephemeral',
      text: formatDisambiguationMessage_(query, lookupResult.candidates)
    });
  }

  var candidate = lookupResult.candidates[0];
  var snapshot = lookupResult.snapshot;
  var summaryText = formatOnboardingStatusSummary_(candidate, snapshot, teamView);

  if (shareToTeamChannel) {
    postTeamTransparencyUpdate_(teamView, candidate, summaryText, slackClient);
  }

  return formatCommandOutput_({
    responseType: 'ephemeral',
    text: summaryText
  });
}

function parseStatusCommandInput_(rawText) {
  var text = String(rawText || '').trim();
  var shareToTeamChannel = /\s--share\b/i.test(' ' + text);
  return {
    shareToTeamChannel: shareToTeamChannel,
    query: text.replace(/\s--share\b/ig, '').trim()
  };
}


function parseSlackUserIdFromQuery_(query) {
  var normalized = String(query || '').trim();
  var mentionMatch = normalized.match(/^<@([A-Z0-9]+)>$/i);
  if (mentionMatch) {
    return mentionMatch[1].toUpperCase();
  }
  var atHandleMatch = normalized.match(/^@([A-Z0-9]+)$/i);
  if (atHandleMatch) {
    return atHandleMatch[1].toUpperCase();
  }
  return '';
}

function performOnboardingStatusLookup_(query, sheetClient) {
  var resolution = resolveOnboardingCandidates_(query, sheetClient);

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
