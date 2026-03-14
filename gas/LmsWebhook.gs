/* global ContentService, AuditService, SheetClient, Utilities, Config, verifySlackIngressRequest_, sanitizeTextForLog, parseSlackIngressEnvelope_, verifySlackIngressWithHooks_, guardLmsHandshakeShape_, sanitizeSlackIngressLogText_ */
/**
 * @fileoverview LMS webhook entrypoint for Slack Workflow Builder initiated handshakes.
 */

var LMS_HANDSHAKE_SOURCE = 'slack_workflow_builder';

var LmsSecurityBindings_ = null;
var LmsIngressBindings_ = null;
if (typeof module !== 'undefined') {
  LmsSecurityBindings_ = require('./SecurityUtils.gs');
  LmsIngressBindings_ = require('./SlackIngress.gs');
}

function verifySlackRequestForLms_(event) {
  if (typeof verifySlackIngressWithHooks_ === 'function') {
    return verifySlackIngressWithHooks_(event, { route: 'lms' });
  }
  if (LmsIngressBindings_ && typeof LmsIngressBindings_.verifySlackIngressWithHooks_ === 'function') {
    return LmsIngressBindings_.verifySlackIngressWithHooks_(event, { route: 'lms' });
  }
  if (typeof verifySlackIngressRequest_ === 'function') {
    return verifySlackIngressRequest_(event, { route: 'lms' });
  }
  return LmsSecurityBindings_.verifySlackIngressRequest_(event, { route: 'lms' });
}

function sanitizeForLmsLog_(value) {
  if (typeof sanitizeSlackIngressLogText_ === 'function') return sanitizeSlackIngressLogText_(value);
  return LmsIngressBindings_ && LmsIngressBindings_.sanitizeSlackIngressLogText_
    ? LmsIngressBindings_.sanitizeSlackIngressLogText_(value)
    : (typeof sanitizeTextForLog === 'function' ? sanitizeTextForLog(value) : String(value || ''));
}

var LMS_ACTIONS = {
  CREATE_COURSE: 'create_course',
  UPDATE_COURSE: 'update_course',
  ARCHIVE_COURSE: 'archive_course',
  ENROLL_SINGLE: 'enroll_single',
  BULK_ENROLL: 'bulk_enroll',
  UNENROLL_SINGLE: 'unenroll_single',
  BULK_UNENROLL: 'bulk_unenroll',
  ASSIGN_COHORT: 'assign_cohort',
  MARK_COMPLETION: 'mark_completion',
  LESSON_CREATE: (typeof Config !== 'undefined' && Config && Config.GOVERNED_ACTION_TYPES ? Config.GOVERNED_ACTION_TYPES.LESSON_CREATE : 'lesson_create'),
  LESSON_EDIT: (typeof Config !== 'undefined' && Config && Config.GOVERNED_ACTION_TYPES ? Config.GOVERNED_ACTION_TYPES.LESSON_EDIT : 'lesson_edit'),
  LESSON_OVERWRITE: (typeof Config !== 'undefined' && Config && Config.GOVERNED_ACTION_TYPES ? Config.GOVERNED_ACTION_TYPES.LESSON_OVERWRITE : 'lesson_overwrite'),
  LESSON_VERSION: (typeof Config !== 'undefined' && Config && Config.GOVERNED_ACTION_TYPES ? Config.GOVERNED_ACTION_TYPES.LESSON_VERSION : 'lesson_version'),
  LESSON_MAPPING_CHANGE: (typeof Config !== 'undefined' && Config && Config.GOVERNED_ACTION_TYPES ? Config.GOVERNED_ACTION_TYPES.LESSON_MAPPING_CHANGE : 'lesson_mapping_change')
};

function doPostLms(e) {
  var parsedIngress = (typeof parseSlackIngressEnvelope_ === 'function')
    ? parseSlackIngressEnvelope_(e)
    : (LmsIngressBindings_ ? LmsIngressBindings_.parseSlackIngressEnvelope_(e) : { payload: parseLmsEnvelope_(e) });

  var verification = verifySlackRequestForLms_(e);
  if (!verification.ok) {
    console.warn('LMS ingress rejected: ' + sanitizeForLmsLog_(verification.errorCode + ' ' + verification.reason));
    return toLmsJsonOutput_({
      ok: false,
      code: verification.errorCode,
      message: verification.reason,
      status: verification.httpStatus
    });
  }

  var payload = verification.parsedPayload || (parsedIngress && parsedIngress.payload) || parseLmsEnvelope_(e);
  var validation = validateLmsHandshake_(payload);

  if (!validation.ok) {
    return toLmsJsonOutput_({
      ok: false,
      code: validation.code,
      message: validation.message
    });
  }

  return toLmsJsonOutput_(routeLmsAction_(payload));
}

