describe('SecurityUtils', () => {
  beforeEach(() => {
    jest.resetModules();
    global.Config = { getSlackVerificationToken: jest.fn(() => 'verif-token-123') };
  });

  test('verifySlackIngressRequest_ accepts valid command token', () => {
    const { verifySlackIngressRequest_ } = require('../../gas/SecurityUtils.gs');
    const result = verifySlackIngressRequest_({ parameter: { token: 'verif-token-123', command: '/onboarding-status' } }, { route: 'commands' });
    expect(result.ok).toBe(true);
  });


  test('verifySlackIngressRequest_ accepts url_verification challenge without token', () => {
    const { verifySlackIngressRequest_ } = require('../../gas/SecurityUtils.gs');
    const result = verifySlackIngressRequest_(
      {
        postData: {
          type: 'application/json',
          contents: JSON.stringify({ type: 'url_verification', token: '', challenge: 'abc123' })
        },
        parameter: {}
      },
      { route: 'commands' }
    );
    expect(result.ok).toBe(true);
    expect(result.parsedPayload.challenge).toBe('abc123');
  });

  test('verifySlackIngressRequest_ rejects unsupported command shape', () => {
    const { verifySlackIngressRequest_ } = require('../../gas/SecurityUtils.gs');
    const result = verifySlackIngressRequest_({ parameter: { token: 'verif-token-123' } }, { route: 'commands' });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('INVALID_COMMAND_SHAPE');
  });

  test('sanitizeErrorForLog redacts emails and slack ids', () => {
    const { sanitizeErrorForLog } = require('../../gas/SecurityUtils.gs');
    const sanitized = sanitizeErrorForLog(new Error('failed for user@example.com and U123456789'));
    expect(sanitized).toContain('[REDACTED_EMAIL]');
    expect(sanitized).toContain('[REDACTED_SLACK_ID]');
  });
});
