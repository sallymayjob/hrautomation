/* global SpreadsheetApp, Config, Utilities, computeHash */
/**
 * @fileoverview Spreadsheet data access helpers.
 */

var COL = {
  ONBOARDING: {
    ONBOARDING_ID: 1,
    EMPLOYEE_NAME: 2,
    SLACK_ID: 3,
    EMAIL: 4,
    ROLE: 5,
    BRAND: 6,
    START_DATE: 7,
    REGION: 8,
    MANAGER_EMAIL: 9,
    MANAGER_SLACK_ID: 10,
    DOB: 11,
    STATUS: 12,
    DM_SENT_AT: 13,
    CHECKLIST_COMPLETED: 14,
    ROW_HASH: 15,
    BLOCKED_REASON: 16,
    // Backward-compatible aliases.
    EMPLOYEE_ID: 1,
    FULL_NAME: 2,
    ROLE_TITLE: 5
  },
  TRAINING: {
    EMPLOYEE_ID: 1,
    MODULE_CODE: 2,
    MODULE_NAME: 3,
    ASSIGNED_DATE: 4,
    DUE_DATE: 5,
    COMPLETION_DATE: 6,
    TRAINING_STATUS: 7,
    OWNER_EMAIL: 8,
    REMINDER_COUNT: 9,
    LAST_REMINDER_AT: 10,
    LAST_UPDATED_AT: 11,
    COMPLETION_HASH: 12,
    CELEBRATION_POSTED: 13
  },
  CHECKLIST: {
    TASK_ID: 1,
    ONBOARDING_ID: 2,
    PHASE: 3,
    TASK_NAME: 4,
    OWNER_TEAM: 5,
    OWNER_SLACK_CHANNEL: 6,
    STATUS: 7,
    DUE_DATE: 8,
    UPDATED_AT: 9,
    UPDATED_BY: 10,
    NOTES: 11,
    // Backward-compatible aliases.
    CATEGORY: 3,
    OWNER_SLACK_ID: 6
  },
  AUDIT: {
    AUDIT_ID: 1,
    EVENT_TIMESTAMP: 2,
    ACTOR_EMAIL: 3,
    ENTITY_TYPE: 4,
    ENTITY_ID: 5,
    ACTION: 6,
    DETAILS: 7,
    EVENT_HASH: 8
  }
};

var REQUIRED_NAMED_FUNCTIONS = {
  SYS_MAKE_ID: {
    sampleFormula: '=SYS_MAKE_ID("ONB", DATE(2026,1,1), 1, "MANUAL")'
  },
  SYS_IS_COMPLETE: {
    sampleFormula: '=SYS_IS_COMPLETE(3, 2)'
  },
  SYS_EVENT_KEY: {
    sampleFormula: '=SYS_EVENT_KEY("ONB_20260101T000000Z_0001", "CREATE", DATE(2026,1,1))'
  }
};

var SCHEMA_CONFIG_TAB = '_sys_config';

var SHEET_SCHEMA_SPECS = {
  onboarding: {
    expectedVersion: 3,
    requiredHeaders: ['onboarding_id', 'employee_name', 'email', 'role', 'start_date', 'manager_email', 'status', 'checklist_completed', 'row_hash', 'blocked_reason'],
    spreadsheetIdGetter: function () {
      return Config.getOnboardingSpreadsheetId();
    },
    sheetNameGetter: function () {
      return Config.getOnboardingSheetName();
    }
  },
  training: {
    expectedVersion: 1,
    requiredHeaders: ['employee_id', 'module_code', 'module_name', 'assigned_date', 'due_date', 'completion_date', 'training_status', 'last_updated_at', 'completion_hash', 'celebration_posted'],
    spreadsheetIdGetter: function () {
      return Config.getTrainingSpreadsheetId();
    },
    sheetNameGetter: function () {
      return Config.getTrainingSheetName();
    }
  },
  audit: {
    expectedVersion: 1,
    requiredHeaders: ['audit_id', 'event_timestamp', 'actor_email', 'entity_type', 'entity_id', 'action', 'details', 'event_hash'],
    spreadsheetIdGetter: function () {
      return Config.getAuditSpreadsheetId();
    },
    sheetNameGetter: function () {
      return Config.getAuditSheetName();
    }
  },
  checklist: {
    expectedVersion: 1,
    requiredHeaders: ['task_id', 'onboarding_id', 'phase', 'task_name', 'owner_team', 'owner_slack_channel', 'status', 'due_date', 'updated_at', 'updated_by', 'notes'],
    spreadsheetIdGetter: function () {
      return Config.getChecklistSpreadsheetId();
    },
    sheetNameGetter: function () {
      return Config.getChecklistSheetName();
    }
  }
};

