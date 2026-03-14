describe('EnvironmentPreflight', () => {
  beforeEach(() => {
    jest.resetModules();

    global.Config = {
      KEYS: { HR_OPS_ALERTS_CHANNEL_ID: 'HR_OPS_ALERTS_CHANNEL_ID' },
      DATASETS: {
        onboarding: { spreadsheetIdKey: 'ONBOARDING_SPREADSHEET_ID', sheetNameKey: 'ONBOARDING_SHEET_NAME' },
        training: { spreadsheetIdKey: 'TRAINING_SPREADSHEET_ID', sheetNameKey: 'TRAINING_SHEET_NAME' },
        audit: { spreadsheetIdKey: 'AUDIT_SPREADSHEET_ID', sheetNameKey: 'AUDIT_SHEET_NAME', fallbackSpreadsheetIdKey: 'TRAINING_SPREADSHEET_ID' },
        checklist: { spreadsheetIdKey: 'CHECKLIST_SPREADSHEET_ID', sheetNameKey: 'CHECKLIST_SHEET_NAME' },
        lessons: { spreadsheetIdKey: 'LESSONS_SPREADSHEET_ID', sheetNameKey: 'LESSONS_SHEET_NAME' },
        mappings: { spreadsheetIdKey: 'MAPPINGS_SPREADSHEET_ID', sheetNameKey: 'MAPPINGS_SHEET_NAME' },
        approvals: { spreadsheetIdKey: 'APPROVALS_SPREADSHEET_ID', sheetNameKey: 'APPROVALS_SHEET_NAME' },
        submissions: { spreadsheetIdKey: 'SUBMISSIONS_SPREADSHEET_ID', sheetNameKey: 'SUBMISSIONS_SHEET_NAME' }
      },
      isGovernanceEnabled: jest.fn(() => true)
    };

    const props = {
      ONBOARDING_SPREADSHEET_ID: 'onboarding-id',
      ONBOARDING_SHEET_NAME: 'Onboarding',
      TRAINING_SPREADSHEET_ID: 'training-id',
      TRAINING_SHEET_NAME: 'Training',
      AUDIT_SHEET_NAME: 'Audit',
      CHECKLIST_SPREADSHEET_ID: 'checklist-id',
      CHECKLIST_SHEET_NAME: 'Checklist',
      LESSONS_SPREADSHEET_ID: 'training-id',
      LESSONS_SHEET_NAME: 'lessons',
      MAPPINGS_SPREADSHEET_ID: 'training-id',
      MAPPINGS_SHEET_NAME: 'mappings',
      APPROVALS_SPREADSHEET_ID: 'training-id',
      APPROVALS_SHEET_NAME: 'approvals',
      SUBMISSIONS_SPREADSHEET_ID: 'training-id',
      SUBMISSIONS_SHEET_NAME: 'submissions',
      HR_OPS_ALERTS_CHANNEL_ID: 'COPS123'
    };

    global.PropertiesService = {
      getScriptProperties: jest.fn(() => ({
        getProperty: jest.fn((key) => props[key] || '')
      }))
    };

    const sheetsById = {
      'onboarding-id': { name: 'Onboarding Book', tabs: { Onboarding: {} } },
      'training-id': { name: 'Training Book', tabs: { Training: {}, Audit: {}, lessons: {}, mappings: {}, approvals: {}, submissions: {} } },
      'checklist-id': { name: 'Checklist Book', tabs: { Checklist: {} } }
    };

    global.SpreadsheetApp = {
      openById: jest.fn((id) => {
        const record = sheetsById[id];
        if (!record) throw new Error('Unknown id');
        return {
          getName: () => record.name,
          getSheetByName: (tab) => record.tabs[tab] || null
        };
      })
    };

    global.console = { log: jest.fn(), error: jest.fn() };
  });

  test('passes and audits when base and governance datasets are available', () => {
    const auditService = { logEvent: jest.fn() };
    const { runEnvironmentPreflight } = require('../../gas/EnvironmentPreflight.gs');

    const report = runEnvironmentPreflight({ source: 'test', auditService });

    expect(report.ok).toBe(true);
    expect(report.failures).toHaveLength(0);
    expect(auditService.logEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'PREFLIGHT_PASS' }));
  });

  test('fails and sends slack alert when governance dataset is missing while enabled', () => {
    global.PropertiesService.getScriptProperties = jest.fn(() => ({
      getProperty: jest.fn((key) => {
        if (key === 'SUBMISSIONS_SHEET_NAME') return '';
        const base = {
          ONBOARDING_SPREADSHEET_ID: 'onboarding-id', ONBOARDING_SHEET_NAME: 'Onboarding', TRAINING_SPREADSHEET_ID: 'training-id',
          TRAINING_SHEET_NAME: 'Training', AUDIT_SHEET_NAME: 'Audit', CHECKLIST_SPREADSHEET_ID: 'checklist-id', CHECKLIST_SHEET_NAME: 'Checklist',
          LESSONS_SPREADSHEET_ID: 'training-id', LESSONS_SHEET_NAME: 'lessons', MAPPINGS_SPREADSHEET_ID: 'training-id', MAPPINGS_SHEET_NAME: 'mappings',
          APPROVALS_SPREADSHEET_ID: 'training-id', APPROVALS_SHEET_NAME: 'approvals', SUBMISSIONS_SPREADSHEET_ID: 'training-id', HR_OPS_ALERTS_CHANNEL_ID: 'COPS123'
        };
        return base[key] || '';
      })
    }));

    const slackClient = { postMessage: jest.fn() };
    const auditService = { logEvent: jest.fn() };
    const { runEnvironmentPreflight } = require('../../gas/EnvironmentPreflight.gs');

    const report = runEnvironmentPreflight({ source: 'test', auditService, slackClient, governanceEnabled: true });

    expect(report.ok).toBe(false);
    expect(report.failures.some((f) => f.dataset === 'submissions')).toBe(true);
    expect(auditService.logEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'PREFLIGHT_FAIL' }));
    expect(slackClient.postMessage).toHaveBeenCalled();
  });
});
