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

var ValidationService = {
  buildOperatorError_: buildOperatorError_,
  isValidDate_: isValidDate_,
  validateOnboardingRow_: validateOnboardingRow_,
  validateAuditRow_: validateAuditRow_,
  validateTrainingAssignmentRow_: validateTrainingAssignmentRow_,
  validateTrainingReminderRow_: validateTrainingReminderRow_,
  validateTrainingCompletionRow_: validateTrainingCompletionRow_
};

if (typeof module !== 'undefined') module.exports = ValidationService;
