/* global CacheService, PropertiesService, CoreConstants, Config */
/**
 * @fileoverview Script cache helpers with JSON-safe serialization.
 */

var CacheRepositoryBindings_ = null;
if (typeof module !== 'undefined') {
  CacheRepositoryBindings_ = {
    CoreConstants: require('./CoreConstants.gs').CoreConstants
  };
}

function getCacheNamespaceEnvironment_() {
  try {
    if (Config && typeof Config.getAppEnvironment === 'function') {
      var configured = String(Config.getAppEnvironment() || '').trim();
      if (configured) return configured;
    }
  } catch (err) {}

  try {
    if (PropertiesService && typeof PropertiesService.getScriptProperties === 'function') {
      var env = String(PropertiesService.getScriptProperties().getProperty('APP_ENV') || '').trim();
      if (env) return env;
    }
  } catch (err2) {}

  return 'default';
}

function getCacheNamespaceVersion_() {
  var constants = (typeof CoreConstants !== 'undefined' && CoreConstants) ? CoreConstants : (CacheRepositoryBindings_ && CacheRepositoryBindings_.CoreConstants);
  if (constants && constants.SCHEMA && constants.SCHEMA.LIBRARY_SCHEMA_VERSION) {
    return String(constants.SCHEMA.LIBRARY_SCHEMA_VERSION);
  }
  return 'v1';
}

function getScriptCache_() {
  if (typeof CacheService === 'undefined' || !CacheService || typeof CacheService.getScriptCache !== 'function') {
    return null;
  }
  return CacheService.getScriptCache();
}

function buildScriptCacheKey_(key) {
  var baseKey = String(key || '').trim();
  if (!baseKey) {
    throw new Error('Cache key is required.');
  }
  var env = getCacheNamespaceEnvironment_();
  var version = getCacheNamespaceVersion_();
  return ['hrautomation', env, version, baseKey].join(':');
}

function serializeCacheValue_(value) {
  return JSON.stringify({
    hasValue: true,
    value: value
  });
}

function deserializeCacheValue_(text) {
  if (!text) return null;
  var parsed = JSON.parse(text);
  if (!parsed || !parsed.hasValue) {
    return null;
  }
  return parsed.value;
}

function getOrLoadScriptCache_(key, ttlSeconds, loaderFn) {
  var namespacedKey = buildScriptCacheKey_(key);
  var ttl = Math.max(1, Number(ttlSeconds) || 60);
  var cache = null;

  try {
    cache = getScriptCache_();
    if (cache && typeof cache.get === 'function') {
      var cachedRaw = cache.get(namespacedKey);
      var cachedValue = deserializeCacheValue_(cachedRaw);
      if (cachedRaw !== null && typeof cachedRaw !== 'undefined') {
        return cachedValue;
      }
    }
  } catch (err) {
    // Non-fatal cache read failure. Load fresh data below.
  }

  var loadedValue = loaderFn();

  try {
    if (cache && typeof cache.put === 'function') {
      cache.put(namespacedKey, serializeCacheValue_(loadedValue), ttl);
    }
  } catch (putErr) {
    // Non-fatal cache write failure.
  }

  return loadedValue;
}

if (typeof module !== 'undefined') {
  module.exports = {
    getOrLoadScriptCache_: getOrLoadScriptCache_,
    buildScriptCacheKey_: buildScriptCacheKey_,
    serializeCacheValue_: serializeCacheValue_,
    deserializeCacheValue_: deserializeCacheValue_
  };
}