var DASHBOARD_SCHEMAS = {
  onboarding: {
    spreadsheetIdGetter: function () {
      return Config.getOnboardingSpreadsheetId();
    },
    tabs: {
      Onboarding_Dashboard: ['section', 'metric', 'value', 'target', 'trend', 'last_refreshed_at'],
      Onboarding_KPI: ['kpi_key', 'kpi_label', 'kpi_value', 'kpi_target', 'kpi_delta', 'as_of_date'],
      Onboarding_Pivot: ['pivot_dimension', 'pivot_value', 'total_records', 'completed_records', 'completion_rate', 'overdue_records']
    }
  },
  training: {
    spreadsheetIdGetter: function () {
      return Config.getTrainingSpreadsheetId();
    },
    tabs: {
      Training_Dashboard: ['section', 'metric', 'value', 'target', 'trend', 'last_refreshed_at'],
      Training_KPI: ['kpi_key', 'kpi_label', 'kpi_value', 'kpi_target', 'kpi_delta', 'as_of_date'],
      Training_Pivot: ['pivot_dimension', 'pivot_value', 'assigned_count', 'completed_count', 'completion_rate', 'overdue_count']
    }
  },
  audit: {
    spreadsheetIdGetter: function () {
      return Config.getAuditSpreadsheetId();
    },
    tabs: {
      Audit_Dashboard: ['section', 'metric', 'value', 'target', 'trend', 'last_refreshed_at'],
      Audit_KPI: ['kpi_key', 'kpi_label', 'kpi_value', 'kpi_target', 'kpi_delta', 'as_of_date'],
      Audit_Pivot: ['pivot_dimension', 'pivot_value', 'event_count', 'unique_actor_count', 'change_rate', 'period_start']
    }
  }
};

function SheetClient() {}

SheetClient.prototype.validateRequiredNamedFunctions = function (auditLogger) {
  var sheetIds = [
    Config.getOnboardingSpreadsheetId(),
    Config.getTrainingSpreadsheetId(),
    Config.getAuditSpreadsheetId()
  ];
  var missing = [];

  for (var i = 0; i < sheetIds.length; i += 1) {
    var spreadsheetId = sheetIds[i];
    if (!spreadsheetId) {
      continue;
    }
    missing = missing.concat(this.validateRequiredNamedFunctionsOnSpreadsheet_(spreadsheetId));
  }

  if (missing.length > 0 && auditLogger && typeof auditLogger.log === 'function') {
    auditLogger.log({
      entityType: 'System',
      entityId: 'named_functions',
      action: 'UPDATE',
      details: 'Missing required named function(s): ' + missing.join(', ')
    });
  }

  return {
    valid: missing.length === 0,
    missingFunctions: missing
  };
};

SheetClient.prototype.validateRequiredNamedFunctionsOnSpreadsheet_ = function (spreadsheetId) {
  var spreadsheet = this.openSpreadsheetById_(spreadsheetId);
  var missing = [];
  var probeSheetName = '_sys_named_fn_probe';
  var probeSheet = spreadsheet.getSheetByName(probeSheetName);
  if (!probeSheet) {
    probeSheet = spreadsheet.insertSheet(probeSheetName);
  } else {
    probeSheet.clear();
  }

  var functionNames = Object.keys(REQUIRED_NAMED_FUNCTIONS);
  for (var i = 0; i < functionNames.length; i += 1) {
    var functionName = functionNames[i];
    var formula = REQUIRED_NAMED_FUNCTIONS[functionName].sampleFormula;
    var range = probeSheet.getRange(i + 1, 1);
    range.setFormula(formula);
    SpreadsheetApp.flush();
    var displayValue = String(range.getDisplayValue() || '').trim();
    if (displayValue.indexOf('#NAME?') > -1) {
      missing.push(functionName + '@' + spreadsheetId);
    }
  }

  spreadsheet.deleteSheet(probeSheet);
  return missing;
};

SheetClient.prototype.normalizeKey_ = function (value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
};

SheetClient.prototype.getHeaderMap_ = function (sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerMap = {};
  for (var i = 0; i < headers.length; i += 1) {
    var key = this.normalizeKey_(headers[i]);
    if (key) {
      headerMap[key] = i + 1;
    }
  }
  return headerMap;
};

