/* global Config */
/**
 * @fileoverview Central policy for spreadsheet-owned vs automation-owned fields.
 */

var SpreadsheetGovernancePolicy = (function () {
  var POLICY = {
    onboarding: {
      tabName: 'Onboarding',
      datasetKey: 'onboarding',
      managedColumns: ['onboarding_id', 'slack_id', 'manager_slack_id', 'buddy_slack_id', 'status', 'dm_sent_at', 'checklist_completed', 'row_hash', 'blocked_reason'],
      managedIdentityColumns: ['onboarding_id', 'row_hash'],
      manualColumns: ['employee_name', 'email', 'role', 'start_date', 'manager_email', 'brand', 'region', 'dob'],
      keyColumns: ['onboarding_id'],
      statusColumn: 'status',
      allowedStatuses: ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE', 'DONE']
    },
    checklist: {
      tabName: 'Checklist Tasks',
      datasetKey: 'checklist',
      managedColumns: ['task_id', 'onboarding_id', 'phase', 'task_name', 'owner_team', 'owner_slack_channel', 'updated_at'],
      managedIdentityColumns: ['task_id', 'onboarding_id'],
      manualColumns: ['status', 'updated_by', 'notes', 'due_date'],
      keyColumns: ['task_id', 'onboarding_id'],
      statusColumn: 'status',
      allowedStatuses: ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE', 'DONE']
    },
    training: {
      tabName: 'Training',
      datasetKey: 'training',
      managedColumns: ['employee_id', 'module_code', 'module_name', 'assigned_date', 'due_date', 'training_status', 'completion_hash', 'last_updated_at'],
      managedIdentityColumns: ['employee_id', 'module_code', 'completion_hash'],
      manualColumns: ['completion_date', 'celebration_posted', 'owner_email', 'reminder_count', 'last_reminder_at'],
      keyColumns: ['employee_id', 'module_code'],
      statusColumn: 'training_status',
      allowedStatuses: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'BLOCKED']
    },
    audit: {
      tabName: 'Audit',
      datasetKey: 'audit',
      managedColumns: ['audit_id', 'event_timestamp', 'actor_email', 'entity_type', 'entity_id', 'action', 'details', 'event_hash'],
      managedIdentityColumns: ['audit_id', 'event_hash', 'entity_id'],
      manualColumns: [],
      keyColumns: ['audit_id', 'entity_id'],
      statusColumn: '',
      allowedStatuses: []
    }
  };

  function copyArray_(arr) {
    return (arr || []).slice();
  }

  function normalizeHeader_(headerName) {
    return String(headerName || '').trim().toLowerCase();
  }

  function normalizeTabName_(sheetName) {
    return String(sheetName || '').trim().toLowerCase();
  }

  function getPolicyByDataset_(datasetKey) {
    var key = String(datasetKey || '').trim().toLowerCase();
    return POLICY[key] || null;
  }

  function getPolicyForSheetName(sheetName) {
    var normalizedSheetName = normalizeTabName_(sheetName);
    var datasetNames = {
      onboarding: Config && typeof Config.getOnboardingSheetName === 'function' ? normalizeTabName_(Config.getOnboardingSheetName()) : 'onboarding',
      checklist: Config && typeof Config.getChecklistSheetName === 'function' ? normalizeTabName_(Config.getChecklistSheetName()) : 'checklist tasks',
      training: Config && typeof Config.getTrainingSheetName === 'function' ? normalizeTabName_(Config.getTrainingSheetName()) : 'training',
      audit: Config && typeof Config.getAuditSheetName === 'function' ? normalizeTabName_(Config.getAuditSheetName()) : 'audit'
    };

    var keys = Object.keys(datasetNames);
    for (var i = 0; i < keys.length; i += 1) {
      var datasetKey = keys[i];
      if (normalizedSheetName === datasetNames[datasetKey] || normalizedSheetName === normalizeTabName_(POLICY[datasetKey].tabName)) {
        return POLICY[datasetKey];
      }
    }

    return null;
  }

  function getManagedIdentityColumnsForSheet(sheetName) {
    var policy = getPolicyForSheetName(sheetName);
    return policy ? copyArray_(policy.managedIdentityColumns) : [];
  }

  function isManagedIdentityColumn(sheetName, headerName) {
    var managedIdentityColumns = getManagedIdentityColumnsForSheet(sheetName);
    var normalizedHeader = normalizeHeader_(headerName);
    for (var i = 0; i < managedIdentityColumns.length; i += 1) {
      if (normalizeHeader_(managedIdentityColumns[i]) === normalizedHeader) {
        return true;
      }
    }
    return false;
  }

  return {
    POLICY: POLICY,
    getPolicyByDataset_: getPolicyByDataset_,
    getPolicyForSheetName: getPolicyForSheetName,
    getManagedIdentityColumnsForSheet: getManagedIdentityColumnsForSheet,
    isManagedIdentityColumn: isManagedIdentityColumn
  };
})();

if (typeof module !== 'undefined') {
  module.exports = { SpreadsheetGovernancePolicy: SpreadsheetGovernancePolicy };
}
