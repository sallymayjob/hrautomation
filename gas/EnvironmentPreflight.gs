/* global Config, PropertiesService, SpreadsheetApp, AuditService, SheetClient, SlackClient, console */
/**
 * @fileoverview Deployment/runtime environment preflight checks.
 */

var PREFLIGHT_BASE_DATASETS = ['onboarding', 'training', 'audit', 'checklist'];
var PREFLIGHT_GOVERNANCE_DATASETS = ['lessons', 'mappings', 'approvals', 'submissions'];

function runEnvironmentPreflight(options) {
  var opts = options || {};
  var report = {
    ok: true,
    checkedAt: new Date(),
    source: String(opts.source || 'manual'),
    failures: [],
    warnings: [],
    checks: []
  };

  validateDatasetsForPreflight_(PREFLIGHT_BASE_DATASETS, report);
  if (isGovernanceEnabledForPreflight_(opts)) {
    validateDatasetsForPreflight_(PREFLIGHT_GOVERNANCE_DATASETS, report);
  }

  report.ok = report.failures.length === 0;
  emitPreflightReport_(report, opts);
  return report;
}

function isGovernanceEnabledForPreflight_(opts) {
  if (typeof opts.governanceEnabled === 'boolean') {
    return opts.governanceEnabled;
  }
  if (typeof Config !== 'undefined' && Config && typeof Config.isGovernanceEnabled === 'function') {
    return Config.isGovernanceEnabled();
  }
  return true;
}

function validateDatasetsForPreflight_(datasetKeys, report) {
  for (var i = 0; i < datasetKeys.length; i += 1) {
    validateDatasetForPreflight_(datasetKeys[i], report);
  }
}

function validateDatasetForPreflight_(datasetKey, report) {
  var datasetDef = Config && Config.DATASETS ? Config.DATASETS[datasetKey] : null;
  if (!datasetDef) {
    addPreflightFailure_(report, 'DATASET_CONFIG_MISSING', datasetKey, 'Dataset is missing from Config.DATASETS.', 'Add dataset definition in gas/Config.gs.');
    return;
  }

  var spreadsheetIdResult = resolveDatasetConfigValue_(datasetDef.spreadsheetIdKey, datasetDef.fallbackSpreadsheetIdKey, null);
  var sheetNameResult = resolveDatasetConfigValue_(datasetDef.sheetNameKey, null, datasetDef.fallbackSheetName || null);

  if (!spreadsheetIdResult.value) {
    addPreflightFailure_(
      report,
      'SCRIPT_PROPERTY_MISSING',
      datasetKey,
      'Missing spreadsheet id property `' + spreadsheetIdResult.primaryKey + '`' + (spreadsheetIdResult.fallbackKey ? ' (or fallback `' + spreadsheetIdResult.fallbackKey + '`)' : '') + '.',
      'Set Script Property `' + spreadsheetIdResult.primaryKey + '`' + (spreadsheetIdResult.fallbackKey ? ' or `' + spreadsheetIdResult.fallbackKey + '`' : '') + ' to a valid spreadsheet id.'
    );
    return;
  }

  if (!sheetNameResult.value) {
    addPreflightFailure_(
      report,
      'SCRIPT_PROPERTY_MISSING',
      datasetKey,
      'Missing sheet name property `' + sheetNameResult.primaryKey + '`' + (sheetNameResult.fallbackValue ? ' and no fallback sheet name available.' : '.') ,
      'Set Script Property `' + sheetNameResult.primaryKey + '` to a valid tab name.'
    );
    return;
  }

  var spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.openById(spreadsheetIdResult.value);
  } catch (err) {
    addPreflightFailure_(
      report,
      'SPREADSHEET_ACCESS_FAILED',
      datasetKey,
      'Unable to open spreadsheet id `' + spreadsheetIdResult.value + '` for dataset `' + datasetKey + '`.',
      'Verify spreadsheet id, sharing permissions, and Apps Script OAuth scopes. Error: ' + (err && err.message ? err.message : String(err))
    );
    return;
  }

  var sheet = spreadsheet.getSheetByName(sheetNameResult.value);
  if (!sheet) {
    addPreflightFailure_(
      report,
      'SHEET_TAB_MISSING',
      datasetKey,
      'Tab `' + sheetNameResult.value + '` does not exist in spreadsheet `' + spreadsheet.getName() + '`.',
      'Create/rename tab `' + sheetNameResult.value + '` or update Script Property `' + sheetNameResult.primaryKey + '`.'
    );
    return;
  }

  report.checks.push('Dataset `' + datasetKey + '` resolved to spreadsheet `' + spreadsheet.getName() + '` and tab `' + sheetNameResult.value + '`.');
}