SheetClient.prototype.getColumnIndexByHeaderKey_ = function (sheet, headerKey, required) {
  var headerMap = this.getHeaderMap_(sheet);
  var normalizedKey = this.normalizeKey_(headerKey);
  var columnIndex = headerMap[normalizedKey] || -1;
  if (columnIndex < 1 && required) {
    throw new Error('Required column not found on sheet "' + sheet.getName() + '": ' + headerKey);
  }
  return columnIndex;
};

SheetClient.prototype.openSpreadsheetById_ = function (spreadsheetId) {
  return SpreadsheetApp.openById(spreadsheetId);
};

SheetClient.prototype.getSheetFromSpreadsheet_ = function (spreadsheetId, sheetName, propertyLabel) {
  var spreadsheet = this.openSpreadsheetById_(spreadsheetId);
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName + ' (configured by ' + propertyLabel + ')');
  }
  return sheet;
};


SheetClient.prototype.getConfigSheet_ = function (spreadsheet) {
  var configSheet = spreadsheet.getSheetByName(SCHEMA_CONFIG_TAB);
  if (!configSheet) {
    configSheet = spreadsheet.insertSheet(SCHEMA_CONFIG_TAB);
    configSheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
  } else if (configSheet.getLastRow() < 1) {
    configSheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
  }
  return configSheet;
};

SheetClient.prototype.ensureSchemaVersionMetadata = function () {
  var schemaKeys = Object.keys(SHEET_SCHEMA_SPECS);
  for (var i = 0; i < schemaKeys.length; i += 1) {
    var schemaKey = schemaKeys[i];
    var spec = SHEET_SCHEMA_SPECS[schemaKey];
    var spreadsheet = this.openSpreadsheetById_(spec.spreadsheetIdGetter());
    var configSheet = this.getConfigSheet_(spreadsheet);
    var key = spec.sheetNameGetter() + '.schema_version';
    var rowIndex = this.findRowIndexByValue_(configSheet, 1, key);
    var expectedVersion = String(spec.expectedVersion);
    if (rowIndex < 0) {
      configSheet.appendRow([key, expectedVersion]);
      continue;
    }
    configSheet.getRange(rowIndex, 2).setValue(expectedVersion);
  }
};

SheetClient.prototype.getSchemaVersionFromConfig_ = function (spreadsheet, sheetName) {
  var configSheet = spreadsheet.getSheetByName(SCHEMA_CONFIG_TAB);
  if (!configSheet || configSheet.getLastRow() < 2) {
    return '';
  }
  var key = sheetName + '.schema_version';
  var rows = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < rows.length; i += 1) {
    if (String(rows[i][0] || '').trim() === key) {
      return String(rows[i][1] || '').trim();
    }
  }
  return '';
};

SheetClient.prototype.validateSheetSchema_ = function (sheet, expectedVersion, requiredHeaders) {
  var headerMap = this.getHeaderMap_(sheet);
  var missing = [];
  for (var i = 0; i < requiredHeaders.length; i += 1) {
    var key = this.normalizeKey_(requiredHeaders[i]);
    if (!headerMap[key]) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error('Schema mismatch on sheet "' + sheet.getName() + '". Missing required header(s): ' + missing.join(', '));
  }

  var spreadsheet = sheet.getParent();
  var currentVersion = this.getSchemaVersionFromConfig_(spreadsheet, sheet.getName());
  if (!currentVersion) {
    throw new Error('Schema version metadata missing for sheet "' + sheet.getName() + '". Expected version ' + expectedVersion + '.');
  }
  if (String(currentVersion) !== String(expectedVersion)) {
    throw new Error('Schema version mismatch for sheet "' + sheet.getName() + '". Expected ' + expectedVersion + ' but found ' + currentVersion + '.');
  }
  return true;
};

SheetClient.prototype.validateSchemaForSheetName_ = function (sheetName) {
  var schemaKeys = Object.keys(SHEET_SCHEMA_SPECS);
  for (var i = 0; i < schemaKeys.length; i += 1) {
    var schemaKey = schemaKeys[i];
    var spec = SHEET_SCHEMA_SPECS[schemaKey];
    if (spec.sheetNameGetter() === sheetName) {
      var sheet = this.getSheetFromSpreadsheet_(spec.spreadsheetIdGetter(), sheetName, schemaKey.toUpperCase() + '_SHEET_NAME');
      this.validateSheetSchema_(sheet, spec.expectedVersion, spec.requiredHeaders);
      return;
    }
  }
};

