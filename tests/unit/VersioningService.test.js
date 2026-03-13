describe('VersioningService', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('calculateNextVersion_ increments max historical version for matching key', () => {
    const svc = require('../../gas/VersioningService.gs');
    const rows = [
      { entity_key: 'lesson:1', version: 1 },
      { entity_key: 'lesson:1', version: 3 },
      { entity_key: 'lesson:2', version: 9 }
    ];

    expect(svc.calculateNextVersion_(rows, 'entity_key', 'lesson:1', 'version')).toBe(4);
  });

  test('assertImmutableHistoricalRows_ rejects duplicate historical versions', () => {
    const svc = require('../../gas/VersioningService.gs');
    const rows = [
      { entity_key: 'lesson:1', version: 1 },
      { entity_key: 'lesson:1', version: 1 }
    ];

    expect(() => svc.assertImmutableHistoricalRows_(rows, 'entity_key', 'lesson:1', 2, 'version')).toThrow('immutable');
  });
});
