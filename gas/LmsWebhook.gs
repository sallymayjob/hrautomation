/* global ContentService, AuditLogger, SheetClient, Utilities */
/**
 * @fileoverview LMS webhook entrypoint for Slack Workflow Builder initiated handshakes.
 */

var LMS_HANDSHAKE_SOURCE = 'slack_workflow_builder';

var LMS_ACTIONS = {
  CREATE_COURSE: 'create_course',
  UPDATE_COURSE: 'update_course',
  ARCHIVE_COURSE: 'archive_course',
  ENROLL_SINGLE: 'enroll_single',
  BULK_ENROLL: 'bulk_enroll',
  UNENROLL_SINGLE: 'unenroll_single',
  BULK_UNENROLL: 'bulk_unenroll',
  ASSIGN_COHORT: 'assign_cohort',
  MARK_COMPLETION: 'mark_completion'
};

function doPostLms(e) {
  var payload = parseLmsEnvelope_(e);
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
  var empty = {};
  if (!e) {
    return empty;
  }

  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      return {
        parse_error: 'INVALID_JSON',
        raw_payload: String(e.postData.contents || '')
      };
    }
  }

  if (e.parameter && e.parameter.payload) {
    try {
      return JSON.parse(e.parameter.payload);
    } catch (parseErr) {
      return {
        parse_error: 'INVALID_JSON',
        raw_payload: String(e.parameter.payload || '')
      };
    }
  }

  return e.parameter || empty;
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

  if (!payload.action) {
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
  var handlers = getLmsHandlers_();

  if (!handlers[action]) {
    return {
      ok: false,
      code: 'UNSUPPORTED_ACTION',
      message: 'Unsupported LMS action: ' + action
    };
  }

  try {
    var result = handlers[action](payload);
    writeLmsAuditLog_(payload, action, 'SUCCESS', 'Action processed.');
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

function getLmsHandlers_() {
  return {
    create_course: function (payload) {
      return executeLmsAdapter_('createCourse', payload);
    },
    update_course: function (payload) {
      return executeLmsAdapter_('updateCourse', payload);
    },
    archive_course: function (payload) {
      return executeLmsAdapter_('archiveCourse', payload);
    },
    enroll_single: function (payload) {
      return executeLmsAdapter_('enrollLearner', payload);
    },
    bulk_enroll: function (payload) {
      return executeLmsAdapter_('bulkEnroll', payload);
    },
    unenroll_single: function (payload) {
      return executeLmsAdapter_('unenrollLearner', payload);
    },
    bulk_unenroll: function (payload) {
      return executeLmsAdapter_('bulkUnenroll', payload);
    },
    assign_cohort: function (payload) {
      return executeLmsAdapter_('assignCohort', payload);
    },
    mark_completion: function (payload) {
      return executeLmsAdapter_('markCompletion', payload);
    }
  };
}

function executeLmsAdapter_(adapterFunctionName, payload) {
  var adapter = (typeof globalThis !== 'undefined' && globalThis.LmsRoutes) ? globalThis.LmsRoutes : null;
  if (!adapter || typeof adapter[adapterFunctionName] !== 'function') {
    return {
      queued: true,
      adapter: adapterFunctionName,
      message: 'No adapter implementation found. Request accepted for deferred processing.'
    };
  }
  return adapter[adapterFunctionName](payload);
}

function writeLmsAuditLog_(payload, action, status, details) {
  if (typeof AuditLogger === 'undefined' || typeof SheetClient === 'undefined') {
    return;
  }

  var requestId = String(payload.request_id || payload.idempotency_key || '');
  var actor = String(payload.actor_slack_id || payload.user_id || 'workflow_builder');
  var auditLogger = new AuditLogger(new SheetClient());
  if (typeof auditLogger.log !== 'function') {
    return;
  }

  auditLogger.log({
    actorEmail: actor,
    entityType: 'LmsWorkflow',
    entityId: requestId || action,
    action: status,
    details: 'action=' + action + '; ' + details
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
    executeLmsAdapter_: executeLmsAdapter_
  };
}
