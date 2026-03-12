/* global SheetClient, AuditLogger, ContentService, SlackClient, Config */
/**
 * @fileoverview Slack slash command handlers for read-only onboarding lookups.
 */

var COMMAND_NAME_ONBOARDING_STATUS = '/onboarding-status';
var COMMAND_NAME_IT_STATUS = '/it-onboarding-status';
var COMMAND_NAME_FINANCE_STATUS = '/finance-onboarding-status';
var COMMAND_NAME_HR_STATUS = '/hr-onboarding-status';
var COMMAND_NAME_CHECKLIST_STATUS = '/checklist-status';
var COMMAND_NAME_CHECKLIST_PROGRESS = '/checklist-progress';
var MAX_DISAMBIGUATION_RESULTS = 5;
var MAX_DUE_ITEMS = 3;

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
  if (commandName === COMMAND_NAME_ONBOARDING_STATUS || commandName === COMMAND_NAME_CHECKLIST_STATUS || commandName === COMMAND_NAME_CHECKLIST_PROGRESS) {
    return handleOnboardingStatusCommand_(payload, 'default', new SheetClient(), new AuditLogger(), new SlackClient());
  }
  if (commandName === COMMAND_NAME_IT_STATUS) {
    return handleOnboardingStatusCommand_(payload, 'it', new SheetClient(), new AuditLogger(), new SlackClient());
  }
  if (commandName === COMMAND_NAME_FINANCE_STATUS) {
    return handleOnboardingStatusCommand_(payload, 'finance', new SheetClient(), new AuditLogger(), new SlackClient());
  }
  if (commandName === COMMAND_NAME_HR_STATUS) {
    return handleOnboardingStatusCommand_(payload, 'hr', new SheetClient(), new AuditLogger(), new SlackClient());
  }

  return {
    response_type: 'ephemeral',
    text: 'Unsupported slash command: ' + (commandName || '(empty)')
  };
}

function handleOnboardingStatusCommand_(payload, teamViewKey, sheetClient, auditLogger, slackClient) {
  var parsedInput = parseStatusCommandInput_(payload.text || '');
  var query = parsedInput.query;
  var shareToTeamChannel = parsedInput.shareToTeamChannel;
  var actor = String(payload.user_name || payload.user_id || 'unknown');
  var teamView = TEAM_VIEW_CONFIG[teamViewKey] || TEAM_VIEW_CONFIG.default;

  if (!query) {
    logOnboardingStatusRead_(auditLogger, actor, query, teamView.label, 'invalid_query', 0);
    return {
      response_type: 'ephemeral',
      text: 'Usage: /onboarding-status <new hire name>\nExample: /onboarding-status Amelia Thompson'
    };
  }

  var lookupResult = performOnboardingStatusLookup_(query, sheetClient);
  logOnboardingStatusRead_(auditLogger, actor, query, teamView.label, lookupResult.matchType, lookupResult.candidates.length);

  if (lookupResult.candidates.length === 0) {
    return {
      response_type: 'ephemeral',
      text: 'No onboarding records found for "' + query + '".'
    };
  }

  if (lookupResult.candidates.length > 1) {
    return {
      response_type: 'ephemeral',
      text: formatDisambiguationMessage_(query, lookupResult.candidates)
    };
  }

  var candidate = lookupResult.candidates[0];
  var snapshot = lookupResult.snapshot;
  var summaryText = formatOnboardingStatusSummary_(candidate, snapshot, teamView);

  if (shareToTeamChannel) {
    postTeamTransparencyUpdate_(teamView, candidate, summaryText, slackClient);
  }

  return {
    response_type: 'ephemeral',
    text: summaryText
  };
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

function logOnboardingStatusRead_(auditLogger, actor, query, teamLabel, matchType, resultCount) {
  if (!auditLogger || typeof auditLogger.log !== 'function') {
    return;
  }
  auditLogger.log({
    actorEmail: actor,
    entityType: 'OnboardingCommand',
    entityId: COMMAND_NAME_ONBOARDING_STATUS,
    action: 'READ',
    details: 'team=' + teamLabel + '; query="' + query + '"; match_type=' + matchType + '; result_count=' + resultCount
  });
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
  if (typeof ContentService === 'undefined' || !ContentService.createTextOutput) {
    return responsePayload;
  }
  return ContentService
    .createTextOutput(JSON.stringify(responsePayload))
    .setMimeType(ContentService.MimeType.JSON);
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
    parseSlackUserIdFromQuery_: parseSlackUserIdFromQuery_
  };
}
