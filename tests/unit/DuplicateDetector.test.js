describe('DuplicateDetector', () => {
  beforeEach(() => {
    jest.resetModules();
    global.Utilities = {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: jest.fn(() => [1, 2, 3])
    };
  });

  test('detectDuplicate_ flags active duplicate with same tuple and content hash', () => {
    const { computeHash } = require('../../gas/Utils.gs');
    global.computeHash = computeHash;
    const detector = require('../../gas/DuplicateDetector.gs');

    const proposal = {
      entity_type: 'lesson',
      entity_key: 'lesson:1',
      action: 'lesson_edit',
      payload: { title: 'A' }
    };

    const existing = [{
      entity_type: 'lesson',
      entity_key: 'lesson:1',
      action: 'lesson_edit',
      payload: { title: 'A' },
      active: true
    }];

    const result = detector.detectDuplicate_(proposal, existing);
    expect(result.duplicate).toBe(true);
  });

  test('detectDuplicate_ ignores inactive rows', () => {
    const detector = require('../../gas/DuplicateDetector.gs');
    const result = detector.detectDuplicate_(
      { entity_type: 'lesson', entity_key: 'lesson:1', action: 'lesson_edit', payload: { title: 'A' } },
      [{ entity_type: 'lesson', entity_key: 'lesson:1', action: 'lesson_edit', payload: { title: 'A' }, active: false }]
    );

    expect(result.duplicate).toBe(false);
  });
});
