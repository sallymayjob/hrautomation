const fs = require('fs');
const path = require('path');

describe('OnboardingStatusTracker', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('loads and parses onboarding status tracker CSV fixture', () => {
    const {
      parseOnboardingStatusCsv,
      ONBOARDING_STATUS_STEP_HEADERS
    } = require('../../gas/OnboardingStatusTracker.gs');

    const csvPath = path.join(__dirname, '../../sheets/onboarding-status-tracker.csv');
    const csvText = fs.readFileSync(csvPath, 'utf8');
    const result = parseOnboardingStatusCsv(csvText);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toEqual(expect.objectContaining({
      rowNumber: 2,
      taskId: 'TSK-001',
      onboardingId: 'ONB-001',
      userId: 'USR-001',
      employeeName: 'Ava Thompson'
    }));
    expect(Object.keys(result.records[0].steps)).toHaveLength(34);
    expect(result.records[0].steps[ONBOARDING_STATUS_STEP_HEADERS[0]]).toBe('Completed');
    expect(result.records[0].steps[ONBOARDING_STATUS_STEP_HEADERS[6]]).toBe('In Progress');
    expect(result.records[0].steps[ONBOARDING_STATUS_STEP_HEADERS[33]]).toBe('Pending');
  });

  test('returns validation error for malformed CSV', () => {
    const { parseOnboardingStatusCsv } = require('../../gas/OnboardingStatusTracker.gs');

    const result = parseOnboardingStatusCsv('Task_ID,Onboarding_ID\n"unterminated');

    expect(result.isValid).toBe(false);
    expect(result.records).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual(expect.objectContaining({
      code: 'MALFORMED_CSV'
    }));
  });

  test('returns validation error for strict header mismatch', () => {
    const {
      parseOnboardingStatusRows_,
      ONBOARDING_STATUS_HEADERS
    } = require('../../gas/OnboardingStatusTracker.gs');

    const wrongHeaders = ONBOARDING_STATUS_HEADERS.slice();
    wrongHeaders[0] = 'task_id';

    const result = parseOnboardingStatusRows_([wrongHeaders]);

    expect(result.isValid).toBe(false);
    expect(result.records).toEqual([]);
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: 'HEADER_MISMATCH',
        row: 1,
        column: 1,
        expected: 'Task_ID',
        value: 'task_id'
      })
    ]);
  });

  test('returns validation errors for invalid status variants', () => {
    const {
      parseOnboardingStatusRows_,
      ONBOARDING_STATUS_HEADERS
    } = require('../../gas/OnboardingStatusTracker.gs');

    const row = ONBOARDING_STATUS_HEADERS.map((header, index) => {
      if (index === 0) return 'TSK-001';
      if (index === 1) return 'ONB-001';
      if (index === 2) return 'USR-001';
      if (index === 3) return 'Ava Thompson';
      return 'Completed';
    });
    row[4] = 'completed';
    row[5] = 'DONE';

    const result = parseOnboardingStatusRows_([ONBOARDING_STATUS_HEADERS, row]);

    expect(result.isValid).toBe(false);
    expect(result.records).toEqual([]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toEqual(expect.objectContaining({
      code: 'INVALID_STATUS',
      row: 2,
      column: 5,
      value: 'completed',
      allowedValues: ['Pending', 'In Progress', 'Completed']
    }));
    expect(result.errors[1]).toEqual(expect.objectContaining({
      code: 'INVALID_STATUS',
      row: 2,
      column: 6,
      value: 'DONE'
    }));
  });
});
