/* global MappingService */
/**
 * @fileoverview Reusable validation helpers for HR library payloads.
 */

var ValidationServiceBindings_ = null;
if (typeof require === 'function') {
  ValidationServiceBindings_ = {
    mappingService: require('./MappingService.gs')
  };
}

function getMappingService_() {
  if (typeof MappingService !== 'undefined' && MappingService) {
    return MappingService;
  }
  return ValidationServiceBindings_ && ValidationServiceBindings_.mappingService;
}

function buildOperatorError_(code, rowIndex, message, originalError) {
  return {
    code: code,
    rowIndex: rowIndex,
    message: message,
    technicalDetails: originalError && originalError.message ? originalError.message : ''
  };
}

function isValidEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isValidDate_(value) {
  if (!value) {
    return false;
  }
  var dateValue = value instanceof Date ? value : new Date(value);
  return !isNaN(dateValue.getTime());
}

function validateOnboardingRow_(row, index) {
  var errors = [];
  if (!row.onboarding_id) {
    errors.push(buildOperatorError_('ONBOARDING_ID_MISSING', index,
      'Row ' + (index + 1) + ' is missing onboarding ID. Ask HR Ops to populate the onboarding_id column.'));
  }
  if (!row.employee_name) {
    errors.push(buildOperatorError_('EMPLOYEE_NAME_MISSING', index,
      'Row ' + (index + 1) + ' is missing employee name. Please complete the employee_name cell and rerun.'));
  }
  if (!isValidEmail_(row.email)) {
    errors.push(buildOperatorError_('WORK_EMAIL_INVALID', index,
      'Row ' + (index + 1) + ' has an invalid work email. Use the employee\'s company email address.'));
  }
  if (!isValidDate_(row.start_date)) {
    errors.push(buildOperatorError_('START_DATE_INVALID', index,
      'Row ' + (index + 1) + ' has an unreadable start date. Please use YYYY-MM-DD format.'));
  }
  if (!isValidEmail_(row.manager_email)) {
    errors.push(buildOperatorError_('MANAGER_EMAIL_INVALID', index,
      'Row ' + (index + 1) + ' is missing a valid manager email. Add the manager\'s work email to continue.'));
  }
  return errors;
}

function validateAuditRow_(row, index, seenKeys) {
  var errors = [];
  var mappingService = getMappingService_();
  var entityId = String(row.entity_id || row.onboarding_id || '').trim();
  var action = String(row.action || '').trim();
  var eventTimestamp = row.event_timestamp || row.timestamp;

  if (!entityId) {
    errors.push(buildOperatorError_('AUDIT_ENTITY_MISSING', index,
      'Audit row ' + (index + 1) + ' is missing an entity ID. Please include onboarding_id or entity_id.'));
  }
  if (!action) {
    errors.push(buildOperatorError_('AUDIT_ACTION_MISSING', index,
      'Audit row ' + (index + 1) + ' is missing an action value. Add values like CREATE, UPDATE, or NOTIFY.'));
  }
  if (!isValidDate_(eventTimestamp)) {
    errors.push(buildOperatorError_('AUDIT_TIMESTAMP_INVALID', index,
      'Audit row ' + (index + 1) + ' has an invalid timestamp. Please provide a valid date/time.'));
  }

  var mappingCheck = mappingService.checkAuditDedupeKey_(entityId, action, eventTimestamp, seenKeys || {});
  if (mappingCheck.duplicate) {
    errors.push(buildOperatorError_('AUDIT_DUPLICATE_EVENT', index,
      'Audit row ' + (index + 1) + ' duplicates an earlier event. Remove duplicate rows before retrying.'));
  }

  return errors;
}

function validateTrainingAssignmentRow_(row, index) {
  var errors = [];
  if (!row.employee_id) {
    errors.push(buildOperatorError_('TRAINING_EMPLOYEE_ID_MISSING', index,
      'Training assignment row ' + (index + 1) + ' is missing employee_id. Add the employee identifier and retry.'));
  }
  if (!row.module_code) {
    errors.push(buildOperatorError_('TRAINING_MODULE_CODE_MISSING', index,
      'Training assignment row ' + (index + 1) + ' is missing module_code. Add the module code mapped to the role/department.'));
  }
  if (!row.role && !row.department) {
    errors.push(buildOperatorError_('TRAINING_TARGETING_MISSING', index,
      'Training assignment row ' + (index + 1) + ' needs role or department to determine assignment eligibility.'));
  }
  return errors;
}

