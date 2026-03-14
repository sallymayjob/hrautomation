/* global PropertiesService */
/**
 * @fileoverview Reusable script-property accessor helpers for Config-style modules.
 */

function getPropertyStore_() {
  return PropertiesService.getScriptProperties();
}

function getRawProperty_(key) {
  var value = getPropertyStore_().getProperty(key);
  if (value === null || value === '') {
    throw new Error('Missing required Script Property: ' + key + '. Configure it in Apps Script > Project Settings > Script Properties.');
  }
  return value;
}

function getStringProperty_(key) {
  return String(getRawProperty_(key));
}

function getOptionalStringProperty_(key) {
  var value = getPropertyStore_().getProperty(key);
  if (value === null || value === '') return '';
  return String(value);
}

function getBooleanProperty_(key, fallback) {
  var value = getOptionalStringProperty_(key);
  if (!value) return Boolean(fallback);
  var normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function getNumberProperty_(key) {
  var value = Number(getRawProperty_(key));
  if (isNaN(value)) {
    throw new Error('Script Property ' + key + ' must be a valid number.');
  }
  return value;
}

function createDatasetResolver_(datasets) {
  function getDataset_(datasetKey) {
    var dataset = datasets[datasetKey];
    if (!dataset) throw new Error('Unknown dataset key: ' + datasetKey);
    return dataset;
  }

  return {
    getDatasetSpreadsheetId: function (datasetKey) {
      var dataset = getDataset_(datasetKey);
      var value = getOptionalStringProperty_(dataset.spreadsheetIdKey);
      if (value) return value;
      if (dataset.fallbackSpreadsheetIdKey) return getStringProperty_(dataset.fallbackSpreadsheetIdKey);
      return getStringProperty_(dataset.spreadsheetIdKey);
    },

    getDatasetSheetName: function (datasetKey) {
      var dataset = getDataset_(datasetKey);
      var value = getOptionalStringProperty_(dataset.sheetNameKey);
      if (value) return value;
      if (dataset.fallbackSheetName) return dataset.fallbackSheetName;
      return getStringProperty_(dataset.sheetNameKey);
    }
  };
}

var LibraryConfigService = {
  getRawProperty_: getRawProperty_,
  getStringProperty_: getStringProperty_,
  getOptionalStringProperty_: getOptionalStringProperty_,
  getBooleanProperty_: getBooleanProperty_,
  getNumberProperty_: getNumberProperty_,
  createDatasetResolver_: createDatasetResolver_
};

if (typeof module !== 'undefined') module.exports = { LibraryConfigService: LibraryConfigService };
