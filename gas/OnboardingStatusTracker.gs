/**
 * @fileoverview Parser and validator for onboarding status tracker CSV rows.
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
    return [];
  }

  var rows = parseCsvText_(String(csvText));
  return parseOnboardingStatusRows_(rows);
}

function parseOnboardingStatusRows_(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  var headerRow = normalizeRow_(rows[0]);
  validateHeaders_(headerRow);

  var records = [];
  for (var i = 1; i < rows.length; i += 1) {
    var row = normalizeRow_(rows[i]);
    if (isBlankRow_(row)) {
      continue;
    }

    var taskId = row[0];
    var onboardingId = row[1];
    var userId = row[2];
    var employeeName = row[3];
    if (!taskId) {
      throw new Error('Onboarding tracker row ' + (i + 1) + ' is missing required Task_ID.');
    }
    if (!onboardingId) {
      throw new Error('Onboarding tracker row ' + (i + 1) + ' is missing required Onboarding_ID.');
    }
    if (!userId) {
      throw new Error('Onboarding tracker row ' + (i + 1) + ' is missing required User_ID.');
    }
    if (!employeeName) {
      throw new Error('Onboarding tracker row ' + (i + 1) + ' is missing required Employee_Name.');
    }

    var stepStatuses = {};
    for (var s = 0; s < ONBOARDING_STATUS_STEP_HEADERS.length; s += 1) {
      var stepName = ONBOARDING_STATUS_STEP_HEADERS[s];
      var status = row[s + ONBOARDING_STATUS_BASE_HEADERS.length];
      if (ONBOARDING_STATUS_ALLOWED_VALUES.indexOf(status) === -1) {
        throw new Error('Onboarding tracker row ' + (i + 1) + ' has invalid status for "' + stepName + '": ' + status + '. Allowed values: ' + ONBOARDING_STATUS_ALLOWED_VALUES.join(', ') + '.');
      }
      stepStatuses[stepName] = status;
    }

    records.push({
      taskId: taskId,
      onboardingId: onboardingId,
      userId: userId,
      employeeName: employeeName,
      steps: stepStatuses
    });
  }

  return records;
}

function validateHeaders_(headers) {
  if (headers.length !== ONBOARDING_STATUS_HEADERS.length) {
    throw new Error('Onboarding tracker header count mismatch. Expected ' + ONBOARDING_STATUS_HEADERS.length + ' columns but found ' + headers.length + '.');
  }

  for (var i = 0; i < ONBOARDING_STATUS_HEADERS.length; i += 1) {
    if (headers[i] !== ONBOARDING_STATUS_HEADERS[i]) {
      throw new Error('Onboarding tracker header mismatch at column ' + (i + 1) + '. Expected "' + ONBOARDING_STATUS_HEADERS[i] + '" but found "' + headers[i] + '".');
    }
  }
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

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
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
