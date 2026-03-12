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
    const records = parseOnboardingStatusCsv(csvText);

    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(expect.objectContaining({
      taskId: 'TSK-001',
      onboardingId: 'ONB-001',
      userId: 'USR-001',
      employeeName: 'Ava Thompson'
    }));
    expect(Object.keys(records[0].steps)).toHaveLength(34);
    expect(records[0].steps[ONBOARDING_STATUS_STEP_HEADERS[0]]).toBe('Completed');
    expect(records[0].steps[ONBOARDING_STATUS_STEP_HEADERS[6]]).toBe('In Progress');
    expect(records[0].steps[ONBOARDING_STATUS_STEP_HEADERS[33]]).toBe('Pending');
  });

  test('throws for invalid status values', () => {
    const {
      parseOnboardingStatusRows_,
      ONBOARDING_STATUS_HEADERS
    } = require('../../gas/OnboardingStatusTracker.gs');

    const row = ONBOARDING_STATUS_HEADERS.map((header, index) => {
      if (index === 0) return 'USR-XYZ';
      if (index === 1) return 'Test User';
      return 'Completed';
    });
    row[4] = 'DONE';

    expect(() => parseOnboardingStatusRows_([ONBOARDING_STATUS_HEADERS, row]))
      .toThrow('Allowed values: Pending, In Progress, Completed');
  });
});
