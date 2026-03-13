/* global Utilities */
/**
 * @fileoverview Shared deterministic utility functions.
 */

function generateId(prefix) {
  var safePrefix = prefix || 'id';
  var ts = Utilities.formatDate(new Date(), 'Etc/UTC', "yyyyMMdd'T'HHmmss'Z'");
  var suffix = Utilities.getUuid().slice(0, 8);
  return safePrefix + '_' + ts + '_' + suffix;
}

function computeHash(parts) {
  var payload = (parts || []).map(function (part) {
    return part === null || part === undefined ? '' : String(part);
  }).join('|');
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payload, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    var value = (b < 0 ? b + 256 : b).toString(16);
    return value.length === 1 ? '0' + value : value;
  }).join('');
}

function getDaysUntilDue(dueDateValue) {
  if (!dueDateValue) {
    return null;
  }
  var dueDate = dueDateValue instanceof Date ? dueDateValue : new Date(dueDateValue);
  if (isNaN(dueDate.getTime())) {
    throw new Error('Invalid due date: ' + dueDateValue);
  }

  function toNzMidnightEpoch(dateValue) {
    var nzDate = Utilities.formatDate(dateValue, 'Pacific/Auckland', 'yyyy-MM-dd');
    var parts = nzDate.split('-');
    return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  var todayEpoch = toNzMidnightEpoch(new Date());
  var dueEpoch = toNzMidnightEpoch(dueDate);
  return Math.floor((dueEpoch - todayEpoch) / 86400000);
}

if (typeof module !== 'undefined') {
  var loggerBindings = require('./Logger.gs');
  module.exports = {
    generateId: generateId,
    computeHash: computeHash,
    getDaysUntilDue: getDaysUntilDue,
    AuditLogger: loggerBindings.AuditLogger,
    notifyHrAlerts: loggerBindings.notifyHrAlerts,
    verifyRequiredNamedFunctions: loggerBindings.verifyRequiredNamedFunctions
  };
}
