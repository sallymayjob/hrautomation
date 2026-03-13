/**
 * @fileoverview Mapping checks and key normalization helpers.
 */

function buildAuditDedupeKey_(entityId, action, eventTimestamp) {
  return [
    String(entityId || '').trim(),
    String(action || '').trim(),
    String(eventTimestamp || '').trim()
  ].join('|');
}

function checkAuditDedupeKey_(entityId, action, eventTimestamp, seenKeys) {
  var dedupeMap = seenKeys || {};
  var dedupeKey = buildAuditDedupeKey_(entityId, action, eventTimestamp);
  var duplicate = !!dedupeMap[dedupeKey];
  dedupeMap[dedupeKey] = true;
  return {
    key: dedupeKey,
    duplicate: duplicate
  };
}

function indexByKey_(rows, keyField) {
  var index = {};
  var list = rows || [];
  var keyName = String(keyField || 'id');
  for (var i = 0; i < list.length; i += 1) {
    var row = list[i] || {};
    var key = String(row[keyName] || '');
    if (!key) continue;
    index[key] = row;
  }
  return index;
}

function validateMappingConstraints_(payload, context) {
  var candidate = payload || {};
  var cfg = context || {};
  var courseKey = String(candidate.course_id || candidate.course_key || '');
  var moduleKey = String(candidate.module_code || candidate.module_id || '');
  var lessonKey = String(candidate.lesson_id || candidate.lesson_key || '');

  var courses = indexByKey_(cfg.courses || [], cfg.courseKeyField || 'course_id');
  var modules = indexByKey_(cfg.modules || [], cfg.moduleKeyField || 'module_code');
  var lessons = indexByKey_(cfg.lessons || [], cfg.lessonKeyField || 'lesson_id');

  if (courseKey && !courses[courseKey]) {
    throw new Error('Mapping validation failed: course does not exist (' + courseKey + ').');
  }
  if (moduleKey && !modules[moduleKey]) {
    throw new Error('Mapping validation failed: module does not exist (' + moduleKey + ').');
  }
  if (lessonKey && !lessons[lessonKey]) {
    throw new Error('Mapping validation failed: lesson does not exist (' + lessonKey + ').');
  }

  var moduleRow = modules[moduleKey] || {};
  var lessonRow = lessons[lessonKey] || {};
  var lessonModule = String(lessonRow[cfg.lessonModuleField || 'module_code'] || '');
  if (lessonKey && moduleKey && lessonModule && lessonModule !== moduleKey) {
    throw new Error('Mapping validation failed: lesson ' + lessonKey + ' does not belong to module ' + moduleKey + '.');
  }

  var moduleOrder = Number(moduleRow[cfg.moduleOrderField || 'module_order']);
  var lessonOrder = Number(lessonRow[cfg.lessonOrderField || 'lesson_order']);
  if (isFinite(moduleOrder) && isFinite(lessonOrder) && moduleOrder > lessonOrder) {
    throw new Error('Mapping validation failed: lesson order must not precede module order.');
  }

  return true;
}

var MappingService = {
  buildAuditDedupeKey_: buildAuditDedupeKey_,
  checkAuditDedupeKey_: checkAuditDedupeKey_,
  validateMappingConstraints_: validateMappingConstraints_
};

if (typeof module !== 'undefined') module.exports = MappingService;
