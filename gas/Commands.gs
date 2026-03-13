/* global SheetClient, AuditService, ContentService, SlackClient, Config, SubmissionController, GeminiService, ApprovalController */
/**
 * @fileoverview Slack slash command handlers for read-only onboarding lookups.
 */

var COMMAND_NAME_ONBOARDING_STATUS = '/onboarding-status';
var COMMAND_NAME_IT_STATUS = '/it-onboarding-status';
var COMMAND_NAME_FINANCE_STATUS = '/finance-onboarding-status';
var COMMAND_NAME_HR_STATUS = '/hr-onboarding-status';
var COMMAND_NAME_CHECKLIST_STATUS = '/checklist-status';
var COMMAND_NAME_CHECKLIST_PROGRESS = '/checklist-progress';
var READ_ONLY_COMMANDS = [
  COMMAND_NAME_ONBOARDING_STATUS,
  COMMAND_NAME_IT_STATUS,
  COMMAND_NAME_FINANCE_STATUS,
  COMMAND_NAME_HR_STATUS,
  COMMAND_NAME_CHECKLIST_STATUS,
  COMMAND_NAME_CHECKLIST_PROGRESS
];
var MAX_DISAMBIGUATION_RESULTS = 5;
var MAX_DUE_ITEMS = 3;


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

function doPost(e) {
  var envelope = (e && e.parameter) || {};
  var payload = parseSlackPayloadEnvelope_(envelope);
  var response = payload && payload.directResponse
    ? payload.directResponse
    : (payload && payload.type
      ? handleSlackInteractivePayload_(payload)
      : routeSlackCommand_(payload));
  return toSlackTextOutput_(response);
}

function parseSlackPayloadEnvelope_(envelope) {
  if (!envelope || !envelope.payload) {
    return envelope || {};
  }

  try {
    return JSON.parse(envelope.payload);
  } catch (err) {
    return {
      directResponse: {
        response_type: 'ephemeral',
        text: 'Unable to parse Slack payload. Slack commands are read-only; edit statuses directly in Google Sheets.'
      }
    };
  }
}

function handleSlackInteractivePayload_(payload) {
  return {
    response_type: 'ephemeral',
    text: 'Slack interactions are read-only in this workflow. To edit onboarding or checklist statuses, use Google Sheets.'
  };
}