function resolveDatasetConfigValue_(primaryKey, fallbackKey, fallbackValue) {
  var primaryValue = getOptionalScriptPropertyForPreflight_(primaryKey);
  if (primaryValue) {
    return { value: primaryValue, primaryKey: primaryKey, fallbackKey: fallbackKey, fallbackValue: fallbackValue };
  }

  if (fallbackKey) {
    var fallbackKeyValue = getOptionalScriptPropertyForPreflight_(fallbackKey);
    if (fallbackKeyValue) {
      return { value: fallbackKeyValue, primaryKey: primaryKey, fallbackKey: fallbackKey, fallbackValue: fallbackValue };
    }
  }

  if (fallbackValue) {
    return { value: fallbackValue, primaryKey: primaryKey, fallbackKey: fallbackKey, fallbackValue: fallbackValue };
  }

  return { value: '', primaryKey: primaryKey, fallbackKey: fallbackKey, fallbackValue: fallbackValue };
}

function getOptionalScriptPropertyForPreflight_(key) {
  if (!key || typeof PropertiesService === 'undefined' || !PropertiesService || typeof PropertiesService.getScriptProperties !== 'function') {
    return '';
  }
  var value = PropertiesService.getScriptProperties().getProperty(key);
  return String(value || '').trim();
}

function addPreflightFailure_(report, code, datasetKey, reason, fix) {
  report.failures.push({
    code: code,
    dataset: datasetKey,
    reason: reason,
    fix: fix
  });
}

function emitPreflightReport_(report, opts) {
  var summary = buildPreflightSummary_(report);
  if (report.ok) {
    console.log(summary);
  } else {
    console.error(summary);
  }

  writePreflightAuditEvent_(report, opts, summary);
  postPreflightSlackAlert_(report, opts, summary);
}

function buildPreflightSummary_(report) {
  if (report.ok) {
    return '[PRECHECK PASS] Environment preflight succeeded (' + report.checks.length + ' checks).';
  }
  var lines = ['[PRECHECK FAIL] Environment preflight failed with ' + report.failures.length + ' issue(s):'];
  for (var i = 0; i < report.failures.length; i += 1) {
    var item = report.failures[i];
    lines.push((i + 1) + '. [' + item.code + '] dataset=' + item.dataset + ' reason=' + item.reason + ' fix=' + item.fix);
  }
  return lines.join('\n');
}

function writePreflightAuditEvent_(report, opts, summary) {
  var auditService = opts.auditService;
  if (!auditService && typeof AuditService !== 'undefined' && AuditService && typeof SheetClient !== 'undefined' && SheetClient) {
    auditService = new AuditService(new SheetClient());
  }

  if (!auditService || typeof auditService.logEvent !== 'function') {
    return;
  }

  auditService.logEvent({
    entityType: 'Environment',
    entityId: 'deployment_preflight',
    action: report.ok ? 'PREFLIGHT_PASS' : 'PREFLIGHT_FAIL',
    details: summary
  });
}

function postPreflightSlackAlert_(report, opts, summary) {
  if (report.ok) {
    return;
  }

  var channelId = String(opts.opsChannelId || getOptionalScriptPropertyForPreflight_((Config && Config.KEYS && Config.KEYS.HR_OPS_ALERTS_CHANNEL_ID) || 'HR_OPS_ALERTS_CHANNEL_ID') || '').trim();
  if (!channelId) {
    return;
  }

  var slackClient = opts.slackClient;
  if (!slackClient && typeof SlackClient !== 'undefined' && SlackClient) {
    slackClient = new SlackClient();
  }
  if (!slackClient || typeof slackClient.postMessage !== 'function') {
    return;
  }

  try {
    slackClient.postMessage(channelId, [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Environment preflight failed*\n```' + summary + '```'
      }
    }]);
  } catch (err) {
    console.error('Failed to send preflight alert to Slack channel ' + channelId + ': ' + (err && err.message ? err.message : String(err)));
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    runEnvironmentPreflight: runEnvironmentPreflight,
    buildPreflightSummary_: buildPreflightSummary_,
    resolveDatasetConfigValue_: resolveDatasetConfigValue_
  };
}

