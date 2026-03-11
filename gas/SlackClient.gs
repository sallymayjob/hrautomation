/* global UrlFetchApp, Utilities, Config, AuditLogger */
/**
 * @fileoverview Slack API client with rate-limit aware retries.
 */

function SlackClient(auditLogger) {
  this.auditLogger = auditLogger || new AuditLogger();
  this.baseUrl_ = 'https://slack.com/api/';
  this.maxAttempts_ = 3;
}

SlackClient.prototype.getToken_ = function () {
  return Config.getSlackBotToken();
};

SlackClient.prototype.callApi_ = function (method, payload) {
  var url = this.baseUrl_ + method;
  var options = {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    headers: {
      Authorization: 'Bearer ' + this.getToken_()
    },
    muteHttpExceptions: true,
    payload: JSON.stringify(payload)
  };

  for (var attempt = 1; attempt <= this.maxAttempts_; attempt += 1) {
    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();
    var bodyText = response.getContentText();
    var body = bodyText ? JSON.parse(bodyText) : {};
    var isRateLimited = statusCode === 429 || body.error === 'ratelimited';

    if (statusCode >= 200 && statusCode < 300 && body.ok) {
      return body;
    }

    if (isRateLimited && attempt < this.maxAttempts_) {
      Utilities.sleep(attempt * 1000);
      continue;
    }

    var reason = body.error || ('HTTP_' + statusCode);
    var error = new Error('Slack API request failed for ' + method + ': ' + reason);

    if (!isRateLimited) {
      this.auditLogger.error({
        entityType: 'Slack',
        entityId: method,
        action: 'UPDATE',
        details: 'Slack API error for ' + method + ' with payload keys: ' + Object.keys(payload || {}).join(',')
      }, error);
    }

    throw error;
  }

  throw new Error('Slack API call failed after retries for ' + method);
};

SlackClient.prototype.postMessage = function (channelOrUserId, blocks) {
  if (!Array.isArray(blocks)) {
    throw new Error('postMessage requires blocks to be an array.');
  }

  return this.callApi_('chat.postMessage', {
    channel: channelOrUserId,
    text: 'Automated HR notification',
    blocks: blocks
  });
};

SlackClient.prototype.lookupUserByEmail = function (email) {
  return this.callApi_('users.lookupByEmail', {
    email: email
  });
};

if (typeof module !== 'undefined') module.exports = { SlackClient: SlackClient };