function routeSlackCommand_(payload) {
  var commandName = String(payload.command || '').trim();
  var actor = String(payload.user_name || payload.user_id || 'unknown');
  var writeIntent = detectWriteIntent_(payload.text || '');

  if (writeIntent.isWriteLikeIntent) {
    return routeWriteIntentToProposal_(payload, actor, writeIntent);
  }

  if (READ_ONLY_COMMANDS.indexOf(commandName) === -1) {
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

  if (resolution.candidates.length !== 1) {
    return {
      matchType: resolution.matchType,
      candidates: resolution.candidates,
      snapshot: null
    };
  }

  var checklistRows = sheetClient.getChecklistRows();
  return {
    matchType: resolution.matchType,
    candidates: resolution.candidates,
    snapshot: buildPhaseSnapshot_(resolution.candidates[0].onboardingId, checklistRows)
  };
}

function logOnboardingStatusRead_(auditService, actor, query, teamLabel, matchType, resultCount) {
  if (!auditService) {
    return;
  }
  if (typeof auditService.logEvent === 'function') {
    auditService.logEvent({
    actorEmail: actor,
    entityType: 'OnboardingCommand',
    entityId: COMMAND_NAME_ONBOARDING_STATUS,
    action: 'READ',
    details: 'team=' + teamLabel + '; query="' + query + '"; match_type=' + matchType + '; result_count=' + resultCount
    });
    return;
  }
  if (typeof auditService.log === 'function') {
    auditService.log({
      actorEmail: actor,
      entityType: 'OnboardingCommand',
      entityId: COMMAND_NAME_ONBOARDING_STATUS,
      action: 'READ',
      details: 'team=' + teamLabel + '; query="' + query + '"; match_type=' + matchType + '; result_count=' + resultCount
    });
  }
}

function resolveOnboardingCandidates_(query, sheetClient) {
  var onboardingRows = sheetClient.getOnboardingRows();
  var normalizedQuery = normalizeForMatch_(query);
  var querySlackId = parseSlackUserIdFromQuery_(query);
  var exact = [];

  for (var i = 0; i < onboardingRows.length; i += 1) {
    var row = onboardingRows[i];
    var employeeName = String(row[1] || '').trim();
    var rowSlackId = String(row[2] || '').trim().toUpperCase();

    if (querySlackId && rowSlackId && rowSlackId === querySlackId) {
      exact.push(buildCandidateFromOnboardingRow_(row));
      continue;
    }

    if (!employeeName) {
      continue;
    }
    if (normalizeForMatch_(employeeName) === normalizedQuery) {
      exact.push(buildCandidateFromOnboardingRow_(row));
    }
  }

  if (exact.length > 0) {
    return {
      matchType: 'exact',
      candidates: exact.slice(0, MAX_DISAMBIGUATION_RESULTS)
    };
  }

  var fuzzy = [];
  for (var j = 0; j < onboardingRows.length; j += 1) {
    var onboardingRow = onboardingRows[j];
    var name = String(onboardingRow[1] || '').trim();
    if (!name) {
      continue;
    }
    var score = scoreFuzzyNameMatch_(query, name);
    if (score > 0) {
      var candidate = buildCandidateFromOnboardingRow_(onboardingRow);
      candidate.matchScore = score;
      fuzzy.push(candidate);
    }
  }

  fuzzy.sort(function (a, b) {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return String(a.employeeName).localeCompare(String(b.employeeName));
  });

  return {
    matchType: 'fuzzy',
    candidates: fuzzy.slice(0, MAX_DISAMBIGUATION_RESULTS)
  };
}

function buildCandidateFromOnboardingRow_(row) {
  return {
    onboardingId: String(row[0] || ''),
    employeeName: String(row[1] || ''),
    slackId: String(row[2] || ''),
    status: String(row[13] || ''),
    startDate: row[6],
    manager: String(row[8] || 'Unknown'),
    buddy: String(row[10] || row[11] || 'Unassigned')
  };
}

function buildPhaseSnapshot_(onboardingId, checklistRows) {
  var phases = {};
  var ownerTeams = {};
  var dueItems = [];
  var totalTasks = 0;
  var completedTasks = 0;

  for (var i = 0; i < checklistRows.length; i += 1) {
    var row = checklistRows[i];
    if (String(row[1] || '') !== String(onboardingId || '')) {
      continue;
    }

    var phase = String(row[2] || 'Unassigned');
    var taskName = String(row[3] || 'Unnamed task');
    var ownerTeam = String(row[4] || 'General');
    var status = String(row[6] || '').trim().toUpperCase();
    var dueDate = row[7];
    var isComplete = status === 'COMPLETE' || status === 'DONE';

    if (!phases[phase]) {
      phases[phase] = { total: 0, done: 0 };
    }
    if (!ownerTeams[ownerTeam]) {
      ownerTeams[ownerTeam] = { total: 0, done: 0 };
    }

    phases[phase].total += 1;
    ownerTeams[ownerTeam].total += 1;
    totalTasks += 1;

    if (isComplete) {
      phases[phase].done += 1;
      ownerTeams[ownerTeam].done += 1;
      completedTasks += 1;
    } else {
      dueItems.push({
        phase: phase,
        owningTeam: ownerTeam,
        taskName: taskName,
        status: status || 'PENDING',
        dueDate: dueDate
      });
    }
  }

  dueItems.sort(function (a, b) {
    return safeDateSort_(a.dueDate) - safeDateSort_(b.dueDate);
  });

  return {
    phases: phases,
    ownerTeams: ownerTeams,
    totalTasks: totalTasks,
    completedTasks: completedTasks,
    dueItems: dueItems.slice(0, MAX_DUE_ITEMS)
  };
}
function formatOnboardingStatusSummary_(candidate, snapshot, teamView) {
  var normalizedTeamView = teamView || TEAM_VIEW_CONFIG.default;
  var phaseKeys = Object.keys(snapshot.phases);
  var phaseSummary = phaseKeys.length > 0
    ? phaseKeys.map(function (phase) {
      var stats = snapshot.phases[phase];
      return phase + ' ' + stats.done + '/' + stats.total;
    }).join(' | ')
    : 'No checklist tasks found';

  var teamPriorityDueItems = prioritizeDueItemsForTeam_(snapshot.dueItems, normalizedTeamView.focusTeams);
  var completionPercent = snapshot.totalTasks > 0
    ? Math.round((snapshot.completedTasks / snapshot.totalTasks) * 100)
    : 0;
  var teamProgressSummary = Object.keys(snapshot.ownerTeams || {}).length > 0
    ? Object.keys(snapshot.ownerTeams).sort().map(function (teamName) {
      var stats = snapshot.ownerTeams[teamName];
      return teamName + ' ' + stats.done + '/' + stats.total;
    }).join(' | ')
    : 'No owner team checklist tasks found';

  var dueSummary = teamPriorityDueItems.length > 0
    ? teamPriorityDueItems.map(function (item) {
      return '- [' + item.owningTeam + '] ' + item.phase + ': ' + item.taskName + ' (' + item.status + ', due ' + formatDateForDisplay_(item.dueDate) + ')';
    }).join('\n')
    : '- No open due items';

  return [
    '*Onboarding status: ' + candidate.employeeName + '*',
    '• Team view: ' + normalizedTeamView.label,
    '• Onboarding ID: ' + (candidate.onboardingId || 'Unknown'),
    '• Status: ' + (candidate.status || 'Unknown'),
    '• Manager: ' + candidate.manager,
    '• Buddy: ' + candidate.buddy,
    '• Checklist progress: ' + snapshot.completedTasks + '/' + snapshot.totalTasks + ' (' + completionPercent + '%)',
    '• Owner teams: ' + teamProgressSummary,
    '• Phase completion: ' + phaseSummary,
    '• Key due items:\n' + dueSummary,
    '',
    '_Slack is read-only for onboarding status. Edit records in Google Sheets._'
  ].join('\n');
}

function prioritizeDueItemsForTeam_(dueItems, focusTeams) {
  var focusLookup = {};
  for (var i = 0; i < focusTeams.length; i += 1) {
    focusLookup[String(focusTeams[i]).toUpperCase()] = true;
  }

  return dueItems
    .slice()
    .sort(function (a, b) {
      var aFocused = focusLookup[String(a.owningTeam || '').toUpperCase()] ? 1 : 0;
      var bFocused = focusLookup[String(b.owningTeam || '').toUpperCase()] ? 1 : 0;
      if (aFocused !== bFocused) {
        return bFocused - aFocused;
      }
      return safeDateSort_(a.dueDate) - safeDateSort_(b.dueDate);
    })
    .slice(0, MAX_DUE_ITEMS);
}

function postTeamTransparencyUpdate_(teamView, candidate, summaryText, slackClient) {
  if (!slackClient || typeof slackClient.postMessage !== 'function') {
    return;
  }

  try {
    var getterName = teamView.channelGetterName;
    if (!Config || typeof Config[getterName] !== 'function') {
      return;
    }
    var teamChannelId = Config[getterName]();
    slackClient.postMessage(teamChannelId, [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Transparency update requested by command user*\n' + summaryText
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Onboarding ID: ' + (candidate.onboardingId || 'Unknown')
          }
        ]
      }
    ]);
  } catch (err) {
    // Keep slash command response successful even if optional transparency post fails.
  }
}