function parseLmsEnvelope_(e) {
  var parsed = (typeof parseSlackIngressEnvelope_ === 'function')
    ? parseSlackIngressEnvelope_(e)
    : (LmsIngressBindings_ ? LmsIngressBindings_.parseSlackIngressEnvelope_(e) : { payload: (e && e.parameter) || {}, parseError: '' });

  if (parsed.parseError && parsed.rawBody) {
    return {
      parse_error: 'INVALID_JSON',
      raw_payload: String(parsed.rawBody || '')
    };
  }

  return parsed.payload || {};
}

function validateLmsHandshake_(payload) {
  if (!payload || payload.parse_error) {
    return {
      ok: false,
      code: 'INVALID_PAYLOAD',
      message: 'Unable to parse payload from Slack Workflow Builder.'
    };
  }

  var handshakeSource = String((payload.handshake && payload.handshake.source) || payload.source || '').trim().toLowerCase();
  if (handshakeSource !== LMS_HANDSHAKE_SOURCE) {
    return {
      ok: false,
      code: 'INVALID_HANDSHAKE_SOURCE',
      message: 'All LMS handshakes must be initiated by Slack Workflow Builder.'
    };
  }

  var hasActionShape = (typeof guardLmsHandshakeShape_ === 'function')
    ? guardLmsHandshakeShape_(payload)
    : (LmsIngressBindings_ && LmsIngressBindings_.guardLmsHandshakeShape_
      ? LmsIngressBindings_.guardLmsHandshakeShape_(payload)
      : Boolean(payload && payload.action));

  if (!hasActionShape) {
    return {
      ok: false,
      code: 'MISSING_ACTION',
      message: 'Missing LMS action in request payload.'
    };
  }

  return { ok: true };
}

function routeLmsAction_(payload) {
  var action = String(payload.action || '').trim().toLowerCase();
  if (!isSupportedLmsAction_(action)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_ACTION',
      message: 'Unsupported LMS action: ' + action
    };
  }

  try {
    var result = submitLmsProposal_(payload, action);
    writeLmsAuditLog_(payload, action, 'SUCCESS', 'Proposal captured and blocked pending approval.');
    return {
      ok: true,
      action: action,
      data: result || {}
    };
  } catch (err) {
    writeLmsAuditLog_(payload, action, 'ERROR', String(err && err.message ? err.message : err));
    return {
      ok: false,
      code: 'ACTION_FAILED',
      action: action,
      message: String(err && err.message ? err.message : err)
    };
  }
}

function isSupportedLmsAction_(action) {
  var supported = getLmsHandlers_();
  return supported.indexOf(action) > -1;
}

function getLmsHandlers_() {
  return [
    'create_course',
    'update_course',
    'archive_course',
    'enroll_single',
    'bulk_enroll',
    'unenroll_single',
    'bulk_unenroll',
    'assign_cohort',
    'mark_completion',
    LMS_ACTIONS.LESSON_CREATE,
    LMS_ACTIONS.LESSON_EDIT,
    LMS_ACTIONS.LESSON_OVERWRITE,
    LMS_ACTIONS.LESSON_VERSION,
    LMS_ACTIONS.LESSON_MAPPING_CHANGE
  ];
}

