/* global SheetClient, SlackClient, SubmissionController, GeminiService, ApprovalController, ContentService, verifySlackIngressRequest_, sanitizeTextForLog, sanitizePayloadForLog */
/** @fileoverview Ingress parsing and command routing for slash commands. */

var CommandSecurityBindings_ = null;
if (typeof module !== 'undefined') CommandSecurityBindings_ = require('./SecurityUtils.gs');

function verifySlackRequestForCommands_(event) {
  if (typeof verifySlackIngressRequest_ === 'function') return verifySlackIngressRequest_(event, { route: 'commands' });
  return CommandSecurityBindings_.verifySlackIngressRequest_(event, { route: 'commands' });
}
function sanitizeForCommandLog_(value) { if (typeof sanitizeTextForLog === 'function') return sanitizeTextForLog(value); return CommandSecurityBindings_ && CommandSecurityBindings_.sanitizeTextForLog ? CommandSecurityBindings_.sanitizeTextForLog(value) : String(value || ''); }
function sanitizePayloadForCommandLog_(payload) { if (typeof sanitizePayloadForLog === 'function') return sanitizePayloadForLog(payload); return CommandSecurityBindings_ && CommandSecurityBindings_.sanitizePayloadForLog ? CommandSecurityBindings_.sanitizePayloadForLog(payload) : payload; }

function extractSlackJsonBodyForChallenge_(event) { var raw = event && event.postData && event.postData.contents; if (!raw) return null; try { var parsed = JSON.parse(raw); return parsed && parsed.type === 'url_verification' ? parsed : null; } catch (e) { return null; } }
function parseSlackPayloadEnvelope_(envelope) { if (!envelope || !envelope.payload) return envelope || {}; try { return JSON.parse(envelope.payload); } catch (e) { return { directResponse: { response_type: 'ephemeral', text: 'Unable to parse Slack payload.' } }; } }
function handleSlackInteractivePayload_() { return { response_type: 'ephemeral', text: 'Slack interactions are read-only in this workflow. To edit onboarding or checklist statuses, use Google Sheets.' }; }
function detectWriteIntent_(rawText, policy) { var normalized = policy.normalizeForMatch_(rawText); var verbs = ['update', 'set', 'change', 'edit', 'complete', 'reopen', 'close', 'approve', 'reject', 'delete', 'create', 'add']; for (var i = 0; i < verbs.length; i += 1) if (normalized.indexOf(verbs[i] + ' ') === 0 || normalized.indexOf(' ' + verbs[i] + ' ') > -1) return { isWriteLikeIntent: true, intent: verbs[i] }; return { isWriteLikeIntent: false, intent: '' }; }

function routeWriteIntentToProposal_(payload, actor, writeIntent) {
  if (typeof SubmissionController === 'undefined' || !SubmissionController) return formatCommandOutput_({ responseType: 'ephemeral', text: 'Write-like requests are blocked in Slack commands.' });
  var proposalInput = { actor: actor, source: 'slack_command', action: writeIntent.intent, request_id: String(payload.trigger_id || payload.command_ts || ''), trace_id: String(payload.trigger_id || payload.command_ts || ''), command: String(payload.command || ''), text: String(payload.text || ''), intent: writeIntent.intent, payload: payload, approval_status: 'PENDING', entity_type: 'slack_command', entity_key: String(payload.command || '') + ':' + writeIntent.intent };
  var proposal = SubmissionController.persistIngressDraft ? SubmissionController.persistIngressDraft(proposalInput) : (SubmissionController.createDraft ? SubmissionController.createDraft(proposalInput) : SubmissionController.createProposal(proposalInput));
  if (!proposal) return formatCommandOutput_({ responseType: 'ephemeral', text: 'Submission proposals are unavailable; use Google Sheets.' });
  var clarification = (typeof GeminiService !== 'undefined' && GeminiService && GeminiService.validateAndClarify) ? GeminiService.validateAndClarify(proposal) : null;
  if (clarification && clarification.status === 'rejected') return formatCommandOutput_({ responseType: 'ephemeral', text: 'Captured proposal ' + proposal.id + ' but Gemini rejected it.' });
  if (typeof ApprovalController !== 'undefined' && ApprovalController) {
    if (proposal.requires_approval && ApprovalController.requestLiamApproval) ApprovalController.requestLiamApproval({ proposal: proposal, clarification: clarification, approval_status: 'PENDING' });
    else if (ApprovalController.requestApproval) ApprovalController.requestApproval({ proposal: proposal, clarification: clarification, approval_status: 'PENDING' });
  }
  return formatCommandOutput_({ responseType: 'ephemeral', text: 'Captured your request as a proposal' + (proposal.id ? ' (' + proposal.id + ')' : '') + '.' });
}

