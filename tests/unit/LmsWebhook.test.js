function mockGasGlobals() {
  global.ContentService = {
    MimeType: { JSON: 'application/json' },
    createTextOutput: jest.fn((value) => ({
      value,
      setMimeType: jest.fn(function () {
        return this;
      })
    }))
  };
}

describe('LmsWebhook', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGasGlobals();
    global.AuditLogger = jest.fn(() => ({ log: jest.fn() }));
    global.SheetClient = jest.fn(() => ({}));
    delete global.LmsRoutes;
  });

  test('validateLmsHandshake_ rejects non workflow-builder handshakes', () => {
    const { validateLmsHandshake_ } = require('../../gas/LmsWebhook.gs');

    const result = validateLmsHandshake_({ source: 'slash_command', action: 'create_course' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_HANDSHAKE_SOURCE');
  });

  test('doPostLms accepts workflow builder payload and routes action', () => {
    const { doPostLms } = require('../../gas/LmsWebhook.gs');

    const output = doPostLms({
      postData: {
        contents: JSON.stringify({
          source: 'slack_workflow_builder',
          action: 'create_course',
          actor_slack_id: 'U123'
        })
      }
    });

    expect(global.ContentService.createTextOutput).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(output.value);
    expect(payload.ok).toBe(true);
    expect(payload.action).toBe('create_course');
    expect(payload.data.queued).toBe(true);
  });

  test('routeLmsAction_ uses LmsRoutes adapter when available', () => {
    const { routeLmsAction_ } = require('../../gas/LmsWebhook.gs');

    global.LmsRoutes = {
      enrollLearner: jest.fn(() => ({ enrollment_id: 'ENR-1', status: 'active' }))
    };

    const result = routeLmsAction_({
      source: 'slack_workflow_builder',
      action: 'enroll_single',
      actor_slack_id: 'UHR1'
    });

    expect(global.LmsRoutes.enrollLearner).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.data.enrollment_id).toBe('ENR-1');
  });
});
