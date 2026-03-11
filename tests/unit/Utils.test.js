function mockGasGlobals() {
  global.SpreadsheetApp = { openById: jest.fn() };
  global.UrlFetchApp = { fetch: jest.fn() };
  global.Utilities = {
    formatDate: jest.fn(),
    getUuid: jest.fn(),
    computeDigest: jest.fn(),
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    sleep: jest.fn()
  };
  global.PropertiesService = { getScriptProperties: jest.fn() };
  global.Logger = { log: jest.fn() };
  global.ScriptApp = { newTrigger: jest.fn() };
}

describe('Utils', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGasGlobals();
    global.Session = { getActiveUser: () => ({ getEmail: () => 'actor@example.com' }) };
    global.MailApp = { sendEmail: jest.fn() };
    global.Config = { getHrAlertEmail: jest.fn(() => 'alerts@example.com') };
    global.console = { error: jest.fn() };
    Utilities.formatDate.mockReturnValue('20260101T000000Z');
    Utilities.getUuid.mockReturnValue('12345678-aaaa');
  });

  test('generateId uses prefix and uuid suffix', () => {
    Utilities.formatDate.mockReturnValue('20260101T000000Z');
    Utilities.getUuid.mockReturnValue('12345678-aaaa');
    const { generateId } = require('../../gas/Utils.gs');
    expect(generateId('AUD')).toBe('AUD_20260101T000000Z_12345678');
  });

  test('computeHash maps bytes to hex', () => {
    Utilities.computeDigest.mockReturnValue([15, -1]);
    const { computeHash } = require('../../gas/Utils.gs');
    expect(computeHash(['a', null, 'b'])).toBe('0fff');
  });

  test('getDaysUntilDue returns null and throws on invalid date', () => {
    const { getDaysUntilDue } = require('../../gas/Utils.gs');
    expect(getDaysUntilDue(null)).toBeNull();
    expect(() => getDaysUntilDue('not-a-date')).toThrow('Invalid due date');
  });

  test('AuditLogger.log and error write audit rows', () => {
    Utilities.computeDigest.mockReturnValue([1]);
    const { AuditLogger } = require('../../gas/Utils.gs');
    const client = { appendAuditRow: jest.fn() };
    const logger = new AuditLogger(client);
    logger.log({ entityType: 'Training', entityId: '1', action: 'UPDATE' });
    logger.error({ entityType: 'Training', entityId: '1', details: 'bad' }, new Error('boom'));
    expect(client.appendAuditRow).toHaveBeenCalledTimes(2);
  });

  test('notifyHrAlerts catches send failures', () => {
    MailApp.sendEmail.mockImplementation(() => { throw new Error('mail down'); });
    const { notifyHrAlerts } = require('../../gas/Utils.gs');
    notifyHrAlerts('message');
    expect(console.error).toHaveBeenCalled();
  });
});
