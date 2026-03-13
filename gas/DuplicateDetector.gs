/* global computeHash */
/**
 * @fileoverview Duplicate detection for governed payload commits.
 */

function buildKeyTuple_(record, fields) {
  var tupleFields = fields || ['entity_type', 'entity_key', 'action'];
  var parts = [];
  for (var i = 0; i < tupleFields.length; i += 1) {
    parts.push(String(record && record[tupleFields[i]] || '').trim());
  }
  return parts.join('|');
}

function buildContentHash_(record) {
  if (typeof computeHash === 'function') {
    return computeHash([
      JSON.stringify(record && record.payload || {}),
      String(record && record.entity_key || ''),
      String(record && record.action || '')
    ]);
  }
  return JSON.stringify(record && record.payload || {});
}

function detectDuplicate_(record, existingRecords, options) {
  var candidate = record || {};
  var rows = existingRecords || [];
  var opts = options || {};
  var tuple = buildKeyTuple_(candidate, opts.keyFields);
  var hash = buildContentHash_(candidate);
  var activeField = String(opts.activeField || 'active');

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i] || {};
    var rowTuple = buildKeyTuple_(row, opts.keyFields);
    var rowHash = buildContentHash_(row);
    var rowActive = row[activeField] !== false && String(row[activeField] || '').toLowerCase() !== 'false';

    if (rowTuple === tuple && rowHash === hash && rowActive) {
      return {
        duplicate: true,
        reason: 'Detected active duplicate by key tuple and content hash.',
        tuple: tuple,
        hash: hash,
        matchedIndex: i
      };
    }
  }

  return {
    duplicate: false,
    tuple: tuple,
    hash: hash
  };
}

var DuplicateDetector = {
  buildKeyTuple_: buildKeyTuple_,
  buildContentHash_: buildContentHash_,
  detectDuplicate_: detectDuplicate_
};

if (typeof module !== 'undefined') module.exports = DuplicateDetector;