function validateTrainingReminderRow_(row, index) {
  var errors = [];
  if (!row.employee_id) {
    errors.push(buildOperatorError_('TRAINING_EMPLOYEE_ID_MISSING', index,
      'Training reminder row ' + (index + 1) + ' is missing employee_id.'));
  }
  if (!row.module_code) {
    errors.push(buildOperatorError_('TRAINING_MODULE_CODE_MISSING', index,
      'Training reminder row ' + (index + 1) + ' is missing module_code.'));
  }
  if (!isValidDate_(row.due_date)) {
    errors.push(buildOperatorError_('TRAINING_DUE_DATE_INVALID', index,
      'Training reminder row ' + (index + 1) + ' has an invalid due_date. Use a valid date.'));
  }
  return errors;
}

function validateTrainingCompletionRow_(row, index) {
  var errors = [];
  var normalizedStatus = String(row.training_status || '').trim().toUpperCase();
  if (!row.employee_id) {
    errors.push(buildOperatorError_('TRAINING_EMPLOYEE_ID_MISSING', index,
      'Training completion row ' + (index + 1) + ' is missing employee_id.'));
  }
  if (!row.module_code) {
    errors.push(buildOperatorError_('TRAINING_MODULE_CODE_MISSING', index,
      'Training completion row ' + (index + 1) + ' is missing module_code.'));
  }
  if (!normalizedStatus) {
    errors.push(buildOperatorError_('TRAINING_STATUS_MISSING', index,
      'Training completion row ' + (index + 1) + ' is missing training_status.'));
  }
  if (normalizedStatus === 'COMPLETED' && row.completion_date && !isValidDate_(row.completion_date)) {
    errors.push(buildOperatorError_('TRAINING_COMPLETION_DATE_INVALID', index,
      'Training completion row ' + (index + 1) + ' has an invalid completion_date.'));
  }
  return errors;
}


function validateManagedKeyStatusPattern_(row, index, policy) {
  var errors = [];
  var sourceRow = row || {};
  var patternPolicy = policy || {};
  var keyColumns = patternPolicy.keyColumns || [];
  var statusColumn = String(patternPolicy.statusColumn || '').trim();
  var allowedStatuses = patternPolicy.allowedStatuses || [];

  for (var i = 0; i < keyColumns.length; i += 1) {
    var keyName = String(keyColumns[i] || '').trim();
    if (!keyName) {
      continue;
    }
    if (!sourceRow[keyName]) {
      errors.push(buildOperatorError_('MANAGED_KEY_MISSING', index,
        'Row ' + (index + 1) + ' is missing required key field "' + keyName + '".'));
    }
  }

  if (statusColumn) {
    var normalizedStatus = String(sourceRow[statusColumn] || '').trim().toUpperCase();
    if (!normalizedStatus) {
      errors.push(buildOperatorError_('MANAGED_STATUS_MISSING', index,
        'Row ' + (index + 1) + ' is missing status field "' + statusColumn + '".'));
    } else if (allowedStatuses.length > 0) {
      var isAllowed = false;
      for (var s = 0; s < allowedStatuses.length; s += 1) {
        if (String(allowedStatuses[s] || '').trim().toUpperCase() === normalizedStatus) {
          isAllowed = true;
          break;
        }
      }
      if (!isAllowed) {
        errors.push(buildOperatorError_('MANAGED_STATUS_INVALID', index,
          'Row ' + (index + 1) + ' has invalid status "' + normalizedStatus + '" for column "' + statusColumn + '".'));
      }
    }
  }

  return errors;
}

function normalizeTemplateMappingSources_(mappingValue) {
  if (Array.isArray(mappingValue)) {
    return mappingValue;
  }
  if (mappingValue === null || typeof mappingValue === 'undefined') {
    return [];
  }
  return [mappingValue];
}

