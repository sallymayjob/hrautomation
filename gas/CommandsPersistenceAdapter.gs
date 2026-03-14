/* global AuditService, Config */
/** @fileoverview Persistence adapters for command audit + sheet lookups. */

function createCommandAuditService_(sheetClient) {
  if (typeof AuditService !== 'undefined' && AuditService) return new AuditService(sheetClient);
  return { logEvent: function (payload) { if (!sheetClient || typeof sheetClient.appendAuditRow !== 'function') return; sheetClient.appendAuditRow(['', new Date(), payload.actorEmail || 'system', payload.entityType || 'System', payload.entityId || '', payload.action || 'UPDATE', payload.details || '', '']); } };
}

function performOnboardingStatusLookup_(query, sheetClient, policy) {
  var resolution = policy.resolveOnboardingCandidates_(query, sheetClient.getOnboardingRows());
  if (resolution.candidates.length !== 1) return { matchType: resolution.matchType, candidates: resolution.candidates, snapshot: null };
  return { matchType: resolution.matchType, candidates: resolution.candidates, snapshot: policy.buildPhaseSnapshot_(resolution.candidates[0].onboardingId, sheetClient.getChecklistRows()) };
}

function logOnboardingStatusRead_(auditService, actor, query, teamLabel, matchType, resultCount, commandName) {
  if (!auditService) return;
  var payload = { actorEmail: actor, entityType: 'OnboardingCommand', entityId: commandName, action: 'READ', details: 'team=' + teamLabel + '; query="' + query + '"; match_type=' + matchType + '; result_count=' + resultCount };
  if (typeof auditService.logEvent === 'function') { auditService.logEvent(payload); return; }
  if (typeof auditService.log === 'function') auditService.log(payload);
}

function postTeamTransparencyUpdate_(teamView, candidate, summaryText, slackClient) {
  if (!slackClient || typeof slackClient.postMessage !== 'function') return;
  try {
    var getterName = teamView.channelGetterName;
    if (!Config || typeof Config[getterName] !== 'function') return;
    slackClient.postMessage(Config[getterName](), [{ type: 'section', text: { type: 'mrkdwn', text: '*Transparency update requested by command user*\n' + summaryText } }]);
  } catch (err) {}
}

if (typeof module !== 'undefined') module.exports = { createCommandAuditService_: createCommandAuditService_, performOnboardingStatusLookup_: performOnboardingStatusLookup_, logOnboardingStatusRead_: logOnboardingStatusRead_, postTeamTransparencyUpdate_: postTeamTransparencyUpdate_ };