SheetClient.prototype.validateWorkbookSchemas = function () {
  var schemaKeys = Object.keys(SHEET_SCHEMA_SPECS);
  for (var i = 0; i < schemaKeys.length; i += 1) {
    var spec = SHEET_SCHEMA_SPECS[schemaKeys[i]];
    var sheet = this.getSheetFromSpreadsheet_(spec.spreadsheetIdGetter(), spec.sheetNameGetter(), schemaKeys[i].toUpperCase() + '_SHEET_NAME');
    this.validateSheetSchema_(sheet, spec.expectedVersion, spec.requiredHeaders);
  }
  return true;
};

SheetClient.prototype.safeWrite_ = function (sheetName, writeOperation, context) {
  try {
    this.validateSchemaForSheetName_(sheetName);
    return writeOperation();
  } catch (err) {
    var details = JSON.stringify({
      type: 'SCHEMA_WRITE_BLOCKED',
      sheet: sheetName,
      context: context || {},
      error: String(err && err.message ? err.message : err)
    });
    try {
      var auditSheet = this.getAuditSheet_();
      this.appendRow_(auditSheet, [
        Utilities.getUuid(),
        new Date(),
        'system',
        'System',
        sheetName,
        'UPDATE',
        details,
        computeHash(['SCHEMA_WRITE_BLOCKED', sheetName, details])
      ]);
    } catch (auditErr) {}
    throw err;
  }
};

SheetClient.prototype.getOnboardingSheet_ = function () {
  return this.getSheetFromSpreadsheet_(Config.getOnboardingSpreadsheetId(), Config.getOnboardingSheetName(), 'ONBOARDING_SHEET_NAME');
};

SheetClient.prototype.getTrainingSheet_ = function () {
  return this.getSheetFromSpreadsheet_(Config.getTrainingSpreadsheetId(), Config.getTrainingSheetName(), 'TRAINING_SHEET_NAME');
};

SheetClient.prototype.getAuditSheet_ = function () {
  return this.getSheetFromSpreadsheet_(Config.getAuditSpreadsheetId(), Config.getAuditSheetName(), 'AUDIT_SHEET_NAME');
};

SheetClient.prototype.getChecklistSheet_ = function () {
  return this.getSheetFromSpreadsheet_(Config.getChecklistSpreadsheetId(), Config.getChecklistSheetName(), 'CHECKLIST_SHEET_NAME');
};

SheetClient.prototype.resolveSheetByName_ = function (sheetName) {
  if (sheetName === Config.getOnboardingSheetName()) {
    return this.getOnboardingSheet_();
  }
  if (sheetName === Config.getTrainingSheetName()) {
    return this.getTrainingSheet_();
  }
  if (sheetName === Config.getAuditSheetName()) {
    return this.getAuditSheet_();
  }
  if (sheetName === Config.getChecklistSheetName()) {
    return this.getChecklistSheet_();
  }

  return this.getSheetFromSpreadsheet_(Config.getOnboardingSpreadsheetId(), sheetName, 'ONBOARDING_SPREADSHEET_ID');
};


SheetClient.prototype.resolveSpreadsheetIdBySheetName_ = function (sheetName) {
  if (sheetName === Config.getTrainingSheetName()) {
    return Config.getTrainingSpreadsheetId();
  }
  if (sheetName === Config.getAuditSheetName()) {
    return Config.getAuditSpreadsheetId();
  }
  if (sheetName === Config.getChecklistSheetName()) {
    return Config.getChecklistSpreadsheetId();
  }
  return Config.getOnboardingSpreadsheetId();
};

SheetClient.prototype.getDataRows_ = function (sheet) {
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) {
    return [];
  }
  return sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
};

SheetClient.prototype.findRowIndexByValue_ = function (sheet, column, value) {
  var rows = this.getDataRows_(sheet);
  for (var i = 0; i < rows.length; i += 1) {
    if (rows[i][column - 1] === value) {
      return i + 2;
    }
  }
  return -1;
};

SheetClient.prototype.findRowIndexByValues_ = function (sheet, firstColumn, firstValue, secondColumn, secondValue) {
  var rows = this.getDataRows_(sheet);
  for (var i = 0; i < rows.length; i += 1) {
    if (rows[i][firstColumn - 1] === firstValue && rows[i][secondColumn - 1] === secondValue) {
      return i + 2;
    }
  }
  return -1;
};

SheetClient.prototype.writeRow_ = function (sheet, rowIndex, rowValues) {
  sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
};

SheetClient.prototype.appendRow_ = function (sheet, rowValues) {
  sheet.appendRow(rowValues);
  return sheet.getLastRow();
};

