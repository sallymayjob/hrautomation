describe('GeminiService', () => {
  beforeEach(() => {
    jest.resetModules();
    global.Config = {
      isGovernanceEnabled: jest.fn(() => true)
    };
  });

  test('returns needs_clarification when governed fields missing', () => {
    const GeminiService = require('../../gas/GeminiService.gs');
    const result = GeminiService.validateAndClarify({
      action: 'lesson_create',
      entity_type: 'lesson',
      payload: {}
    });

    expect(result.status).toBe('needs_clarification');
  });

  test('returns rejected when governance disabled', () => {
    global.Config.isGovernanceEnabled.mockReturnValue(false);
    const GeminiService = require('../../gas/GeminiService.gs');
    const result = GeminiService.validateAndClarify({
      action: 'enroll_single',
      trace_id: 'TRACE-1',
      entity_key: 'course:1',
      payload: {}
    });

    expect(result.status).toBe('rejected');
  });

  test('returns valid_proposal for complete payload', () => {
    const GeminiService = require('../../gas/GeminiService.gs');
    const result = GeminiService.validateAndClarify({
      action: 'lesson_create',
      trace_id: 'TRACE-1',
      entity_type: 'lesson',
      entity_key: 'lesson:L1',
      payload: { lesson_id: 'L1' }
    });

    expect(result.status).toBe('valid_proposal');
  });
});
