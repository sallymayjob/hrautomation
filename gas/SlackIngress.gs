/* global verifySlackIngressRequest_, sanitizeTextForLog */
/**
 * @fileoverview Shared Slack ingress helpers for envelope parsing, validation hooks, shape guards, and standardized responses.
 */

var SlackIngressBindings_ = null;
if (typeof module !== 'undefined') {
  SlackIngressBindings_ = require('./SecurityUtils.gs');
}

function parseSlackIngressEnvelope_(event) {
  var envelope = (event && event.parameter) || {};
  var postData = event && event.postData;
  var rawBody = postData && postData.contents ? String(postData.contents || '') : '';

  if (envelope && envelope.payload) {
    try {
      return { envelope: envelope, payload: JSON.parse(envelope.payload), rawBody: rawBody, parseError: '' };
    } catch (payloadError) {
      return { envelope: envelope, payload: null, rawBody: rawBody, parseError: 'INVALID_ENVELOPE_PAYLOAD_JSON' };
    }
  }

  if (rawBody) {
    try {
      return { envelope: envelope, payload: JSON.parse(rawBody), rawBody: rawBody, parseError: '' };
    } catch (bodyError) {
      return { envelope: envelope, payload: envelope, rawBody: rawBody, parseError: 'INVALID_BODY_JSON' };
    }
  }

  return { envelope: envelope, payload: envelope, rawBody: rawBody, parseError: '' };
}

function verifySlackIngressWithHooks_(event, options) {
  var opts = options || {};
  var globalVerifyFn = (typeof verifySlackIngressRequest_ === 'function') ? verifySlackIngressRequest_ : null;
  var verifyFn = opts.verifyFn || globalVerifyFn || (SlackIngressBindings_ && SlackIngressBindings_.verifySlackIngressRequest_);
  if (typeof verifyFn !== 'function') {
    throw new Error('Slack ingress verification function is unavailable.');
  }
  return verifyFn(event, { route: opts.route || 'unknown' });
}

function guardSlackCommandShape_(payload) {
  return Boolean(payload && (payload.command || payload.type));
}

function guardSlackInteractivityShape_(payload) {
  return Boolean(payload && payload.type);
}

function guardLmsHandshakeShape_(payload) {
  return Boolean(payload && payload.action);
}

function createSlackEphemeralResponse_(text) {
  return {
    response_type: 'ephemeral',
    text: String(text || '')
  };
}

function createSlackIngressErrorResponse_(errorCode, reason) {
  return createSlackEphemeralResponse_('Unauthorized Slack request (' + String(errorCode || 'UNKNOWN') + ').');
}

function sanitizeSlackIngressLogText_(value) {
  if (typeof sanitizeTextForLog === 'function') return sanitizeTextForLog(value);
  return SlackIngressBindings_ && SlackIngressBindings_.sanitizeTextForLog
    ? SlackIngressBindings_.sanitizeTextForLog(value)
    : String(value || '');
}

if (typeof module !== 'undefined') {
  module.exports = {
    parseSlackIngressEnvelope_: parseSlackIngressEnvelope_,
    verifySlackIngressWithHooks_: verifySlackIngressWithHooks_,
    guardSlackCommandShape_: guardSlackCommandShape_,
    guardSlackInteractivityShape_: guardSlackInteractivityShape_,
    guardLmsHandshakeShape_: guardLmsHandshakeShape_,
    createSlackEphemeralResponse_: createSlackEphemeralResponse_,
    createSlackIngressErrorResponse_: createSlackIngressErrorResponse_,
    sanitizeSlackIngressLogText_: sanitizeSlackIngressLogText_
  };
}