function submitLmsProposal_(payload, action) {
  if (typeof SubmissionController === 'undefined' || !SubmissionController) {
    throw new Error('SubmissionController is required for LMS proposal routing.');
  }

  var proposalInput = {
    source: LMS_HANDSHAKE_SOURCE,
    action: action,
    actor: String(payload.actor_slack_id || payload.user_id || 'workflow_builder'),
    request_id: String(payload.request_id || payload.idempotency_key || ''),
    idempotency_key: String(payload.idempotency_key || payload.request_id || payload.trace_id || ''),
    payload: payload,
    approval_status: 'PENDING',
    trace_id: String(payload.trace_id || payload.request_id || payload.idempotency_key || ''),
    entity_type: resolveEntityType_(payload, action),
    entity_key: resolveEntityKey_(payload, action)
  };

  var proposal = null;
  if (typeof SubmissionController.persistIngressDraft === 'function') {
    proposal = SubmissionController.persistIngressDraft(proposalInput, { repository: payload.repository });
  } else if (typeof SubmissionController.createDraft === 'function') {
    proposal = SubmissionController.createDraft(proposalInput);
  } else if (typeof SubmissionController.createProposal === 'function') {
    proposal = SubmissionController.createProposal(proposalInput);
  }

  if (!proposal) {
    throw new Error('SubmissionController must provide createDraft or createProposal.');
  }

  proposal.approval_status = String(proposal.approval_status || 'PENDING').toUpperCase();

  var clarification = null;
  if (isGeminiValidationEnabled_() && typeof GeminiService !== 'undefined' && GeminiService && typeof GeminiService.validateAndClarify === 'function') {
    clarification = GeminiService.validateAndClarify(proposal);
    if (clarification && clarification.status === 'rejected') {
      proposal.approval_status = 'REJECTED';
      return {
        proposal_id: proposal.id || '',
        approval_status: 'REJECTED',
        commit_blocked: true,
        clarification: clarification,
        message: 'Proposal rejected by Gemini validation.'
      };
    }
  }

  if (String(proposal.approval_status || 'PENDING').toUpperCase() === 'PENDING' && typeof ApprovalController !== 'undefined' && ApprovalController) {
    if (proposal.requires_approval && typeof ApprovalController.requestLiamApproval === 'function') {
      ApprovalController.requestLiamApproval({
        proposal: proposal,
        clarification: clarification,
        approval_status: 'PENDING'
      });
    } else if (typeof ApprovalController.requestApproval === 'function') {
      ApprovalController.requestApproval({
        proposal: proposal,
        clarification: clarification,
        approval_status: 'PENDING'
      });
    }
  }

  return {
    proposal_id: proposal.id || '',
    approval_status: String(proposal.approval_status || 'PENDING').toUpperCase(),
    commit_blocked: true,
    message: 'Proposal captured. Governed LMS content updates are blocked until ApprovalController marks this proposal approved.'
  };
}

function resolveEntityType_(payload, action) {
  var explicitType = String((payload && payload.entity_type) || '').trim().toLowerCase();
  if (explicitType) {
    return explicitType;
  }
  var entityNames = (typeof Config !== 'undefined' && Config && Config.ENTITY_NAMES) ? Config.ENTITY_NAMES : { LESSON: 'lesson', LMS_ACTION: 'lms_action' };
  return String(action || '').indexOf('lesson') > -1 ? entityNames.LESSON : entityNames.LMS_ACTION;
}

function resolveEntityKey_(payload, action) {
  var explicitKey = String((payload && payload.entity_key) || '').trim();
  if (explicitKey) {
    return explicitKey;
  }

  var keyParts = [
    payload && (payload.lesson_id || payload.module_code || payload.course_id || payload.request_id || payload.idempotency_key),
    payload && (payload.lesson_version || payload.version || ''),
    String(action || '')
  ];
  var normalized = [];
  for (var i = 0; i < keyParts.length; i += 1) {
    if (String(keyParts[i] || '').trim()) {
      normalized.push(String(keyParts[i]).trim());
    }
  }
  return normalized.join(':');
}


function isGeminiValidationEnabled_() {
  if (typeof Config === 'undefined' || !Config || typeof Config.isGeminiEnabled !== 'function') {
    return true;
  }
  return Config.isGeminiEnabled();
}

function writeLmsAuditLog_(payload, action, status, details) {
  if (typeof AuditService === 'undefined' || typeof SheetClient === 'undefined') {
    return;
  }

  var requestId = String(payload.request_id || payload.idempotency_key || '');
  var traceId = String(payload.trace_id || requestId || '');
  var idempotencyKey = String(payload.idempotency_key || payload.request_id || payload.trace_id || '');
  var actor = String(payload.actor_slack_id || payload.user_id || 'workflow_builder');
  var sheetClient = new SheetClient();
  var auditService = new AuditService(sheetClient);
  if (typeof auditService.logEvent !== 'function') {
    return;
  }

  auditService.logEvent({
    actorEmail: actor,
    entityType: 'LmsWorkflow',
    entityId: requestId || action,
    action: status,
    details: 'action=' + action + '; outcome=' + String(status || '') + '; trace_id=' + traceId + '; idempotency_key=' + idempotencyKey + '; ' + details
  });
}

function toLmsJsonOutput_(payload) {
  if (typeof ContentService === 'undefined' || !ContentService.createTextOutput) {
    return payload;
  }

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

if (typeof module !== 'undefined') {
  module.exports = {
    LMS_HANDSHAKE_SOURCE: LMS_HANDSHAKE_SOURCE,
    LMS_ACTIONS: LMS_ACTIONS,
    doPostLms: doPostLms,
    parseLmsEnvelope_: parseLmsEnvelope_,
    validateLmsHandshake_: validateLmsHandshake_,
    routeLmsAction_: routeLmsAction_,
    getLmsHandlers_: getLmsHandlers_,
    isSupportedLmsAction_: isSupportedLmsAction_,
    submitLmsProposal_: submitLmsProposal_,
    resolveEntityType_: resolveEntityType_,
    resolveEntityKey_: resolveEntityKey_
  };
}
