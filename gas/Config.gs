/* global PropertiesService */
/**
 * @fileoverview Script property accessors with typed getters.
 */

var Config = (function () {
  var KEYS = {
    ONBOARDING_SPREADSHEET_ID: 'ONBOARDING_SPREADSHEET_ID',
    TRAINING_SPREADSHEET_ID: 'TRAINING_SPREADSHEET_ID',
    AUDIT_SPREADSHEET_ID: 'AUDIT_SPREADSHEET_ID',
    CHECKLIST_SPREADSHEET_ID: 'CHECKLIST_SPREADSHEET_ID',
    MAPPING_SPREADSHEET_ID: 'MAPPING_SPREADSHEET_ID',
    ONBOARDING_SHEET_NAME: 'ONBOARDING_SHEET_NAME',
    TRAINING_SHEET_NAME: 'TRAINING_SHEET_NAME',
    AUDIT_SHEET_NAME: 'AUDIT_SHEET_NAME',
    CHECKLIST_SHEET_NAME: 'CHECKLIST_SHEET_NAME',
    MAPPING_SHEET_NAME: 'MAPPING_SHEET_NAME',
    LESSONS_SPREADSHEET_ID: 'LESSONS_SPREADSHEET_ID',
    MAPPINGS_SPREADSHEET_ID: 'MAPPINGS_SPREADSHEET_ID',
    APPROVALS_SPREADSHEET_ID: 'APPROVALS_SPREADSHEET_ID',
    SUBMISSIONS_SPREADSHEET_ID: 'SUBMISSIONS_SPREADSHEET_ID',
    LESSONS_SHEET_NAME: 'LESSONS_SHEET_NAME',
    MAPPINGS_SHEET_NAME: 'MAPPINGS_SHEET_NAME',
    APPROVALS_SHEET_NAME: 'APPROVALS_SHEET_NAME',
    SUBMISSIONS_SHEET_NAME: 'SUBMISSIONS_SHEET_NAME',
    HR_ALERT_EMAIL: 'HR_ALERT_EMAIL',
    APP_TIMEZONE: 'APP_TIMEZONE',
    RETRY_MAX_ATTEMPTS: 'RETRY_MAX_ATTEMPTS',
    RETRY_DELAY_MS: 'RETRY_DELAY_MS',
    SLACK_BOT_TOKEN: 'SLACK_BOT_TOKEN',
    SLACK_VERIFICATION_TOKEN: 'SLACK_VERIFICATION_TOKEN',
    ADMIN_TEAM_CHANNEL_ID: 'ADMIN_TEAM_CHANNEL_ID',
    FINANCE_TEAM_CHANNEL_ID: 'FINANCE_TEAM_CHANNEL_ID',
    HR_TEAM_CHANNEL_ID: 'HR_TEAM_CHANNEL_ID',
    IT_TEAM_CHANNEL_ID: 'IT_TEAM_CHANNEL_ID',
    LEGAL_TEAM_CHANNEL_ID: 'LEGAL_TEAM_CHANNEL_ID',
    OPERATIONS_TEAM_CHANNEL_ID: 'OPERATIONS_TEAM_CHANNEL_ID',
    PEOPLE_TEAM_CHANNEL_ID: 'PEOPLE_TEAM_CHANNEL_ID',
    DEFAULT_ASSIGNMENTS_CHANNEL_ID: 'DEFAULT_ASSIGNMENTS_CHANNEL_ID',
    HR_OPS_ALERTS_CHANNEL_ID: 'HR_OPS_ALERTS_CHANNEL_ID',
    GEMINI_API_KEY: 'GEMINI_API_KEY',
    GEMINI_MODEL: 'GEMINI_MODEL',
    GEMINI_ENABLED: 'GEMINI_ENABLED',
    GOVERNANCE_ENABLED: 'GOVERNANCE_ENABLED',
    GOVERNANCE_APPROVAL_REQUIRED: 'GOVERNANCE_APPROVAL_REQUIRED'
  };

  var GOVERNED_ACTION_TYPES = {
    LESSON_CREATE: 'lesson_create',
    LESSON_EDIT: 'lesson_edit',
    LESSON_OVERWRITE: 'lesson_overwrite',
    LESSON_VERSION: 'lesson_version',
    LESSON_MAPPING_CHANGE: 'lesson_mapping_change'
  };

  var APPROVAL_REQUIRED_ACTIONS = {
    lesson_create: true,
    lesson_edit: true,
    lesson_overwrite: true,
    lesson_version: true,
    lesson_mapping_change: true,
    create_lesson: true,
    edit_lesson: true,
    overwrite_lesson: true,
    version_lesson: true,
    update_lesson_mapping: true
  };

  var ENTITY_NAMES = {
    LESSON: 'lesson',
    LMS_ACTION: 'lms_action',
    PROPOSAL: 'proposal'
  };

  var CHANNEL_ROUTING = {
    ADMIN: 'getAdminTeamChannelId',
    FINANCE: 'getFinanceTeamChannelId',
    HR: 'getHrTeamChannelId',
    IT: 'getItTeamChannelId',
    LEGAL: 'getLegalTeamChannelId',
    OPERATIONS: 'getOperationsTeamChannelId',
    PEOPLE: 'getPeopleTeamChannelId',
    'PEOPLE OPS': 'getPeopleTeamChannelId'
  };

  var DATASETS = {
    onboarding: {
      spreadsheetIdKey: KEYS.ONBOARDING_SPREADSHEET_ID,
      sheetNameKey: KEYS.ONBOARDING_SHEET_NAME
    },
    training: {
      spreadsheetIdKey: KEYS.TRAINING_SPREADSHEET_ID,
      sheetNameKey: KEYS.TRAINING_SHEET_NAME
    },
    audit: {
      spreadsheetIdKey: KEYS.AUDIT_SPREADSHEET_ID,
      sheetNameKey: KEYS.AUDIT_SHEET_NAME,
      fallbackSpreadsheetIdKey: KEYS.TRAINING_SPREADSHEET_ID
    },
    checklist: {
      spreadsheetIdKey: KEYS.CHECKLIST_SPREADSHEET_ID,
      sheetNameKey: KEYS.CHECKLIST_SHEET_NAME
    },
    mapping: {
      spreadsheetIdKey: KEYS.MAPPING_SPREADSHEET_ID,
      sheetNameKey: KEYS.MAPPING_SHEET_NAME,
      fallbackSpreadsheetIdKey: KEYS.TRAINING_SPREADSHEET_ID,
      fallbackSheetName: 'lessons'
    },
    lessons: {
      spreadsheetIdKey: KEYS.LESSONS_SPREADSHEET_ID,
      sheetNameKey: KEYS.LESSONS_SHEET_NAME,
      fallbackSpreadsheetIdKey: KEYS.TRAINING_SPREADSHEET_ID,
      fallbackSheetName: 'lessons'
    },
    mappings: {
      spreadsheetIdKey: KEYS.MAPPINGS_SPREADSHEET_ID,
      sheetNameKey: KEYS.MAPPINGS_SHEET_NAME,
      fallbackSpreadsheetIdKey: KEYS.TRAINING_SPREADSHEET_ID,
      fallbackSheetName: 'mappings'
    },
    approvals: {
      spreadsheetIdKey: KEYS.APPROVALS_SPREADSHEET_ID,
      sheetNameKey: KEYS.APPROVALS_SHEET_NAME,
      fallbackSpreadsheetIdKey: KEYS.TRAINING_SPREADSHEET_ID,
      fallbackSheetName: 'approvals'
    },
    submissions: {
      spreadsheetIdKey: KEYS.SUBMISSIONS_SPREADSHEET_ID,
      sheetNameKey: KEYS.SUBMISSIONS_SHEET_NAME,
      fallbackSpreadsheetIdKey: KEYS.TRAINING_SPREADSHEET_ID,
      fallbackSheetName: 'submissions'
    }
  };

  function getRaw_(key) {
    var value = PropertiesService.getScriptProperties().getProperty(key);
    if (value === null || value === '') {
      throw new Error('Missing required Script Property: ' + key + '. Configure it in Apps Script > Project Settings > Script Properties.');
    }
    return value;
  }

  function getString_(key) {
    return String(getRaw_(key));
  }

  function getOptionalString_(key) {
    var value = PropertiesService.getScriptProperties().getProperty(key);
    if (value === null || value === '') {
      return '';
    }
    return String(value);
  }

  function getBoolean_(key, fallback) {
    var value = getOptionalString_(key);
    if (!value) {
      return Boolean(fallback);
    }
    var normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  }

  function getNumber_(key) {
    var value = Number(getRaw_(key));
    if (isNaN(value)) {
      throw new Error('Script Property ' + key + ' must be a valid number.');
    }
    return value;
  }

  function getDatasetSheetName_(datasetKey) {
    var dataset = DATASETS[datasetKey];
    if (!dataset) {
      throw new Error('Unknown dataset key: ' + datasetKey);
    }
    var value = getOptionalString_(dataset.sheetNameKey);
    if (value) {
      return value;
    }
    if (dataset.fallbackSheetName) {
      return dataset.fallbackSheetName;
    }
    return getString_(dataset.sheetNameKey);
  }

  function getDatasetSpreadsheetId_(datasetKey) {
    var dataset = DATASETS[datasetKey];
    if (!dataset) {
      throw new Error('Unknown dataset key: ' + datasetKey);
    }
    var value = getOptionalString_(dataset.spreadsheetIdKey);
    if (value) {
      return value;
    }
    if (dataset.fallbackSpreadsheetIdKey) {
      return getString_(dataset.fallbackSpreadsheetIdKey);
    }
    return getString_(dataset.spreadsheetIdKey);
  }

  return {
    KEYS: KEYS,
    GOVERNED_ACTION_TYPES: GOVERNED_ACTION_TYPES,
    APPROVAL_REQUIRED_ACTIONS: APPROVAL_REQUIRED_ACTIONS,
    ENTITY_NAMES: ENTITY_NAMES,
    CHANNEL_ROUTING: CHANNEL_ROUTING,
    DATASETS: DATASETS,

    getDatasetSpreadsheetId: function (datasetKey) {
      return getDatasetSpreadsheetId_(datasetKey);
    },

    getDatasetSheetName: function (datasetKey) {
      return getDatasetSheetName_(datasetKey);
    },

    getOnboardingSpreadsheetId: function () {
      return getDatasetSpreadsheetId_('onboarding');
    },

    getTrainingSpreadsheetId: function () {
      return getDatasetSpreadsheetId_('training');
    },

    getAuditSpreadsheetId: function () {
      return getDatasetSpreadsheetId_('audit');
    },

    getChecklistSpreadsheetId: function () {
      return getDatasetSpreadsheetId_('checklist');
    },

    getMappingSpreadsheetId: function () {
      return getDatasetSpreadsheetId_('mapping');
    },

    getOnboardingSheetName: function () {
      return getDatasetSheetName_('onboarding');
    },

    getTrainingSheetName: function () {
      return getDatasetSheetName_('training');
    },

    getAuditSheetName: function () {
      return getDatasetSheetName_('audit');
    },

    getChecklistSheetName: function () {
      return getDatasetSheetName_('checklist');
    },

    getMappingSheetName: function () {
      return getDatasetSheetName_('mapping');
    },

    getLessonsSpreadsheetId: function () {
      return getDatasetSpreadsheetId_('lessons');
    },

    getMappingsSpreadsheetId: function () {
      return getDatasetSpreadsheetId_('mappings');
    },

    getApprovalsSpreadsheetId: function () {
      return getDatasetSpreadsheetId_('approvals');
    },

    getSubmissionsSpreadsheetId: function () {
      return getDatasetSpreadsheetId_('submissions');
    },

    getLessonsSheetName: function () {
      return getDatasetSheetName_('lessons');
    },

    getMappingsSheetName: function () {
      return getDatasetSheetName_('mappings');
    },

    getApprovalsSheetName: function () {
      return getDatasetSheetName_('approvals');
    },

    getSubmissionsSheetName: function () {
      return getDatasetSheetName_('submissions');
    },

    getHrAlertEmail: function () {
      return getString_(KEYS.HR_ALERT_EMAIL);
    },

    getAppTimezone: function () {
      return getString_(KEYS.APP_TIMEZONE);
    },

    getRetryMaxAttempts: function () {
      return getNumber_(KEYS.RETRY_MAX_ATTEMPTS);
    },

    getRetryDelayMs: function () {
      return getNumber_(KEYS.RETRY_DELAY_MS);
    },

    getSlackBotToken: function () {
      return getString_(KEYS.SLACK_BOT_TOKEN);
    },

    getSlackVerificationToken: function () {
      return getString_(KEYS.SLACK_VERIFICATION_TOKEN);
    },

    getGeminiApiKey: function () {
      return getOptionalString_(KEYS.GEMINI_API_KEY);
    },

    getGeminiModel: function () {
      return getOptionalString_(KEYS.GEMINI_MODEL) || 'gemini-1.5-flash';
    },

    isGeminiEnabled: function () {
      return getBoolean_(KEYS.GEMINI_ENABLED, false);
    },

    isGovernanceEnabled: function () {
      return getBoolean_(KEYS.GOVERNANCE_ENABLED, true);
    },

    isGovernanceApprovalRequired: function () {
      return getBoolean_(KEYS.GOVERNANCE_APPROVAL_REQUIRED, true);
    },

    getAdminTeamChannelId: function () {
      return getString_(KEYS.ADMIN_TEAM_CHANNEL_ID);
    },

    getFinanceTeamChannelId: function () {
      return getString_(KEYS.FINANCE_TEAM_CHANNEL_ID);
    },

    getHrTeamChannelId: function () {
      return getString_(KEYS.HR_TEAM_CHANNEL_ID);
    },

    getItTeamChannelId: function () {
      return getString_(KEYS.IT_TEAM_CHANNEL_ID);
    },

    getLegalTeamChannelId: function () {
      return getString_(KEYS.LEGAL_TEAM_CHANNEL_ID);
    },

    getOperationsTeamChannelId: function () {
      return getString_(KEYS.OPERATIONS_TEAM_CHANNEL_ID);
    },

    getPeopleTeamChannelId: function () {
      return getString_(KEYS.PEOPLE_TEAM_CHANNEL_ID);
    },

    getDefaultAssignmentsChannelId: function () {
      return getString_(KEYS.DEFAULT_ASSIGNMENTS_CHANNEL_ID);
    },

    getHrOpsAlertsChannelId: function () {
      return getString_(KEYS.HR_OPS_ALERTS_CHANNEL_ID);
    }
  };
})();

if (typeof module !== 'undefined') module.exports = { Config: Config };