SheetClient.prototype.ensureSheetWithHeaders = function (sheetName, headers) {
  var spreadsheet = this.openSpreadsheetById_(this.resolveSpreadsheetIdBySheetName_(sheetName));
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return sheet;
  }

  var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (existingHeaders.length !== headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }

  for (var i = 0; i < headers.length; i += 1) {
    if (this.normalizeKey_(existingHeaders[i]) !== this.normalizeKey_(headers[i])) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      break;
    }
  }
  return sheet;
};

SheetClient.prototype.ensureDashboardTabsAndHeaders = function () {
  var dashboardKeys = Object.keys(DASHBOARD_SCHEMAS);
  var result = {
    updated: [],
    mismatches: []
  };

  for (var i = 0; i < dashboardKeys.length; i += 1) {
    var dashboardKey = dashboardKeys[i];
    var schema = DASHBOARD_SCHEMAS[dashboardKey];
    var spreadsheet = this.openSpreadsheetById_(schema.spreadsheetIdGetter());
    var tabNames = Object.keys(schema.tabs);

    for (var j = 0; j < tabNames.length; j += 1) {
      var tabName = tabNames[j];
      var expectedHeaders = schema.tabs[tabName];
      var sheet = spreadsheet.getSheetByName(tabName);

      if (!sheet) {
        sheet = spreadsheet.insertSheet(tabName);
      }

      var ensureResult = this.ensureHeadersWithoutDataLoss_(sheet, expectedHeaders);
      if (ensureResult.updated) {
        result.updated.push(dashboardKey + ':' + tabName);
      }
      if (ensureResult.mismatches.length > 0) {
        result.mismatches.push({
          dashboard: dashboardKey,
          tabName: tabName,
          issues: ensureResult.mismatches
        });
      }
    }
  }

  if (result.mismatches.length > 0) {
    throw new Error('Dashboard schema mismatch detected. Resolve header conflicts or follow docs/rollback-plan.md before rerunning setup.');
  }

  return result;
};

SheetClient.prototype.ensureHeadersWithoutDataLoss_ = function (sheet, expectedHeaders) {
  var updated = false;
  var mismatches = [];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    return {
      updated: true,
      mismatches: []
    };
  }

  var currentColumnCount = Math.max(sheet.getLastColumn(), expectedHeaders.length);
  var currentHeaders = sheet.getRange(1, 1, 1, currentColumnCount).getValues()[0];

  for (var i = 0; i < expectedHeaders.length; i += 1) {
    var existingValue = String(currentHeaders[i] || '').trim();
    var expectedValue = String(expectedHeaders[i] || '').trim();

    if (!existingValue) {
      sheet.getRange(1, i + 1).setValue(expectedValue);
      updated = true;
      continue;
    }

    if (this.normalizeKey_(existingValue) !== this.normalizeKey_(expectedValue)) {
      mismatches.push('column ' + (i + 1) + ' expected "' + expectedValue + '" but found "' + existingValue + '"');
    }
  }

  return {
    updated: updated,
    mismatches: mismatches
  };
};

SheetClient.prototype.checkDuplicate = function (sheetName, columnKeyOrIndex, value, excludeRowIndex) {
  var sheet = this.resolveSheetByName_(sheetName);
  var columnIndex = columnKeyOrIndex;

  if (typeof columnKeyOrIndex === 'string') {
    columnIndex = this.getColumnIndexByHeaderKey_(sheet, columnKeyOrIndex, false);
  }

  if (!columnIndex || columnIndex < 1) {
    throw new Error('Invalid duplicate check column: ' + columnKeyOrIndex);
  }

  var rows = this.getDataRows_(sheet);
  for (var row = 0; row < rows.length; row += 1) {
    var rowIndex = row + 2;
    if (excludeRowIndex && rowIndex === excludeRowIndex) {
      continue;
    }
    if (rows[row][columnIndex - 1] === value) {
      return rowIndex;
    }
  }
  return -1;
};

SheetClient.prototype.getOnboardingRows = function () {
  var sheet = this.getOnboardingSheet_();
  return this.getDataRows_(sheet);
};

SheetClient.prototype.findOnboardingByEmployeeId = function (employeeId) {
  var sheet = this.getOnboardingSheet_();
  var idColumn = this.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
  var rowIndex = this.findRowIndexByValue_(sheet, idColumn, employeeId);
  if (rowIndex < 0) {
    return null;
  }
  return { rowIndex: rowIndex, values: sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0] };
};

