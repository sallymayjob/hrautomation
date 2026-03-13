describe('SlackClient', () => {
  beforeEach(() => {
    jest.resetModules();
    global.Config = { getSlackBotToken: jest.fn(() => 'xoxb-test') };
    global.Utilities = { sleep: jest.fn() };
    global.UrlFetchApp = { fetch: jest.fn() };
  });

  function makeResponse(code, body) {
    return {
      getResponseCode: jest.fn(() => code),
      getContentText: jest.fn(() => JSON.stringify(body || {}))
    };
  }

  test('retries with linear backoff on HTTP 429 and eventually succeeds', () => {
    UrlFetchApp.fetch
      .mockReturnValueOnce(makeResponse(429, { ok: false, error: 'ratelimited' }))
      .mockReturnValueOnce(makeResponse(429, { ok: false, error: 'ratelimited' }))
      .mockReturnValueOnce(makeResponse(200, { ok: true, ts: '123.45' }));

    const { SlackClient } = require('../../gas/SlackClient.gs');
    const client = new SlackClient();

    const result = client.lookupUserByEmail('ada@example.com');

    expect(result).toEqual({ ok: true, ts: '123.45' });
    expect(UrlFetchApp.fetch).toHaveBeenCalledTimes(3);
    expect(Utilities.sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(Utilities.sleep).toHaveBeenNthCalledWith(2, 2000);
  });

  test('throws after max attempts when rate limited continuously', () => {
    UrlFetchApp.fetch
      .mockReturnValueOnce(makeResponse(429, { ok: false, error: 'ratelimited' }))
      .mockReturnValueOnce(makeResponse(429, { ok: false, error: 'ratelimited' }))
      .mockReturnValueOnce(makeResponse(429, { ok: false, error: 'ratelimited' }));

    const { SlackClient } = require('../../gas/SlackClient.gs');
    const client = new SlackClient();

    expect(() => client.lookupUserByEmail('ada@example.com'))
      .toThrow('Slack API request failed for users.lookupByEmail: ratelimited');
    expect(Utilities.sleep).toHaveBeenCalledTimes(2);
  });

  test('throws a stable HTTP-based error when response body is not JSON', () => {
    UrlFetchApp.fetch.mockReturnValue({
      getResponseCode: jest.fn(() => 500),
      getContentText: jest.fn(() => '<<<not-json>>>')
    });

    const { SlackClient } = require('../../gas/SlackClient.gs');
    const client = new SlackClient();

    expect(() => client.lookupUserByEmail('ada@example.com'))
      .toThrow('Slack API request failed for users.lookupByEmail: HTTP_500');
  });
});
