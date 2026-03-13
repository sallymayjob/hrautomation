/* global */
/**
 * @fileoverview Versioning policy helpers for governed LMS mutations.
 */

function normalizeVersion_(value) {
  var numeric = Number(value);
  if (!isFinite(numeric) || numeric <= 0) return 0;
  return Math.floor(numeric);
}

function calculateNextVersion_(rows, keyField, keyValue, versionField) {
  var list = rows || [];
  var keyName = String(keyField || 'entity_key');
  var versionName = String(versionField || 'version');
  var target = String(keyValue || '');
  var maxVersion = 0;

  for (var i = 0; i < list.length; i += 1) {
    var row = list[i] || {};
    if (String(row[keyName] || '') !== target) continue;
    var rowVersion = normalizeVersion_(row[versionName]);
    if (rowVersion > maxVersion) maxVersion = rowVersion;
  }

  return maxVersion + 1;
}

function assertImmutableHistoricalRows_(rows, keyField, keyValue, nextVersion, versionField) {
  var list = rows || [];
  var keyName = String(keyField || 'entity_key');
  var versionName = String(versionField || 'version');
  var target = String(keyValue || '');
  var requestedVersion = normalizeVersion_(nextVersion);
  if (requestedVersion <= 0) {
    throw new Error('Version must be a positive integer.');
  }

  var seen = {};
  for (var i = 0; i < list.length; i += 1) {
    var row = list[i] || {};
    if (String(row[keyName] || '') !== target) continue;
    var historicalVersion = normalizeVersion_(row[versionName]);
    if (historicalVersion <= 0) continue;
    if (historicalVersion >= requestedVersion) {
      throw new Error('Historical version collision for ' + target + '. Existing row version ' + historicalVersion + ' blocks requested version ' + requestedVersion + '.');
    }
    if (seen[historicalVersion]) {
      throw new Error('Historical rows are immutable and must be unique per version for ' + target + '. Duplicate version ' + historicalVersion + ' found.');
    }
    seen[historicalVersion] = true;
  }

  return true;
}

var VersioningService = {
  normalizeVersion_: normalizeVersion_,
  calculateNextVersion_: calculateNextVersion_,
  assertImmutableHistoricalRows_: assertImmutableHistoricalRows_
};

if (typeof module !== 'undefined') module.exports = VersioningService;