SheetClient.prototype.appendOnboardingRow = function (rowValues) {
  var self = this;
  return this.safeWrite_(Config.getOnboardingSheetName(), function () {
    var sheet = self.getOnboardingSheet_();
    var idColumn = self.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
    var existing = self.findRowIndexByValue_(sheet, idColumn, rowValues[idColumn - 1]);
    if (existing > -1) {
      self.writeRow_(sheet, existing, rowValues);
      return existing;
    }
    return self.appendRow_(sheet, rowValues);
  }, { operation: 'appendOnboardingRow' });
};

SheetClient.prototype.upsertOnboardingRow = function (employeeId, rowValues) {
  var self = this;
  return this.safeWrite_(Config.getOnboardingSheetName(), function () {
    var sheet = self.getOnboardingSheet_();
    var idColumn = self.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
    var rowIndex = self.findRowIndexByValue_(sheet, idColumn, employeeId);
    if (rowIndex < 0) {
      return self.appendRow_(sheet, rowValues);
    }
    self.writeRow_(sheet, rowIndex, rowValues);
    return rowIndex;
  }, { operation: 'upsertOnboardingRow', employeeId: employeeId });
};

SheetClient.prototype.updateOnboardingStatus = function (employeeId, status) {
  var self = this;
  return this.safeWrite_(Config.getOnboardingSheetName(), function () {
    var sheet = self.getOnboardingSheet_();
    var idColumn = self.getColumnIndexByHeaderKey_(sheet, 'onboarding_id', true);
    var statusColumn = self.getColumnIndexByHeaderKey_(sheet, 'status', true);
    var blockedReasonColumn = self.getColumnIndexByHeaderKey_(sheet, 'blocked_reason', false);
    var rowIndex = self.findRowIndexByValue_(sheet, idColumn, employeeId);
    if (rowIndex < 0) {
      return false;
    }

    var nextStatus = String(status || '').trim().toUpperCase();
    if (nextStatus === 'COMPLETE') {
      var gateResult = self.evaluateOnboardingCompletionGate(employeeId);
      if (!gateResult.canComplete) {
        sheet.getRange(rowIndex, statusColumn).setValue('BLOCKED');
        if (blockedReasonColumn > 0) {
          sheet.getRange(rowIndex, blockedReasonColumn).setValue(gateResult.blockedReason);
        }
        return false;
      }
    }

    sheet.getRange(rowIndex, statusColumn).setValue(status);
    if (blockedReasonColumn > 0 && nextStatus !== 'BLOCKED') {
      sheet.getRange(rowIndex, blockedReasonColumn).setValue('');
    }
    return true;
  }, { operation: 'updateOnboardingStatus', employeeId: employeeId });
};

SheetClient.prototype.evaluateOnboardingCompletionGate = function (employeeId) {
  var checklist = this.getChecklistSheet_();
  var rows = this.getDataRows_(checklist);
  var blockedByPhase = {};

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    if (String(row[COL.CHECKLIST.ONBOARDING_ID - 1]) !== String(employeeId)) {
      continue;
    }

    var status = String(row[COL.CHECKLIST.STATUS - 1] || '').trim().toUpperCase();
    if (status === 'COMPLETE' || status === 'DONE') {
      continue;
    }

    var phase = String(row[COL.CHECKLIST.PHASE - 1] || 'Unassigned').trim() || 'Unassigned';
    if (!blockedByPhase[phase]) {
      blockedByPhase[phase] = [];
    }
    blockedByPhase[phase].push(String(row[COL.CHECKLIST.TASK_NAME - 1] || 'Unnamed task'));
  }

  var phases = Object.keys(blockedByPhase);
  if (phases.length === 0) {
    return { canComplete: true, blockedReason: '' };
  }

  var message = phases.map(function (phase) {
    return phase + ': ' + blockedByPhase[phase].join(', ');
  }).join(' | ');

  return {
    canComplete: false,
    blockedReason: 'Cannot mark onboarding COMPLETE. Missing required tasks by phase -> ' + message
  };
};

SheetClient.prototype.getTrainingRows = function () {
  var sheet = this.getTrainingSheet_();
  return this.getDataRows_(sheet);
};

SheetClient.prototype.findTrainingByEmployeeAndModule = function (employeeId, moduleCode) {
  var sheet = this.getTrainingSheet_();
  var rowIndex = this.findRowIndexByValues_(
    sheet,
    COL.TRAINING.EMPLOYEE_ID,
    employeeId,
    COL.TRAINING.MODULE_CODE,
    moduleCode
  );
  if (rowIndex < 0) {
    return null;
  }
  return { rowIndex: rowIndex, values: sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0] };
};

