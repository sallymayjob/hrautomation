/* global SheetClient, AuditLogger, ContentService */
/**
 * @fileoverview Slack slash command handlers for read-only onboarding lookups.
 */

var COMMAND_NAME_ONBOARDING_STATUS = '/onboarding-status';
var MAX_DISAMBIGUATION_RESULTS = 5;
var MAX_DUE_ITEMS = 3;

function doPost(e) {
  var payload = (e && e.parameter) || {};
  var response = routeSlackCommand_(payload);
  return toSlackTextOutput_(response);
}

function routeSlackCommand_(payload) {
  var commandName = String(payload.command || '').trim();
  if (commandName === COMMAND_NAME_ONBOARDING_STATUS) {
    return handleOnboardingStatusCommand_(payload, new SheetClient(), new AuditLogger());
  }

  return {
    response_type: 'ephemeral',
    text: 'Unsupported slash command: ' + (commandName || '(empty)')
  };
}

function handleOnboardingStatusCommand_(payload, sheetClient, auditLogger) {
  var query = String(payload.text || '').trim();
  var actor = String(payload.user_name || payload.user_id || 'unknown');

  if (!query) {
    logOnboardingStatusRead_(auditLogger, actor, query, 'invalid_query', 0);
    return {
      response_type: 'ephemeral',
      text: 'Usage: /onboarding-status <new hire name>\nExample: /onboarding-status Amelia Thompson'
    };
  }

  var resolution = resolveOnboardingCandidates_(query, sheetClient);
  logOnboardingStatusRead_(auditLogger, actor, query, resolution.matchType, resolution.candidates.length);

  if (resolution.candidates.length === 0) {
    return {
      response_type: 'ephemeral',
      text: 'No onboarding records found for "' + query + '".'
    };
  }

  if (resolution.candidates.length > 1) {
    return {
      response_type: 'ephemeral',
      text: formatDisambiguationMessage_(query, resolution.candidates)
    };
  }

  var candidate = resolution.candidates[0];
  var checklistRows = sheetClient.getChecklistRows();
  var snapshot = buildPhaseSnapshot_(candidate.onboardingId, checklistRows);

  return {
    response_type: 'ephemeral',
    text: formatOnboardingStatusSummary_(candidate, snapshot)
  };
}

function logOnboardingStatusRead_(auditLogger, actor, query, matchType, resultCount) {
  if (!auditLogger || typeof auditLogger.log !== 'function') {
    return;
  }
  auditLogger.log({
    actorEmail: actor,
    entityType: 'OnboardingCommand',
    entityId: COMMAND_NAME_ONBOARDING_STATUS,
    action: 'READ',
    details: 'query="' + query + '"; match_type=' + matchType + '; result_count=' + resultCount
  });
}

function resolveOnboardingCandidates_(query, sheetClient) {
  var onboardingRows = sheetClient.getOnboardingRows();
  var normalizedQuery = normalizeForMatch_(query);
  var exact = [];

  for (var i = 0; i < onboardingRows.length; i += 1) {
    var row = onboardingRows[i];
    var employeeName = String(row[1] || '').trim();
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
    status: String(row[13] || ''),
    startDate: row[6],
    manager: String(row[8] || 'Unknown'),
    buddy: String(row[10] || row[11] || 'Unassigned')
  };
}

function buildPhaseSnapshot_(onboardingId, checklistRows) {
  var phases = {};
  var dueItems = [];

  for (var i = 0; i < checklistRows.length; i += 1) {
    var row = checklistRows[i];
    if (String(row[1] || '') !== String(onboardingId || '')) {
      continue;
    }

    var phase = String(row[2] || 'Unassigned');
    var taskName = String(row[3] || 'Unnamed task');
    var status = String(row[6] || '').trim().toUpperCase();
    var dueDate = row[7];
    var isComplete = status === 'COMPLETE' || status === 'DONE';

    if (!phases[phase]) {
      phases[phase] = { total: 0, done: 0 };
    }
    phases[phase].total += 1;
    if (isComplete) {
      phases[phase].done += 1;
    } else {
      dueItems.push({
        phase: phase,
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
    dueItems: dueItems.slice(0, MAX_DUE_ITEMS)
  };
}

function formatOnboardingStatusSummary_(candidate, snapshot) {
  var phaseKeys = Object.keys(snapshot.phases);
  var phaseSummary = phaseKeys.length > 0
    ? phaseKeys.map(function (phase) {
      var stats = snapshot.phases[phase];
      return phase + ' ' + stats.done + '/' + stats.total;
    }).join(' | ')
    : 'No checklist tasks found';

  var dueSummary = snapshot.dueItems.length > 0
    ? snapshot.dueItems.map(function (item) {
      return '- ' + item.phase + ': ' + item.taskName + ' (' + item.status + ', due ' + formatDateForDisplay_(item.dueDate) + ')';
    }).join('\n')
    : '- No open due items';

  return [
    '*Onboarding status: ' + candidate.employeeName + '*',
    '• Onboarding ID: ' + (candidate.onboardingId || 'Unknown'),
    '• Status: ' + (candidate.status || 'Unknown'),
    '• Manager: ' + candidate.manager,
    '• Buddy: ' + candidate.buddy,
    '• Phase completion: ' + phaseSummary,
    '• Key due items:\n' + dueSummary
  ].join('\n');
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
    resolveOnboardingCandidates_: resolveOnboardingCandidates_,
    buildPhaseSnapshot_: buildPhaseSnapshot_,
    formatOnboardingStatusSummary_: formatOnboardingStatusSummary_,
    formatDisambiguationMessage_: formatDisambiguationMessage_,
    scoreFuzzyNameMatch_: scoreFuzzyNameMatch_,
    normalizeForMatch_: normalizeForMatch_,
    logOnboardingStatusRead_: logOnboardingStatusRead_
  };
}
