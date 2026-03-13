/* global Config, Utilities */
/**
 * @fileoverview Legacy Slack verification-token auth and log sanitization helpers.
 * NOTE: This intentionally uses Slack verification tokens (not signing-secret HMAC),
 * which is weaker and should be treated as legacy trust hardening only.
 */

function sanitizeTextForLog(text) {
  var value = String(text || '');
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\b[CUWDA][A-Z0-9]{8,}\b/g, '[REDACTED_SLACK_ID]')
    .replace(/xox[baprs]-[A-Za-z0-9-]+/g, '[REDACTED_TOKEN]')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeErrorForLog(error) {
  var message = error && error.message ? error.message : String(error || '');
  return sanitizeTextForLog(message).slice(0, 500);
}

function sanitizePayloadForLog(payload) {
  var source = payload || {};
  var clone = {};
  var keys = Object.keys(source);
  for (var i = 0; i < keys.length; i += 1) {
    var key = keys[i];
    if (key === 'token' || key === 'verification_token' || key === 'payload' || key === 'raw_payload') {
      clone[key] = '[REDACTED]';
      continue;
    }
    var value = source[key];
    clone[key] = typeof value === 'string' ? sanitizeTextForLog(value).slice(0, 300) : value;
  }
  return clone;
}

function getSlackVerificationToken_() {
  if (typeof Config === 'undefined' || !Config || typeof Config.getSlackVerificationToken !== 'function') {
    throw new Error('Config.getSlackVerificationToken is required for Slack ingress verification.');
  }
  return String(Config.getSlackVerificationToken() || '').trim();
}

function parseJsonSafe_(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: err };
  }
}

function extractSlackToken_(payload, envelope) {
  return String(
    (payload && (payload.token || payload.verification_token)) ||
    (envelope && (envelope.token || envelope.verification_token)) ||
    ''
  ).trim();
}

function validateTokenFormat_(token) {
  return /^[A-Za-z0-9_\-]{6,200}$/.test(String(token || ''));
}

function verifySlackIngressRequest_(event, options) {
  var opts = options || {};
  var route = String(opts.route || 'unknown');
  var expectedToken = getSlackVerificationToken_();
  var envelope = (event && event.parameter) || {};
  var parsedPayload = null;

  var contentType = String((event && event.postData && (event.postData.type || event.postData.mimeType)) || '').toLowerCase();
  if (contentType && contentType.indexOf('application/json') === -1 && contentType.indexOf('application/x-www-form-urlencoded') === -1) {
    return {
      ok: false,
      errorCode: 'UNSUPPORTED_CONTENT_TYPE',
      reason: 'Unsupported content type for Slack ingress: ' + contentType,
      httpStatus: 401,
      parsedPayload: null,
      envelope: envelope
    };
  }

  if (envelope.payload) {
    var parsed = parseJsonSafe_(envelope.payload);
    if (!parsed.ok) {
      return {
        ok: false,
        errorCode: 'MALFORMED_PAYLOAD',
        reason: 'Failed to parse payload envelope JSON.',
        httpStatus: 401,
        parsedPayload: null,
        envelope: envelope
      };
    }
    parsedPayload = parsed.value;
  } else if (event && event.postData && event.postData.contents) {
    var parsedBody = parseJsonSafe_(event.postData.contents);
    if (!parsedBody.ok) {
      return {
        ok: false,
        errorCode: 'MALFORMED_PAYLOAD',
        reason: 'Failed to parse request JSON body.',
        httpStatus: 401,
        parsedPayload: null,
        envelope: envelope
      };
    }
    parsedPayload = parsedBody.value;
  } else {
    parsedPayload = envelope;
  }

  if (parsedPayload && parsedPayload.type === 'url_verification' && String(parsedPayload.challenge || '').length > 0) {
    return {
      ok: true,
      errorCode: '',
      reason: 'url_verification_challenge',
      httpStatus: 200,
      parsedPayload: parsedPayload,
      envelope: envelope,
      token: ''
    };
  }

  var token = extractSlackToken_(parsedPayload, envelope);
  if (!token) {
    return { ok: false, errorCode: 'MISSING_TOKEN', reason: 'Slack verification token is required.', httpStatus: 401, parsedPayload: parsedPayload, envelope: envelope };
  }
  if (!validateTokenFormat_(token)) {
    return { ok: false, errorCode: 'MALFORMED_TOKEN', reason: 'Slack verification token format is invalid.', httpStatus: 401, parsedPayload: parsedPayload, envelope: envelope };
  }
  if (!expectedToken || token !== expectedToken) {
    return { ok: false, errorCode: 'INVALID_TOKEN', reason: 'Slack verification token mismatch.', httpStatus: 403, parsedPayload: parsedPayload, envelope: envelope };
  }

  if (route === 'commands') {
    var isInteractive = Boolean(parsedPayload && parsedPayload.type);
    var hasCommand = Boolean(parsedPayload && parsedPayload.command);
    if (!isInteractive && !hasCommand) {
      return { ok: false, errorCode: 'INVALID_COMMAND_SHAPE', reason: 'Slack command ingress requires command or interactive payload type.', httpStatus: 401, parsedPayload: parsedPayload, envelope: envelope };
    }
  }

  if (route === 'lms') {
    if (!parsedPayload || !parsedPayload.action) {
      return { ok: false, errorCode: 'INVALID_LMS_SHAPE', reason: 'LMS ingress requires action.', httpStatus: 401, parsedPayload: parsedPayload, envelope: envelope };
    }
  }

  return {
    ok: true,
    errorCode: '',
    reason: 'verified',
    httpStatus: 200,
    parsedPayload: parsedPayload,
    envelope: envelope,
    token: token
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    sanitizeTextForLog: sanitizeTextForLog,
    sanitizeErrorForLog: sanitizeErrorForLog,
    sanitizePayloadForLog: sanitizePayloadForLog,
    verifySlackIngressRequest_: verifySlackIngressRequest_
  };
}
