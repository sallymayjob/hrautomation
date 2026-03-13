/**
 * @fileoverview Strict parser and validator for onboarding status tracker CSV rows.
 */

var ONBOARDING_STATUS_BASE_HEADERS = ['Task_ID', 'Onboarding_ID', 'User_ID', 'Employee_Name'];
var ONBOARDING_STATUS_STEP_HEADERS = [
  'Have you emailed the Letter of Offer (L.O.O) to new employee',
  'Have you prepared and emailed the Employment contract to the new employee',
  'GMAIL: Email Address & Password Set-up & Tested',
  'GMAIL: Email Address & Password Tested',
  'GMAIL: Add to Distribution List',
  'GMAIL: Would you like to delegate their inbox to yours?',
  'GMAIL: Sign into the new account and test that the email signature is correct',
  'ADMIN: All new employee information completed in Admin Console',
  'DRIVE: Remove all documents off Drive – Save in RWR Head Office File',
  'DRIVE: Added to appropriate brand folder',
  'New Signature Set-up',
  'Add the following bookmarks: Gmail, Calendar, Drive, JobAdder, Slack',
  'Add the Jobadder / People Adder extension',
  'Salesforce Account Set-up',
  'Salesforce Remove all employee documents',
  'Salesforce Ad quota assigned to new employee',
  'Slack Account Created',
  'Added to correct channels',
  'Test Slack logins',
  'Add to New Employee Channel',
  'Send Pre-Onboarding Pack to new employee’s home address - First 24 Hours',
  'Create Login Details',
  'Load New Employee in Slack',
  'Send Welcome Email with Slack details and how to log in to new employee cc: Manager',
  'Send Manager New Employee Set Up Welcome email (contact details & logins)',
  'Add Start date, Anniversary, and Birthday to CEO, Operations and Franchisee Calendar',
  'Seek Premium: Account Set-up',
  'Trade Me Scout: Account Set-up (NZ ONLY)',
  'MARKETING: Reminder set for E-newsletter',
  'Bio & Photo added to Website',
  'Added to Xero (corporate only)',
  'Payroll Spreadsheet (corporate only)',
  'Added to Results Spreadsheet',
  'Granted Access to update L&H'
];
var ONBOARDING_STATUS_ALLOWED_VALUES = ['Pending', 'In Progress', 'Completed'];
var ONBOARDING_STATUS_HEADERS = ONBOARDING_STATUS_BASE_HEADERS.concat(ONBOARDING_STATUS_STEP_HEADERS);

function getOnboardingStatusHeaders() {
  return ONBOARDING_STATUS_HEADERS.slice();
}

function getOnboardingStatusStepHeaders() {
  return ONBOARDING_STATUS_STEP_HEADERS.slice();
}

function parseOnboardingStatusCsv(csvText) {
  if (csvText === null || csvText === undefined || String(csvText).trim() === '') {
    return buildParseResult_([], []);
  }

  var parsedCsv = parseCsvText_(String(csvText));
  if (parsedCsv.error) {
    return buildParseResult_([], [parsedCsv.error]);
  }

  return parseOnboardingStatusRows_(parsedCsv.rows);
}

function parseOnboardingStatusRows_(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return buildParseResult_([], []);
  }

  var errors = [];
  var headerRow = normalizeRow_(rows[0]);
  errors = errors.concat(validateHeaders_(headerRow));
  if (errors.length > 0) {
    return buildParseResult_([], errors);
  }

  var records = [];
  for (var i = 1; i < rows.length; i += 1) {
    var rowNumber = i + 1;
    var row = normalizeRow_(rows[i]);
    if (isBlankRow_(row)) {
      continue;
    }

    var rowErrors = validateRequiredFields_(row, rowNumber);
    rowErrors = rowErrors.concat(validateStatuses_(row, rowNumber));
    if (rowErrors.length > 0) {
      errors = errors.concat(rowErrors);
      continue;
    }

    var stepStatuses = {};
    for (var s = 0; s < ONBOARDING_STATUS_STEP_HEADERS.length; s += 1) {
      var stepName = ONBOARDING_STATUS_STEP_HEADERS[s];
      stepStatuses[stepName] = row[s + ONBOARDING_STATUS_BASE_HEADERS.length];
    }

    records.push({
      rowNumber: rowNumber,
      taskId: row[0],
      onboardingId: row[1],
      userId: row[2],
      employeeName: row[3],
      steps: stepStatuses
    });
  }

  return buildParseResult_(records, errors);
}

function buildParseResult_(records, errors) {
  return {
    records: Array.isArray(records) ? records : [],
    errors: Array.isArray(errors) ? errors : [],
    isValid: Array.isArray(errors) ? errors.length === 0 : true
  };
}

