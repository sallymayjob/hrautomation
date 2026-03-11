/* global SheetClient, SlackClient, AuditLogger, BlockKit, computeHash, generateId, console */
/**
 * @fileoverview Main trigger handlers for onboarding processing.
 */

var ONBOARDING_SHEET_NAME = 'Onboarding';
var STATUS = {
  PENDING: 'PENDING',
  DUPLICATE: 'DUPLICATE',
  FAILED: 'FAILED',
  DM_SENT: 'DM_SENT'
};

var ROLE_MAPPINGS = {
  DEFAULT: {
    probationDays: 90,
    resources: [
      { moduleCode: 'ORG-101', moduleName: 'Company Orientation', dueOffsetDays: 7 },
      { moduleCode: 'SEC-101', moduleName: 'Security Awareness', dueOffsetDays: 14 }
    ]
  },
  ENGINEER: {
    probationDays: 90,
    resources: [
      { moduleCode: 'ENG-101', moduleName: 'Engineering Onboarding', dueOffsetDays: 5 },
      { moduleCode: 'SEC-101', moduleName: 'Security Awareness', dueOffsetDays: 14 }
    ]
  },
  MANAGER: {
    probationDays: 120,
    resources: [
      { moduleCode: 'MGR-101', moduleName: 'People Leadership Essentials', dueOffsetDays: 10 },
      { moduleCode: 'SEC-101', moduleName: 'Security Awareness', dueOffsetDays: 14 }
    ]
  }
};

function onChangeHandler(e) {
  var sheet = e && e.source && e.source.getActiveSheet ? e.source.getActiveSheet() : null;
  if (!sheet || sheet.getName() !== ONBOARDING_SHEET_NAME) {
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return;
  }

  for (var rowIndex = 2; rowIndex <= lastRow; rowIndex += 1) {
    var headerMap = getHeaderMap_(sheet);
    var statusValue = String(sheet.getRange(rowIndex, headerMap.status).getValue() || '').trim().toUpperCase();
    if (statusValue !== STATUS.PENDING) {
      continue;
    }
    processOnboardingRow_(sheet, rowIndex);
  }
}