SheetClient.prototype.appendTrainingRow = function (rowValues) {
  var self = this;
  return this.safeWrite_(Config.getTrainingSheetName(), function () {
    var sheet = self.getTrainingSheet_();
    var existing = self.findRowIndexByValues_(
      sheet,
      COL.TRAINING.EMPLOYEE_ID,
      rowValues[COL.TRAINING.EMPLOYEE_ID - 1],
      COL.TRAINING.MODULE_CODE,
      rowValues[COL.TRAINING.MODULE_CODE - 1]
    );
    if (existing > -1) {
      self.writeRow_(sheet, existing, rowValues);
      return existing;
    }
    return self.appendRow_(sheet, rowValues);
  }, { operation: 'appendTrainingRow' });
};

SheetClient.prototype.upsertTrainingRow = function (employeeId, moduleCode, rowValues) {
  var self = this;
  return this.safeWrite_(Config.getTrainingSheetName(), function () {
    var sheet = self.getTrainingSheet_();
    var rowIndex = self.findRowIndexByValues_(sheet, COL.TRAINING.EMPLOYEE_ID, employeeId, COL.TRAINING.MODULE_CODE, moduleCode);
    if (rowIndex < 0) {
      return self.appendRow_(sheet, rowValues);
    }
    self.writeRow_(sheet, rowIndex, rowValues);
    return rowIndex;
  }, { operation: 'upsertTrainingRow', employeeId: employeeId, moduleCode: moduleCode });
};

SheetClient.prototype.updateTrainingStatus = function (employeeId, moduleCode, status) {
  var self = this;
  return this.safeWrite_(Config.getTrainingSheetName(), function () {
    var sheet = self.getTrainingSheet_();
    var rowIndex = self.findRowIndexByValues_(sheet, COL.TRAINING.EMPLOYEE_ID, employeeId, COL.TRAINING.MODULE_CODE, moduleCode);
    if (rowIndex < 0) {
      return false;
    }
    sheet.getRange(rowIndex, COL.TRAINING.TRAINING_STATUS).setValue(status);
    return true;
  }, { operation: 'updateTrainingStatus', employeeId: employeeId, moduleCode: moduleCode });
};


SheetClient.prototype.updateTrainingReminderMetadata = function (employeeId, moduleCode, reminderCount, lastReminderAt) {
  var sheet = this.getTrainingSheet_();
  var rowIndex = this.findRowIndexByValues_(sheet, COL.TRAINING.EMPLOYEE_ID, employeeId, COL.TRAINING.MODULE_CODE, moduleCode);
  if (rowIndex < 0) {
    return false;
  }
  sheet.getRange(rowIndex, COL.TRAINING.REMINDER_COUNT).setValue(Number(reminderCount || 0));
  sheet.getRange(rowIndex, COL.TRAINING.LAST_REMINDER_AT).setValue(lastReminderAt || new Date());
  return true;
};

SheetClient.prototype.markCelebrationPosted = function (employeeId, moduleCode, posted) {
  var sheet = this.getTrainingSheet_();
  var rowIndex = this.findRowIndexByValues_(sheet, COL.TRAINING.EMPLOYEE_ID, employeeId, COL.TRAINING.MODULE_CODE, moduleCode);
  if (rowIndex < 0) {
    return false;
  }
  sheet.getRange(rowIndex, COL.TRAINING.CELEBRATION_POSTED).setValue(Boolean(posted));
  return true;
};

SheetClient.prototype.getChecklistRows = function () {
  var sheet = this.getChecklistSheet_();
  return this.getDataRows_(sheet);
};

SheetClient.prototype.findChecklistTask = function (taskId, onboardingId) {
  var sheet = this.getChecklistSheet_();
  var rowIndex = this.findRowIndexByValues_(sheet, COL.CHECKLIST.TASK_ID, taskId, COL.CHECKLIST.ONBOARDING_ID, onboardingId);
  if (rowIndex < 0) {
    return null;
  }
  return { rowIndex: rowIndex, values: sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0] };
};

