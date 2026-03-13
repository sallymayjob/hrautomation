/**
 * @fileoverview Mapping checks and key normalization helpers.
 */

function buildAuditDedupeKey_(entityId, action, eventTimestamp) {
  return [
    String(entityId || '').trim(),
    String(action || '').trim(),
    String(eventTimestamp || '').trim()
  ].join('|');
}

function checkAuditDedupeKey_(entityId, action, eventTimestamp, seenKeys) {
  var dedupeMap = seenKeys || {};
  var dedupeKey = buildAuditDedupeKey_(entityId, action, eventTimestamp);
  var duplicate = !!dedupeMap[dedupeKey];
  dedupeMap[dedupeKey] = true;
  return {
    key: dedupeKey,
    duplicate: duplicate
  };
}

var MappingService = {
  buildAuditDedupeKey_: buildAuditDedupeKey_,
  checkAuditDedupeKey_: checkAuditDedupeKey_
};

if (typeof module !== 'undefined') module.exports = MappingService;
