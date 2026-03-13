function mockGasGlobals() {
  global.SpreadsheetApp = { openById: jest.fn() };
  global.UrlFetchApp = { fetch: jest.fn() };
  global.Utilities = { formatDate: jest.fn(), getUuid: jest.fn(), computeDigest: jest.fn(), DigestAlgorithm: {}, Charset: {} };
  global.PropertiesService = { getScriptProperties: jest.fn() };
  global.Logger = { log: jest.fn() };
  global.ScriptApp = { newTrigger: jest.fn() };
}

describe('Recognition', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGasGlobals();
    global.COL = {
      TRAINING: { MODULE_NAME: 3, CELEBRATION_POSTED: 13, LAST_UPDATED_AT: 11 },
      ONBOARDING: { FULL_NAME: 2 }
    };
    global.generateId = jest.fn(() => 'AUD_1');
    global.BlockKit = { recognitionPost: jest.fn(() => []) };
    global.AuditService = jest.fn(() => ({ logRecognitionAction: jest.fn() }));
  });

  test('handleTrainingComplete posts and updates row', () => {
    const row = ['E1', 'M1', 'Security', '', '', '', '', '', '', '', '', '', false];
    const client = {
      findTrainingByEmployeeAndModule: jest.fn(() => ({ values: row })),
      findOnboardingByEmployeeId: jest.fn(() => ({ values: ['E1', 'Alex Doe'] })),
      updateTrainingRecognitionMetadata: jest.fn()
    };
    global.SheetClient = jest.fn(() => client);
    global.SlackClient = jest.fn(() => ({ postMessage: jest.fn() }));

    const { handleTrainingComplete } = require('../../gas/Recognition.gs');
    expect(handleTrainingComplete('E1:M1')).toBe(true);
    expect(client.updateTrainingRecognitionMetadata).toHaveBeenCalledWith('E1', 'M1', true, expect.any(Date));
    expect(global.AuditService).toHaveBeenCalledTimes(1);
  });

  test('routes recognition orchestration through LessonController when available', () => {
    const row = ['E1', 'M1', 'Security', '', '', '', '', '', '', '', '', '', false];
    const client = {
      findTrainingByEmployeeAndModule: jest.fn(() => ({ values: row })),
      findOnboardingByEmployeeId: jest.fn(() => ({ values: ['E1', 'Alex Doe'] })),
      updateTrainingRecognitionMetadata: jest.fn()
    };
    global.SheetClient = jest.fn(() => client);
    global.SlackClient = jest.fn(() => ({ postMessage: jest.fn() }));
    global.LessonController = {
      handleCompletionRecognition: jest.fn()
    };

    const { handleTrainingComplete } = require('../../gas/Recognition.gs');
    handleTrainingComplete('E1:M1');

    expect(global.LessonController.handleCompletionRecognition).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: 'E1',
      moduleCode: 'M1'
    }));
  });
});
