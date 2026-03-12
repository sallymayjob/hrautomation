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
    ONBOARDING_SHEET_NAME: 'ONBOARDING_SHEET_NAME',
    TRAINING_SHEET_NAME: 'TRAINING_SHEET_NAME',
    AUDIT_SHEET_NAME: 'AUDIT_SHEET_NAME',
    CHECKLIST_SHEET_NAME: 'CHECKLIST_SHEET_NAME',
    HR_ALERT_EMAIL: 'HR_ALERT_EMAIL',
    APP_TIMEZONE: 'APP_TIMEZONE',
    RETRY_MAX_ATTEMPTS: 'RETRY_MAX_ATTEMPTS',
    RETRY_DELAY_MS: 'RETRY_DELAY_MS',
    SLACK_BOT_TOKEN: 'SLACK_BOT_TOKEN',
    ADMIN_TEAM_CHANNEL_ID: 'ADMIN_TEAM_CHANNEL_ID',
    FINANCE_TEAM_CHANNEL_ID: 'FINANCE_TEAM_CHANNEL_ID',
    HR_TEAM_CHANNEL_ID: 'HR_TEAM_CHANNEL_ID',
    IT_TEAM_CHANNEL_ID: 'IT_TEAM_CHANNEL_ID',
    LEGAL_TEAM_CHANNEL_ID: 'LEGAL_TEAM_CHANNEL_ID',
    OPERATIONS_TEAM_CHANNEL_ID: 'OPERATIONS_TEAM_CHANNEL_ID',
    PEOPLE_TEAM_CHANNEL_ID: 'PEOPLE_TEAM_CHANNEL_ID',
    DEFAULT_ASSIGNMENTS_CHANNEL_ID: 'DEFAULT_ASSIGNMENTS_CHANNEL_ID'
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

  function getNumber_(key) {
    var value = Number(getRaw_(key));
    if (isNaN(value)) {
      throw new Error('Script Property ' + key + ' must be a valid number.');
    }
    return value;
  }

  return {
    KEYS: KEYS,

    getOnboardingSpreadsheetId: function () {
      return getString_(KEYS.ONBOARDING_SPREADSHEET_ID);
    },

    getTrainingSpreadsheetId: function () {
      return getString_(KEYS.TRAINING_SPREADSHEET_ID);
    },

    getAuditSpreadsheetId: function () {
      return getString_(KEYS.AUDIT_SPREADSHEET_ID);
    },

    getChecklistSpreadsheetId: function () {
      return getString_(KEYS.CHECKLIST_SPREADSHEET_ID);
    },

    getOnboardingSheetName: function () {
      return getString_(KEYS.ONBOARDING_SHEET_NAME);
    },

    getTrainingSheetName: function () {
      return getString_(KEYS.TRAINING_SHEET_NAME);
    },

    getAuditSheetName: function () {
      return getString_(KEYS.AUDIT_SHEET_NAME);
    },

    getChecklistSheetName: function () {
      return getString_(KEYS.CHECKLIST_SHEET_NAME);
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
    }
  };
})();

if (typeof module !== 'undefined') module.exports = { Config: Config };