function processOnboardingRow_(sheet, rowIndex) {
  var sheetClient = new SheetClient();
  var auditLogger = new AuditLogger(sheetClient);
  var slackClient = new SlackClient(auditLogger);
  var headerMap = getHeaderMap_(sheet);

  try {
    var rowValues = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    var rowData = toRowObject_(rowValues, headerMap);

    var rowHash = computeHash([
      rowData.employee_id,
      rowData.email,
      formatDateKey_(rowData.start_date),
      rowData.role_title,
      rowData.manager_email
    ]);
    setValueIfColumnExists_(sheet, rowIndex, headerMap, 'row_hash', rowHash);

    var duplicateRow = sheetClient.checkDuplicate(ONBOARDING_SHEET_NAME, 'row_hash', rowHash, rowIndex);
    if (duplicateRow > -1) {
      setStatus_(sheet, rowIndex, headerMap, STATUS.DUPLICATE);
      auditLogger.log({
        entityType: 'Onboarding',
        entityId: String(rowData.employee_id || rowIndex),
        action: 'UPDATE',
        details: 'Marked as duplicate. Matched row index ' + duplicateRow + '.'
      });
      return;
    }

    var managerSlackId = '';
    if (rowData.manager_email) {
      var managerLookup = slackClient.lookupUserByEmail(rowData.manager_email);
      managerSlackId = managerLookup && managerLookup.user && managerLookup.user.id ? managerLookup.user.id : '';
      setValueIfColumnExists_(sheet, rowIndex, headerMap, 'manager_slack_id', managerSlackId);
    }

    var roleMapping = getRoleMapping_(rowData.role_title);
    var startDate = parseDateValue_(rowData.start_date);
    var employeeLookup = slackClient.lookupUserByEmail(rowData.email);
    var employeeSlackId = employeeLookup && employeeLookup.user && employeeLookup.user.id ? employeeLookup.user.id : '';
    if (!employeeSlackId) {
      throw new Error('Unable to resolve employee Slack ID for email: ' + rowData.email);
    }

    slackClient.postMessage(employeeSlackId, BlockKit.welcomeDM({
      firstName: getFirstName_(rowData.full_name),
      startDate: formatDateKey_(startDate),
      managerName: rowData.manager_name || rowData.manager_email || 'TBD'
    }));

    for (var i = 0; i < roleMapping.resources.length; i += 1) {
      var resource = roleMapping.resources[i];
      var dueDate = computeDueDate_(startDate, roleMapping.probationDays, resource.dueOffsetDays);
      sheetClient.appendTrainingRow([
        rowData.employee_id,
        resource.moduleCode,
        resource.moduleName,
        new Date(),
        dueDate,
        '',
        'ASSIGNED',
        rowData.manager_email || '',
        0,
        '',
        new Date(),
        computeHash([rowData.employee_id, resource.moduleCode, formatDateKey_(dueDate)]),
        false
      ]);
    }

    var onboardingId = rowData.onboarding_id || generateId('ONB');
    setValueIfColumnExists_(sheet, rowIndex, headerMap, 'onboarding_id', onboardingId);
    setValueIfColumnExists_(sheet, rowIndex, headerMap, 'dm_sent_at', new Date());
    setValueIfColumnExists_(sheet, rowIndex, headerMap, 'processed_at', new Date());
    setStatus_(sheet, rowIndex, headerMap, STATUS.DM_SENT);

    auditLogger.log({
      entityType: 'Onboarding',
      entityId: onboardingId,
      action: 'UPDATE',
      details: 'Onboarding processed successfully for employee_id=' + rowData.employee_id + '.'
    });
  } catch (err) {
    setStatus_(sheet, rowIndex, headerMap, STATUS.FAILED);
    setValueIfColumnExists_(sheet, rowIndex, headerMap, 'error_message', String(err && err.message ? err.message : err));
    console.error('Onboarding processing failed for row ' + rowIndex + ': ' + err);
    auditLogger.error({
      entityType: 'Onboarding',
      entityId: 'row_' + rowIndex,
      action: 'UPDATE',
      details: 'Onboarding processing failed.'
    }, err);
  }
}

function getRoleMapping_(roleTitle) {
  var key = String(roleTitle || '').trim().toUpperCase();
  return ROLE_MAPPINGS[key] || ROLE_MAPPINGS.DEFAULT;
}

function computeDueDate_(startDate, probationDays, dueOffsetDays) {
  var offset = typeof dueOffsetDays === 'number' ? dueOffsetDays : probationDays;
  var dueDate = new Date(startDate.getTime());
  dueDate.setDate(dueDate.getDate() + offset);
  return dueDate;
}

function getHeaderMap_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i += 1) {
    var key = normalizeKey_(headers[i]);
    if (key) {
      map[key] = i + 1;
    }
  }
  if (!map.status) {
    throw new Error('Onboarding sheet is missing required status column.');
  }
  return map;
}

function toRowObject_(rowValues, headerMap) {
  var row = {};
  Object.keys(headerMap).forEach(function (key) {
    row[key] = rowValues[headerMap[key] - 1];
  });
  return row;
}

function setStatus_(sheet, rowIndex, headerMap, statusValue) {
  sheet.getRange(rowIndex, headerMap.status).setValue(statusValue);
  setValueIfColumnExists_(sheet, rowIndex, headerMap, 'last_updated_at', new Date());
}

function setValueIfColumnExists_(sheet, rowIndex, headerMap, key, value) {
  if (headerMap[key]) {
    sheet.getRange(rowIndex, headerMap[key]).setValue(value);
  }
}

function normalizeKey_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseDateValue_(value) {
  if (value instanceof Date) {
    return value;
  }
  var parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    throw new Error('Invalid start_date value: ' + value);
  }
  return parsed;
}

function formatDateKey_(dateValue) {
  var date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

function getFirstName_(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || '';
}

if (typeof module !== 'undefined') {
  module.exports = {
    onChangeHandler: onChangeHandler,
    processOnboardingRow_: processOnboardingRow_
  };
}
