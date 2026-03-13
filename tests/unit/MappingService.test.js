describe('MappingService', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('buildAuditDedupeKey_ normalizes key parts', () => {
    const { buildAuditDedupeKey_ } = require('../../gas/MappingService.gs');
    expect(buildAuditDedupeKey_(' ONB-1 ', ' UPDATE ', '2026-01-01T00:00:00Z')).toBe('ONB-1|UPDATE|2026-01-01T00:00:00Z');
  });

  test('checkAuditDedupeKey_ flags duplicate keys', () => {
    const { checkAuditDedupeKey_ } = require('../../gas/MappingService.gs');
    const seen = {};

    expect(checkAuditDedupeKey_('ONB-1', 'UPDATE', '2026-01-01T00:00:00Z', seen).duplicate).toBe(false);
    expect(checkAuditDedupeKey_('ONB-1', 'UPDATE', '2026-01-01T00:00:00Z', seen).duplicate).toBe(true);
  });
});