function handleOnboardingStatusCommand_(payload, teamViewKey, sheetClient, auditService, slackClient, policy, persistence) {
  var parsed = policy.parseStatusCommandInput_(payload.text || ''); var query = parsed.query; var actor = String(payload.user_name || payload.user_id || 'unknown'); var teamView = policy.TEAM_VIEW_CONFIG[teamViewKey] || policy.TEAM_VIEW_CONFIG.default;
  if (!query) { persistence.logOnboardingStatusRead_(auditService, actor, query, teamView.label, 'invalid_query', 0, payload.command || ''); return formatCommandOutput_({ responseType: 'ephemeral', text: 'Usage: /onboarding-status <new hire name>' }); }
  var lookupResult = persistence.performOnboardingStatusLookup_(query, sheetClient, policy);
  persistence.logOnboardingStatusRead_(auditService, actor, query, teamView.label, lookupResult.matchType, lookupResult.candidates.length, payload.command || '');
  if (lookupResult.candidates.length === 0) return formatCommandOutput_({ responseType: 'ephemeral', text: 'No onboarding records found for "' + query + '".' });
  if (lookupResult.candidates.length > 1) return formatCommandOutput_({ responseType: 'ephemeral', text: policy.formatDisambiguationMessage_(query, lookupResult.candidates) });
  var candidate = lookupResult.candidates[0]; var summaryText = policy.formatOnboardingStatusSummary_(candidate, lookupResult.snapshot, teamView);
  if (parsed.shareToTeamChannel) persistence.postTeamTransparencyUpdate_(teamView, candidate, summaryText, slackClient);
  return formatCommandOutput_({ responseType: 'ephemeral', text: summaryText });
}

function routeSlackCommand_(payload, policy, persistence) {
  var commandName = String(payload.command || '').trim(); var actor = String(payload.user_name || payload.user_id || 'unknown'); var writeIntent = detectWriteIntent_(payload.text || '', policy);
  if (writeIntent.isWriteLikeIntent) return routeWriteIntentToProposal_(payload, actor, writeIntent);
  if (policy.READ_ONLY_COMMANDS.indexOf(commandName) === -1) { console.info('Unsupported Slack command payload=' + JSON.stringify(sanitizePayloadForCommandLog_({ command: commandName, user_name: payload.user_name }))); return formatCommandOutput_({ responseType: 'ephemeral', text: 'Unsupported slash command: ' + (commandName || '(empty)') }); }
  var team = commandName === policy.COMMAND_NAME_IT_STATUS ? 'it' : (commandName === policy.COMMAND_NAME_FINANCE_STATUS ? 'finance' : (commandName === policy.COMMAND_NAME_HR_STATUS ? 'hr' : 'default'));
  var client = new SheetClient();
  return handleOnboardingStatusCommand_(payload, team, client, persistence.createCommandAuditService_(client), new SlackClient(), policy, persistence);
}

function formatCommandOutput_(responsePayload) { var payload = responsePayload || {}; return { response_type: String(payload.response_type || payload.responseType || 'ephemeral'), text: String(payload.text || '') }; }
function toSlackTextOutput_(responsePayload) { var normalized = formatCommandOutput_(responsePayload); if (typeof ContentService === 'undefined' || !ContentService.createTextOutput) return normalized; return ContentService.createTextOutput(JSON.stringify(normalized)).setMimeType(ContentService.MimeType.JSON); }
function toSlackChallengeOutput_(payload) { var challenge = String((payload && payload.challenge) || ''); if (typeof ContentService === 'undefined' || !ContentService.createTextOutput) return challenge; return ContentService.createTextOutput(challenge); }

function handleCommandsPost_(e, policy, persistence) {
  var preflightPayload = extractSlackJsonBodyForChallenge_(e); if (preflightPayload && preflightPayload.type === 'url_verification') return toSlackChallengeOutput_(preflightPayload);
  var verification = verifySlackRequestForCommands_(e); if (!verification.ok) { console.warn('Slack ingress rejected: ' + sanitizeForCommandLog_(verification.errorCode + ' ' + verification.reason)); return toSlackTextOutput_({ ok: false, code: verification.errorCode, response_type: 'ephemeral', text: 'Unauthorized Slack request (' + verification.errorCode + ').' }); }
  var payload = verification.parsedPayload || {};
  var response = payload && payload.directResponse ? payload.directResponse : (payload && payload.type ? handleSlackInteractivePayload_(payload) : routeSlackCommand_(payload, policy, persistence));
  return toSlackTextOutput_(response);
}

if (typeof module !== 'undefined') module.exports = { handleCommandsPost_: handleCommandsPost_, routeSlackCommand_: routeSlackCommand_, handleOnboardingStatusCommand_: handleOnboardingStatusCommand_, extractSlackJsonBodyForChallenge_: extractSlackJsonBodyForChallenge_, parseSlackPayloadEnvelope_: parseSlackPayloadEnvelope_, handleSlackInteractivePayload_: handleSlackInteractivePayload_, detectWriteIntent_: detectWriteIntent_, formatCommandOutput_: formatCommandOutput_, toSlackChallengeOutput_: toSlackChallengeOutput_ };
