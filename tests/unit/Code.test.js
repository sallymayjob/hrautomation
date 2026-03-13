describe('Code duplicate index', () => {
  test('buildDuplicateIndex_ preloads first row per hash', () => {
    global.computeHash = jest.fn((parts) => parts.join('|'));
    const headers = ['onboarding_id', 'email', 'start_date', 'role', 'manager_email'];
    const rows = [
      ['ONB-1', 'a@example.com', '2026-01-01', 'Engineer', 'mgr@example.com'],
      ['ONB-2', 'a@example.com', '2026-01-01', 'Engineer', 'mgr@example.com']
    ];
    const sheet = {
      getLastRow: jest.fn(() => 3),
      getLastColumn: jest.fn(() => headers.length),
      getRange: jest.fn(() => ({ getValues: jest.fn(() => rows) }))
    };

    const { buildDuplicateIndex_ } = require('../../gas/Code.gs');
    const index = buildDuplicateIndex_(sheet, {
      email: 2,
      start_date: 3,
      role: 4,
      manager_email: 5
    });

    const key = 'a@example.com|2026-01-01|ENGINEER|mgr@example.com';
    expect(index[key]).toBe(2);
  });
});


describe('Code entrypoint routing', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('doPost delegates to commands handler', () => {
    global.handleCommandsPost_ = jest.fn(() => ({ ok: true }));
    const { doPost } = require('../../gas/Code.gs');

    const event = { parameter: { command: '/onboarding-status' } };
    const result = doPost(event);

    expect(global.handleCommandsPost_).toHaveBeenCalledWith(event);
    expect(result).toEqual({ ok: true });
    delete global.handleCommandsPost_;
  });
});