function buildError_(props) {
  return {
    code: props.code,
    message: props.message,
    row: props.row || null,
    column: props.column || null,
    header: props.header || null,
    value: props.value === undefined ? null : props.value,
    expected: props.expected || null,
    allowedValues: props.allowedValues || null
  };
}

function validateHeaders_(headers) {
  var errors = [];

  if (headers.length !== ONBOARDING_STATUS_HEADERS.length) {
    errors.push(buildError_({
      code: 'HEADER_COUNT_MISMATCH',
      message: 'Onboarding tracker header count mismatch. Expected ' + ONBOARDING_STATUS_HEADERS.length + ' columns but found ' + headers.length + '.',
      row: 1,
      expected: ONBOARDING_STATUS_HEADERS.length,
      value: headers.length
    }));
    return errors;
  }

  for (var i = 0; i < ONBOARDING_STATUS_HEADERS.length; i += 1) {
    if (headers[i] !== ONBOARDING_STATUS_HEADERS[i]) {
      errors.push(buildError_({
        code: 'HEADER_MISMATCH',
        message: 'Onboarding tracker header mismatch at column ' + (i + 1) + '. Expected "' + ONBOARDING_STATUS_HEADERS[i] + '" but found "' + headers[i] + '".',
        row: 1,
        column: i + 1,
        header: headers[i],
        expected: ONBOARDING_STATUS_HEADERS[i],
        value: headers[i]
      }));
    }
  }

  return errors;
}

function validateRequiredFields_(row, rowNumber) {
  var requiredHeaders = ONBOARDING_STATUS_BASE_HEADERS;
  var errors = [];

  for (var i = 0; i < requiredHeaders.length; i += 1) {
    var value = row[i];
    if (!value) {
      errors.push(buildError_({
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Onboarding tracker row ' + rowNumber + ' is missing required ' + requiredHeaders[i] + '.',
        row: rowNumber,
        column: i + 1,
        header: requiredHeaders[i],
        value: value
      }));
    }
  }

  return errors;
}

function validateStatuses_(row, rowNumber) {
  var errors = [];
  for (var s = 0; s < ONBOARDING_STATUS_STEP_HEADERS.length; s += 1) {
    var colIndex = s + ONBOARDING_STATUS_BASE_HEADERS.length;
    var status = row[colIndex];
    if (ONBOARDING_STATUS_ALLOWED_VALUES.indexOf(status) === -1) {
      errors.push(buildError_({
        code: 'INVALID_STATUS',
        message: 'Onboarding tracker row ' + rowNumber + ' has invalid status for "' + ONBOARDING_STATUS_STEP_HEADERS[s] + '": ' + status + '. Allowed values: ' + ONBOARDING_STATUS_ALLOWED_VALUES.join(', ') + '.',
        row: rowNumber,
        column: colIndex + 1,
        header: ONBOARDING_STATUS_STEP_HEADERS[s],
        value: status,
        allowedValues: ONBOARDING_STATUS_ALLOWED_VALUES.slice()
      }));
    }
  }
  return errors;
}

function normalizeRow_(row) {
  var normalized = [];
  var cells = Array.isArray(row) ? row : [];
  for (var i = 0; i < ONBOARDING_STATUS_HEADERS.length; i += 1) {
    normalized.push(String(cells[i] === null || cells[i] === undefined ? '' : cells[i]).trim());
  }
  return normalized;
}

function isBlankRow_(row) {
  for (var i = 0; i < row.length; i += 1) {
    if (row[i] !== '') {
      return false;
    }
  }
  return true;
}

function parseCsvText_(text) {
  var rows = [];
  var currentRow = [];
  var currentCell = '';
  var inQuotes = false;

  for (var i = 0; i < text.length; i += 1) {
    var char = text[i];
    var next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  if (inQuotes) {
    return {
      rows: [],
      error: buildError_({
        code: 'MALFORMED_CSV',
        message: 'Malformed CSV: unmatched quote found while parsing onboarding status tracker data.',
        row: rows.length + 1
      })
    };
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return { rows: rows, error: null };
}

if (typeof module !== 'undefined') module.exports = {
  ONBOARDING_STATUS_BASE_HEADERS: ONBOARDING_STATUS_BASE_HEADERS,
  ONBOARDING_STATUS_STEP_HEADERS: ONBOARDING_STATUS_STEP_HEADERS,
  ONBOARDING_STATUS_ALLOWED_VALUES: ONBOARDING_STATUS_ALLOWED_VALUES,
  ONBOARDING_STATUS_HEADERS: ONBOARDING_STATUS_HEADERS,
  getOnboardingStatusHeaders: getOnboardingStatusHeaders,
  getOnboardingStatusStepHeaders: getOnboardingStatusStepHeaders,
  parseOnboardingStatusCsv: parseOnboardingStatusCsv,
  parseOnboardingStatusRows_: parseOnboardingStatusRows_
};