function validateTemplateToChecklistMapping_(templateRow, index, fieldMapping, requiredChecklistFields) {
  var errors = [];
  var sourceRow = templateRow || {};
  var mapping = fieldMapping || {};
  var requiredFields = requiredChecklistFields || [];

  for (var i = 0; i < requiredFields.length; i += 1) {
    var checklistField = requiredFields[i];
    var sourceCandidates = normalizeTemplateMappingSources_(mapping[checklistField]);

    if (sourceCandidates.length === 0) {
      errors.push(buildOperatorError_('CHECKLIST_MAPPING_FIELD_MISSING', index,
        'Checklist mapping is missing required field "' + checklistField + '". Add the field mapping before generating checklist rows.'));
      continue;
    }

    var hasMappedSource = false;
    for (var c = 0; c < sourceCandidates.length; c += 1) {
      var sourceKey = String(sourceCandidates[c] || '').trim();
      if (!sourceKey) {
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(sourceRow, sourceKey) && sourceRow[sourceKey] !== '' && sourceRow[sourceKey] !== null) {
        hasMappedSource = true;
        break;
      }
    }

    if (!hasMappedSource) {
      errors.push(buildOperatorError_('CHECKLIST_TEMPLATE_SOURCE_MISSING', index,
        'Template row ' + (index + 1) + ' is missing source values for checklist field "' + checklistField + '". Review mapping and template columns.'));
    }
  }

  return errors;
}

function buildSchemaConformanceError_(sheetName, details) {
  var error = new Error('Schema drift detected for sheet "' + sheetName + '". ' + details.join(' '));
  error.name = 'SchemaConformanceError';
  error.code = 'SCHEMA_DRIFT_DETECTED';
  error.schemaDrift = true;
  error.auditEvent = {
    type: 'SCHEMA_DRIFT_DETECTED',
    sheet: sheetName,
    details: details
  };
  return error;
}

function assertSchemaConformance(sheetName, schemaSpec) {
  var spec = schemaSpec || {};
  var requiredHeaders = spec.requiredHeaders || [];
  var actualHeaders = spec.actualHeaders || [];
  var requireOrder = spec.requireOrder !== false;
  var details = [];
  var normalizedActual = {};
  var i;

  for (i = 0; i < actualHeaders.length; i += 1) {
    normalizedActual[String(actualHeaders[i] || '').trim().toLowerCase()] = i;
  }

  var missing = [];
  for (i = 0; i < requiredHeaders.length; i += 1) {
    var requiredHeader = String(requiredHeaders[i] || '').trim();
    if (!Object.prototype.hasOwnProperty.call(normalizedActual, requiredHeader.toLowerCase())) {
      missing.push(requiredHeader);
    }
  }
  if (missing.length > 0) {
    details.push('Missing required header(s): ' + missing.join(', ') + '.');
  }

  if (requireOrder) {
    var previousIndex = -1;
    var outOfOrder = false;
    for (i = 0; i < requiredHeaders.length; i += 1) {
      var requiredKey = String(requiredHeaders[i] || '').trim().toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(normalizedActual, requiredKey)) {
        continue;
      }
      var actualIndex = normalizedActual[requiredKey];
      if (actualIndex < previousIndex) {
        outOfOrder = true;
        break;
      }
      previousIndex = actualIndex;
    }
    if (outOfOrder) {
      details.push('Header order mismatch. Expected sequence: [' + requiredHeaders.join(', ') + '] but found headers: [' + actualHeaders.join(', ') + '].');
    }
  }

  if (spec.expectedVersion !== undefined && spec.expectedVersion !== null) {
    var expectedVersion = String(spec.expectedVersion);
    var configuredVersion = String(spec.configuredVersion || '').trim();
    if (!configuredVersion) {
      details.push('Config tab "' + String(spec.configTabName || '_sys_config') + '" is missing version marker for ' + sheetName + '.schema_version.');
    } else if (configuredVersion !== expectedVersion) {
      details.push('Version marker mismatch for ' + sheetName + '.schema_version: expected ' + expectedVersion + ' but found ' + configuredVersion + '.');
    }
  }

  if (details.length > 0) {
    throw buildSchemaConformanceError_(sheetName, details);
  }
  return true;
}

var ValidationService = {
  buildOperatorError_: buildOperatorError_,
  isValidDate_: isValidDate_,
  validateOnboardingRow_: validateOnboardingRow_,
  validateAuditRow_: validateAuditRow_,
  validateTrainingAssignmentRow_: validateTrainingAssignmentRow_,
  validateTrainingReminderRow_: validateTrainingReminderRow_,
  validateTrainingCompletionRow_: validateTrainingCompletionRow_,
  validateManagedKeyStatusPattern_: validateManagedKeyStatusPattern_,
  validateTemplateToChecklistMapping_: validateTemplateToChecklistMapping_,
  assertSchemaConformance: assertSchemaConformance
};

if (typeof module !== 'undefined') module.exports = ValidationService;