function formatDisambiguationMessage_(query, candidates) {
  var lines = [
    'Multiple matches found for "' + query + '". Please refine your search:',
    ''
  ];

  for (var i = 0; i < candidates.length; i += 1) {
    var candidate = candidates[i];
    lines.push((i + 1) + '. ' + candidate.employeeName + ' — ' + candidate.onboardingId + ' (' + (candidate.status || 'Unknown') + ', start ' + formatDateForDisplay_(candidate.startDate) + ')');
  }

  return lines.join('\n');
}

function scoreFuzzyNameMatch_(query, candidateName) {
  var normalizedQuery = normalizeForMatch_(query);
  var normalizedCandidate = normalizeForMatch_(candidateName);
  if (!normalizedQuery || !normalizedCandidate) {
    return 0;
  }
  if (normalizedQuery === normalizedCandidate) {
    return 100;
  }
  if (normalizedCandidate.indexOf(normalizedQuery) > -1) {
    return 80;
  }

  var queryTokens = normalizedQuery.split(' ');
  var candidateTokens = normalizedCandidate.split(' ');
  var overlap = 0;

  for (var i = 0; i < queryTokens.length; i += 1) {
    for (var j = 0; j < candidateTokens.length; j += 1) {
      if (candidateTokens[j].indexOf(queryTokens[i]) === 0 || queryTokens[i].indexOf(candidateTokens[j]) === 0) {
        overlap += 1;
        break;
      }
    }
  }

  if (overlap === 0) {
    return 0;
  }

  return Math.round((overlap / queryTokens.length) * 60);
}

function normalizeForMatch_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function formatDateForDisplay_(value) {
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) {
    return 'n/a';
  }
  return date.toISOString().slice(0, 10);
}

function safeDateSort_(value) {
  var date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) {
    return Number.MAX_SAFE_INTEGER;
  }
  return date.getTime();
}

function toSlackTextOutput_(responsePayload) {
  var normalized = formatCommandOutput_(responsePayload);
  if (typeof ContentService === 'undefined' || !ContentService.createTextOutput) {
    return normalized;
  }
  return ContentService
    .createTextOutput(JSON.stringify(normalized))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatCommandOutput_(responsePayload) {
  var payload = responsePayload || {};
  return {
    response_type: String(payload.response_type || payload.responseType || 'ephemeral'),
    text: String(payload.text || '')
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    doPost: doPost,
    routeSlackCommand_: routeSlackCommand_,
    handleOnboardingStatusCommand_: handleOnboardingStatusCommand_,
    parseStatusCommandInput_: parseStatusCommandInput_,
    performOnboardingStatusLookup_: performOnboardingStatusLookup_,
    resolveOnboardingCandidates_: resolveOnboardingCandidates_,
    buildPhaseSnapshot_: buildPhaseSnapshot_,
    formatOnboardingStatusSummary_: formatOnboardingStatusSummary_,
    prioritizeDueItemsForTeam_: prioritizeDueItemsForTeam_,
    formatDisambiguationMessage_: formatDisambiguationMessage_,
    scoreFuzzyNameMatch_: scoreFuzzyNameMatch_,
    normalizeForMatch_: normalizeForMatch_,
    logOnboardingStatusRead_: logOnboardingStatusRead_,
    parseSlackPayloadEnvelope_: parseSlackPayloadEnvelope_,
    handleSlackInteractivePayload_: handleSlackInteractivePayload_,
    parseSlackUserIdFromQuery_: parseSlackUserIdFromQuery_,
    detectWriteIntent_: detectWriteIntent_,
    formatCommandOutput_: formatCommandOutput_,
    READ_ONLY_COMMANDS: READ_ONLY_COMMANDS
  };
}
