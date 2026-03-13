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

  test('validateMappingConstraints_ validates course/module/lesson existence and order', () => {
    const { validateMappingConstraints_ } = require('../../gas/MappingService.gs');
    expect(() => validateMappingConstraints_({ course_id: 'c1', module_code: 'm1', lesson_id: 'l1' }, {
      courses: [{ course_id: 'c1' }],
      modules: [{ module_code: 'm1', module_order: 1 }],
      lessons: [{ lesson_id: 'l1', module_code: 'm1', lesson_order: 1 }]
    })).not.toThrow();
  });

  test('validateMappingConstraints_ rejects missing lesson or broken ordering', () => {
    const { validateMappingConstraints_ } = require('../../gas/MappingService.gs');
    expect(() => validateMappingConstraints_({ module_code: 'm1', lesson_id: 'missing' }, {
      modules: [{ module_code: 'm1', module_order: 2 }],
      lessons: []
    })).toThrow('lesson does not exist');

    expect(() => validateMappingConstraints_({ module_code: 'm1', lesson_id: 'l1' }, {
      modules: [{ module_code: 'm1', module_order: 4 }],
      lessons: [{ lesson_id: 'l1', module_code: 'm1', lesson_order: 2 }]
    })).toThrow('must not precede');
  });

});
