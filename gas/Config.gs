/* global PropertiesService */
/**
 * @fileoverview Script property accessors with typed getters.
 */

var Config = (function () {
  var KEYS = {
    SPREADSHEET_ID: 'SPREADSHEET_ID',
    ONBOARDING_SHEET_NAME: 'ONBOARDING_SHEET_NAME',
    TRAINING_SHEET_NAME: 'TRAINING_SHEET_NAME',
    AUDIT_SHEET_NAME: 'AUDIT_SHEET_NAME',
    HR_ALERT_EMAIL: 'HR_ALERT_EMAIL',
    APP_TIMEZONE: 'APP_TIMEZONE',
    RETRY_MAX_ATTEMPTS: 'RETRY_MAX_ATTEMPTS',
    RETRY_DELAY_MS: 'RETRY_DELAY_MS'
  };

  function getRaw_(key) {
    var value = PropertiesService.getScriptProperties().getProperty(key);
    if (value === null || value === '') {
      throw new Error('Missing required Script Property: ' + key);
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

    getSpreadsheetId: function () {
      return getString_(KEYS.SPREADSHEET_ID);
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
    }
  };
})();

if (typeof module !== 'undefined') module.exports = { Config: Config };