SheetClient.prototype.appendChecklistTask = function (rowValues) {
  var sheet = this.getChecklistSheet_();
  var existing = this.findRowIndexByValues_(
    sheet,
    COL.CHECKLIST.TASK_ID,
    rowValues[COL.CHECKLIST.TASK_ID - 1],
    COL.CHECKLIST.ONBOARDING_ID,
    rowValues[COL.CHECKLIST.ONBOARDING_ID - 1]
  );
  if (existing > -1) {
    var existingValues = sheet.getRange(existing, 1, 1, sheet.getLastColumn()).getValues()[0];
    rowValues[COL.CHECKLIST.STATUS - 1] = existingValues[COL.CHECKLIST.STATUS - 1];
    rowValues[COL.CHECKLIST.UPDATED_AT - 1] = existingValues[COL.CHECKLIST.UPDATED_AT - 1];
    rowValues[COL.CHECKLIST.UPDATED_BY - 1] = existingValues[COL.CHECKLIST.UPDATED_BY - 1];
    rowValues[COL.CHECKLIST.NOTES - 1] = existingValues[COL.CHECKLIST.NOTES - 1];
    this.writeRow_(sheet, existing, rowValues);
    return existing;
  }
  return this.appendRow_(sheet, rowValues);
};

SheetClient.prototype.updateChecklistTask = function (taskId, onboardingId, updates) {
  var sheet = this.getChecklistSheet_();
  var rowIndex = this.findRowIndexByValues_(sheet, COL.CHECKLIST.TASK_ID, taskId, COL.CHECKLIST.ONBOARDING_ID, onboardingId);
  if (rowIndex < 0) {
    return false;
  }

  var headerMap = this.getHeaderMap_(sheet);
  var updateKeys = Object.keys(updates || {});
  for (var i = 0; i < updateKeys.length; i += 1) {
    var key = this.normalizeKey_(updateKeys[i]);
    var columnIndex = headerMap[key];
    if (columnIndex) {
      sheet.getRange(rowIndex, columnIndex).setValue(updates[updateKeys[i]]);
    }
  }

  return true;
};



SheetClient.prototype.updateChecklistReminderMetadata = function (taskId, onboardingId, reminderCount, lastReminderAt) {
  var sheet = this.getChecklistSheet_();
  var rowIndex = this.findRowIndexByValues_(sheet, COL.CHECKLIST.TASK_ID, taskId, COL.CHECKLIST.ONBOARDING_ID, onboardingId);
  if (rowIndex < 0) {
    return false;
  }
  var note = 'Reminder #' + Number(reminderCount || 0) + ' sent at ' + (lastReminderAt || new Date());
  sheet.getRange(rowIndex, COL.CHECKLIST.NOTES).setValue(note);
  return true;
};

SheetClient.prototype.getSheetRowLink = function (sheetName, rowIndex) {
  var sheet = this.resolveSheetByName_(sheetName);
  var spreadsheetId = this.resolveSpreadsheetIdBySheetName_(sheetName);
  return 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit#gid=' + sheet.getSheetId() + '&range=A' + rowIndex;
};

SheetClient.prototype.getAuditRows = function () {
  var sheet = this.getAuditSheet_();
  return this.getDataRows_(sheet);
};

SheetClient.prototype.appendAuditRow = function (rowValues) {
  var self = this;
  return this.safeWrite_(Config.getAuditSheetName(), function () {
    var sheet = self.getAuditSheet_();
    var auditId = rowValues[COL.AUDIT.AUDIT_ID - 1];
    if (auditId) {
      var existing = self.findRowIndexByValue_(sheet, COL.AUDIT.AUDIT_ID, auditId);
      if (existing > -1) {
        self.writeRow_(sheet, existing, rowValues);
        return existing;
      }
    }
    return self.appendRow_(sheet, rowValues);
  }, { operation: 'appendAuditRow' });
};

SheetClient.prototype.appendAuditIfNotExists = function (eventHash, rowValues) {
  var sheet = this.getAuditSheet_();
  var rowIndex = this.findRowIndexByValue_(sheet, COL.AUDIT.EVENT_HASH, eventHash);
  if (rowIndex > -1) {
    return rowIndex;
  }
  return this.appendRow_(sheet, rowValues);
};

SheetClient.prototype.appendWorkflowLifecycleEvent = function (event) {
  var eventHash = computeHash([
    event.workflow_run_key,
    event.event_type,
    event.onboarding_id
  ]);
  var immutableDetails = JSON.stringify({
    event_id: event.event_id,
    workflow_name: event.workflow_name,
    workflow_run_key: event.workflow_run_key,
    event_type: event.event_type,
    event_ts: event.event_ts,
    actor: event.actor,
    source_trigger: event.source_trigger,
    onboarding_id: event.onboarding_id
  });

  return this.appendAuditIfNotExists(eventHash, [
    event.event_id,
    event.event_ts,
    event.actor,
    'WorkflowLifecycle',
    event.onboarding_id || event.workflow_run_key,
    event.event_type,
    immutableDetails,
    eventHash
  ]);
};

if (typeof module !== 'undefined') module.exports = { SheetClient: SheetClient, COL: COL };
