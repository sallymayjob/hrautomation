/* global SpreadsheetApp, Config, SpreadsheetGovernancePolicy, ValidationService */
/**
 * @fileoverview Periodic validator for managed key/status patterns across core tabs.
 */

var SpreadsheetPeriodicValidatorBindings_ = null;
if (typeof require === 'function') {
  SpreadsheetPeriodicValidatorBindings_ = {
    policy: require('./SpreadsheetGovernancePolicy.gs').SpreadsheetGovernancePolicy,
    validationService: require('./ValidationService.gs')
  };
}

function getPeriodicPolicy_() {
  if (typeof SpreadsheetGovernancePolicy !== 'undefined' && SpreadsheetGovernancePolicy) {
    return SpreadsheetGovernancePolicy;
  }
  return SpreadsheetPeriodicValidatorBindings_ && SpreadsheetPeriodicValidatorBindings_.policy;
}

function getPeriodicValidationService_() {
  if (typeof ValidationService !== 'undefined' && ValidationService) {
    return ValidationService;
  }
  return SpreadsheetPeriodicValidatorBindings_ && SpreadsheetPeriodicValidatorBindings_.validationService;
}

function normalizeHeaderKeyForValidator_(headerValue) {
  return String(headerValue || '').trim().toLowerCase();
}

function readRowsForValidator_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    return { headers: [], rows: [] };
  }

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var normalizedHeaders = [];
  for (var h = 0; h < headers.length; h += 1) {
    normalizedHeaders.push(normalizeHeaderKeyForValidator_(headers[h]));
  }

  var rows = [];
  for (var r = 0; r < values.length; r += 1) {
    var row = {};
    for (var c = 0; c < normalizedHeaders.length; c += 1) {
      row[normalizedHeaders[c]] = values[r][c];
    }
    rows.push(row);
  }

  return { headers: normalizedHeaders, rows: rows };
}

function validateManagedRowsForSheet_(sheet, policy) {
  var source = readRowsForValidator_(sheet);
  var errors = [];
  var validationService = getPeriodicValidationService_();
  for (var i = 0; i < source.rows.length; i += 1) {
    var rowErrors = validationService.validateManagedKeyStatusPattern_(source.rows[i], i, policy);
    if (rowErrors.length > 0) {
      errors = errors.concat(rowErrors);
    }
  }

  return {
    sheetName: sheet.getName(),
    checked: source.rows.length,
    errorCount: errors.length,
    errors: errors
  };
}

function runPeriodicManagedRowsValidation() {
  var policyService = getPeriodicPolicy_();
  var datasetKeys = ['onboarding', 'checklist', 'training', 'audit'];
  var summaries = [];
  var allErrors = [];

  for (var i = 0; i < datasetKeys.length; i += 1) {
    var datasetKey = datasetKeys[i];
    var policy = policyService.getPolicyByDataset_(datasetKey);
    if (!policy) {
      continue;
    }

    var spreadsheetId = Config.getDatasetSpreadsheetId(policy.datasetKey);
    var sheetName = Config.getDatasetSheetName(policy.datasetKey);
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      summaries.push({ sheetName: sheetName, checked: 0, errorCount: 1, errors: [{ code: 'VALIDATOR_SHEET_NOT_FOUND', rowIndex: 0, message: 'Sheet not found for periodic validator: ' + sheetName }] });
      continue;
    }

    var summary = validateManagedRowsForSheet_(sheet, policy);
    summaries.push(summary);
    if (summary.errors.length > 0) {
      allErrors = allErrors.concat(summary.errors);
    }
  }

  return {
    ok: allErrors.length === 0,
    checkedSheets: summaries.length,
    errorCount: allErrors.length,
    summaries: summaries,
    errors: allErrors
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    normalizeHeaderKeyForValidator_: normalizeHeaderKeyForValidator_,
    readRowsForValidator_: readRowsForValidator_,
    validateManagedRowsForSheet_: validateManagedRowsForSheet_,
    runPeriodicManagedRowsValidation: runPeriodicManagedRowsValidation
  };
}
