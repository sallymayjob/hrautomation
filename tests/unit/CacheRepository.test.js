describe('CacheRepository', () => {
  beforeEach(() => {
    jest.resetModules();
    global.CoreConstants = { SCHEMA: { LIBRARY_SCHEMA_VERSION: 'schema_v1' } };
    global.Config = {};
    global.PropertiesService = {
      getScriptProperties: jest.fn(() => ({
        getProperty: jest.fn((key) => (key === 'APP_ENV' ? 'test' : ''))
      }))
    };
  });

  test('returns cached value when present and does not invoke loader', () => {
    const cache = {
      get: jest.fn(() => JSON.stringify({ hasValue: true, value: { userId: 'U1' } })),
      put: jest.fn()
    };
    global.CacheService = { getScriptCache: jest.fn(() => cache) };

    const { getOrLoadScriptCache_ } = require('../../gas/CacheRepository.gs');
    const loader = jest.fn(() => ({ userId: 'U2' }));

    const result = getOrLoadScriptCache_('slack_user_by_email:person@example.com', 120, loader);

    expect(result).toEqual({ userId: 'U1' });
    expect(loader).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
    expect(cache.get).toHaveBeenCalledWith('hrautomation:test:schema_v1:slack_user_by_email:person@example.com');
  });

  test('loads and stores when cache is empty', () => {
    const cache = {
      get: jest.fn(() => null),
      put: jest.fn()
    };
    global.CacheService = { getScriptCache: jest.fn(() => cache) };

    const { getOrLoadScriptCache_ } = require('../../gas/CacheRepository.gs');

    const result = getOrLoadScriptCache_('header_map:sheet1', 60, () => ({ employee_id: 1 }));

    expect(result).toEqual({ employee_id: 1 });
    expect(cache.put).toHaveBeenCalledWith(
      'hrautomation:test:schema_v1:header_map:sheet1',
      JSON.stringify({ hasValue: true, value: { employee_id: 1 } }),
      60
    );
  });

  test('cache read failures are non-fatal and fall back to loader', () => {
    global.CacheService = {
      getScriptCache: jest.fn(() => ({
        get: jest.fn(() => { throw new Error('cache down'); }),
        put: jest.fn()
      }))
    };

    const { getOrLoadScriptCache_ } = require('../../gas/CacheRepository.gs');

    expect(getOrLoadScriptCache_('anything', 60, () => 'fresh')).toBe('fresh');
  });
});
