/* global LibraryConfigService, CoreConstants */
/**
 * @fileoverview Script property accessors with typed getters.
 */

var Config = (function () {
  var core = (typeof CoreConstants !== 'undefined' && CoreConstants) ? CoreConstants : null;
  var configHelpers = (typeof LibraryConfigService !== 'undefined' && LibraryConfigService) ? LibraryConfigService : null;

  if (!configHelpers && typeof module !== 'undefined') {
    configHelpers = require('./LibraryConfigService.gs').LibraryConfigService;
  }
  if (!core && typeof module !== 'undefined') {
    core = require('./CoreConstants.gs').CoreConstants;
  }

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

  var GOVERNED_ACTION_TYPES = core ? core.ACTIONS : {
    LESSON_CREATE: 'lesson_create', LESSON_EDIT: 'lesson_edit', LESSON_OVERWRITE: 'lesson_overwrite', LESSON_VERSION: 'lesson_version', LESSON_MAPPING_CHANGE: 'lesson_mapping_change'
  };
  var APPROVAL_REQUIRED_ACTIONS = core ? core.APPROVAL_REQUIRED_ACTIONS : {
    lesson_create: true, lesson_edit: true, lesson_overwrite: true, lesson_version: true, lesson_mapping_change: true,
    create_lesson: true, edit_lesson: true, overwrite_lesson: true, version_lesson: true, update_lesson_mapping: true
  };
  var ENTITY_NAMES = core ? core.ENTITY_NAMES : { LESSON: 'lesson', LMS_ACTION: 'lms_action', PROPOSAL: 'proposal' };

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

  var REQUIRED_CHANNEL_GETTERS = [
    'getAdminTeamChannelId',
    'getFinanceTeamChannelId',
    'getHrTeamChannelId',
    'getItTeamChannelId',
    'getLegalTeamChannelId',
    'getOperationsTeamChannelId',
    'getPeopleTeamChannelId',
    'getDefaultAssignmentsChannelId',
    'getHrOpsAlertsChannelId'
  ];

  var CHANNEL_GETTER_TO_KEY = {
    getAdminTeamChannelId: KEYS.ADMIN_TEAM_CHANNEL_ID,
    getFinanceTeamChannelId: KEYS.FINANCE_TEAM_CHANNEL_ID,
    getHrTeamChannelId: KEYS.HR_TEAM_CHANNEL_ID,
    getItTeamChannelId: KEYS.IT_TEAM_CHANNEL_ID,
    getLegalTeamChannelId: KEYS.LEGAL_TEAM_CHANNEL_ID,
    getOperationsTeamChannelId: KEYS.OPERATIONS_TEAM_CHANNEL_ID,
    getPeopleTeamChannelId: KEYS.PEOPLE_TEAM_CHANNEL_ID,
    getDefaultAssignmentsChannelId: KEYS.DEFAULT_ASSIGNMENTS_CHANNEL_ID,
    getHrOpsAlertsChannelId: KEYS.HR_OPS_ALERTS_CHANNEL_ID
  };

  var DATASETS = {
    onboarding: { spreadsheetIdKey: KEYS.ONBOARDING_SPREADSHEET_ID, sheetNameKey: KEYS.ONBOARDING_SHEET_NAME },
    training: { spreadsheetIdKey: KEYS.TRAINING_SPREADSHEET_ID, sheetNameKey: KEYS.TRAINING_SHEET_NAME },
    audit: { spreadsheetIdKey: KEYS.AUDIT_SPREADSHEET_ID, sheetNameKey: KEYS.AUDIT_SHEET_NAME, fallbackSpreadsheetIdKey: KEYS.TRAINING_SPREADSHEET_ID },
    checklist: { spreadsheetIdKey: KEYS.CHECKLIST_SPREADSHEET_ID, sheetNameKey: KEYS.CHECKLIST_SHEET_NAME },
    mapping: { spreadsheetIdKey: KEYS.MAPPING_SPREADSHEET_ID, sheetNameKey: KEYS.MAPPING_SHEET_NAME, fallbackSpreadsheetIdKey: KEYS.TRAINING_SPREADSHEET_ID, fallbackSheetName: 'lessons' },
    lessons: { spreadsheetIdKey: KEYS.LESSONS_SPREADSHEET_ID, sheetNameKey: KEYS.LESSONS_SHEET_NAME, fallbackSpreadsheetIdKey: KEYS.TRAINING_SPREADSHEET_ID, fallbackSheetName: 'lessons' },
    mappings: { spreadsheetIdKey: KEYS.MAPPINGS_SPREADSHEET_ID, sheetNameKey: KEYS.MAPPINGS_SHEET_NAME, fallbackSpreadsheetIdKey: KEYS.TRAINING_SPREADSHEET_ID, fallbackSheetName: 'mappings' },
    approvals: { spreadsheetIdKey: KEYS.APPROVALS_SPREADSHEET_ID, sheetNameKey: KEYS.APPROVALS_SHEET_NAME, fallbackSpreadsheetIdKey: KEYS.TRAINING_SPREADSHEET_ID, fallbackSheetName: 'approvals' },
    submissions: { spreadsheetIdKey: KEYS.SUBMISSIONS_SPREADSHEET_ID, sheetNameKey: KEYS.SUBMISSIONS_SHEET_NAME, fallbackSpreadsheetIdKey: KEYS.TRAINING_SPREADSHEET_ID, fallbackSheetName: 'submissions' }
  };

  var datasetResolver = configHelpers.createDatasetResolver_(DATASETS);

  return {
    KEYS: KEYS,
    GOVERNED_ACTION_TYPES: GOVERNED_ACTION_TYPES,
    APPROVAL_REQUIRED_ACTIONS: APPROVAL_REQUIRED_ACTIONS,
    ENTITY_NAMES: ENTITY_NAMES,
    CHANNEL_ROUTING: CHANNEL_ROUTING,
    DATASETS: DATASETS,

    getDatasetSpreadsheetId: function (datasetKey) { return datasetResolver.getDatasetSpreadsheetId(datasetKey); },
    getDatasetSheetName: function (datasetKey) { return datasetResolver.getDatasetSheetName(datasetKey); },

    getOnboardingSpreadsheetId: function () { return datasetResolver.getDatasetSpreadsheetId('onboarding'); },
    getTrainingSpreadsheetId: function () { return datasetResolver.getDatasetSpreadsheetId('training'); },
    getAuditSpreadsheetId: function () { return datasetResolver.getDatasetSpreadsheetId('audit'); },
    getChecklistSpreadsheetId: function () { return datasetResolver.getDatasetSpreadsheetId('checklist'); },
    getMappingSpreadsheetId: function () { return datasetResolver.getDatasetSpreadsheetId('mapping'); },

    getOnboardingSheetName: function () { return datasetResolver.getDatasetSheetName('onboarding'); },
    getTrainingSheetName: function () { return datasetResolver.getDatasetSheetName('training'); },
    getAuditSheetName: function () { return datasetResolver.getDatasetSheetName('audit'); },
    getChecklistSheetName: function () { return datasetResolver.getDatasetSheetName('checklist'); },
    getMappingSheetName: function () { return datasetResolver.getDatasetSheetName('mapping'); },

    getLessonsSpreadsheetId: function () { return datasetResolver.getDatasetSpreadsheetId('lessons'); },
    getMappingsSpreadsheetId: function () { return datasetResolver.getDatasetSpreadsheetId('mappings'); },
    getApprovalsSpreadsheetId: function () { return datasetResolver.getDatasetSpreadsheetId('approvals'); },
    getSubmissionsSpreadsheetId: function () { return datasetResolver.getDatasetSpreadsheetId('submissions'); },

    getLessonsSheetName: function () { return datasetResolver.getDatasetSheetName('lessons'); },
    getMappingsSheetName: function () { return datasetResolver.getDatasetSheetName('mappings'); },
    getApprovalsSheetName: function () { return datasetResolver.getDatasetSheetName('approvals'); },
    getSubmissionsSheetName: function () { return datasetResolver.getDatasetSheetName('submissions'); },

    getHrAlertEmail: function () { return configHelpers.getStringProperty_(KEYS.HR_ALERT_EMAIL); },
    getAppTimezone: function () { return configHelpers.getStringProperty_(KEYS.APP_TIMEZONE); },
    getRetryMaxAttempts: function () { return configHelpers.getNumberProperty_(KEYS.RETRY_MAX_ATTEMPTS); },
    getRetryDelayMs: function () { return configHelpers.getNumberProperty_(KEYS.RETRY_DELAY_MS); },
    getSlackBotToken: function () { return configHelpers.getStringProperty_(KEYS.SLACK_BOT_TOKEN); },
    getSlackVerificationToken: function () { return configHelpers.getStringProperty_(KEYS.SLACK_VERIFICATION_TOKEN); },

    getGeminiApiKey: function () { return configHelpers.getOptionalStringProperty_(KEYS.GEMINI_API_KEY); },
    getGeminiModel: function () { return configHelpers.getOptionalStringProperty_(KEYS.GEMINI_MODEL) || 'gemini-1.5-flash'; },
    isGeminiEnabled: function () { return configHelpers.getBooleanProperty_(KEYS.GEMINI_ENABLED, false); },

    isGovernanceEnabled: function () { return configHelpers.getBooleanProperty_(KEYS.GOVERNANCE_ENABLED, true); },
    isGovernanceApprovalRequired: function () { return configHelpers.getBooleanProperty_(KEYS.GOVERNANCE_APPROVAL_REQUIRED, true); },

    getAdminTeamChannelId: function () { return configHelpers.getStringProperty_(KEYS.ADMIN_TEAM_CHANNEL_ID); },
    getFinanceTeamChannelId: function () { return configHelpers.getStringProperty_(KEYS.FINANCE_TEAM_CHANNEL_ID); },
    getHrTeamChannelId: function () { return configHelpers.getStringProperty_(KEYS.HR_TEAM_CHANNEL_ID); },
    getItTeamChannelId: function () { return configHelpers.getStringProperty_(KEYS.IT_TEAM_CHANNEL_ID); },
    getLegalTeamChannelId: function () { return configHelpers.getStringProperty_(KEYS.LEGAL_TEAM_CHANNEL_ID); },
    getOperationsTeamChannelId: function () { return configHelpers.getStringProperty_(KEYS.OPERATIONS_TEAM_CHANNEL_ID); },
    getPeopleTeamChannelId: function () { return configHelpers.getStringProperty_(KEYS.PEOPLE_TEAM_CHANNEL_ID); },
    getDefaultAssignmentsChannelId: function () { return configHelpers.getStringProperty_(KEYS.DEFAULT_ASSIGNMENTS_CHANNEL_ID); },
    getHrOpsAlertsChannelId: function () { return configHelpers.getStringProperty_(KEYS.HR_OPS_ALERTS_CHANNEL_ID); },

    validateRequiredChannelConfig: function () {
      var missing = [];
      for (var i = 0; i < REQUIRED_CHANNEL_GETTERS.length; i += 1) {
        var getterName = REQUIRED_CHANNEL_GETTERS[i];
        var getter = this[getterName];
        if (typeof getter !== 'function') {
          missing.push(CHANNEL_GETTER_TO_KEY[getterName] || getterName);
          continue;
        }
        var value = getter();
        if (!String(value || '').trim()) {
          missing.push(CHANNEL_GETTER_TO_KEY[getterName] || getterName);
        }
      }
      if (missing.length) {
        throw new Error('Missing required channel Script Properties: ' + missing.join(', '));
      }
      return true;
    }
  };
})();

if (typeof module !== 'undefined') module.exports = { Config: Config };
