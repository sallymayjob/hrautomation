function mockPropertyStore(values) {
  return {
    getProperty: jest.fn((key) => values[key]),
    getProperties: jest.fn(() => Object.assign({}, values))
  };
}

describe('Config channel validation', () => {
  beforeEach(() => {
    jest.resetModules();
    global.PropertiesService = {
      getScriptProperties: jest.fn()
    };
  });

  test('validateRequiredChannelConfig throws when required channel keys are missing', () => {
    global.PropertiesService.getScriptProperties.mockReturnValue(mockPropertyStore({
      ADMIN_TEAM_CHANNEL_ID: 'C_ADMIN',
      FINANCE_TEAM_CHANNEL_ID: 'C_FIN',
      HR_TEAM_CHANNEL_ID: 'C_HR',
      IT_TEAM_CHANNEL_ID: 'C_IT',
      LEGAL_TEAM_CHANNEL_ID: 'C_LEGAL',
      OPERATIONS_TEAM_CHANNEL_ID: 'C_OPS',
      PEOPLE_TEAM_CHANNEL_ID: 'C_PEOPLE',
      DEFAULT_ASSIGNMENTS_CHANNEL_ID: 'C_DEFAULT'
    }));

    const { Config } = require('../../gas/Config.gs');

    expect(() => Config.validateRequiredChannelConfig()).toThrow('HR_OPS_ALERTS_CHANNEL_ID');
  });

  test('validateRequiredChannelConfig passes when required channel keys are configured', () => {
    global.PropertiesService.getScriptProperties.mockReturnValue(mockPropertyStore({
      ADMIN_TEAM_CHANNEL_ID: 'C_ADMIN',
      FINANCE_TEAM_CHANNEL_ID: 'C_FIN',
      HR_TEAM_CHANNEL_ID: 'C_HR',
      IT_TEAM_CHANNEL_ID: 'C_IT',
      LEGAL_TEAM_CHANNEL_ID: 'C_LEGAL',
      OPERATIONS_TEAM_CHANNEL_ID: 'C_OPS',
      PEOPLE_TEAM_CHANNEL_ID: 'C_PEOPLE',
      DEFAULT_ASSIGNMENTS_CHANNEL_ID: 'C_DEFAULT',
      HR_OPS_ALERTS_CHANNEL_ID: 'C_HR_ALERTS'
    }));

    const { Config } = require('../../gas/Config.gs');

    expect(Config.validateRequiredChannelConfig()).toBe(true);
  });
});
