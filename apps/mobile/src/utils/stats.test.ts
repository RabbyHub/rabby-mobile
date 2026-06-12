function mockNativeHelpers() {
  jest.doMock('react-native-haptic-feedback', () => ({
    trigger: jest.fn(),
  }));
  jest.doMock('@/core/native/RNHelpers', () => ({
    __esModule: true,
    default: {
      iosExcludeFileFromBackup: jest.fn(() => Promise.resolve(true)),
    },
  }));
}

function loadStats(preference: Record<string, unknown>) {
  jest.resetModules();
  mockNativeHelpers();

  const reportMock = jest.fn();
  const StatsReportMock = jest.fn().mockImplementation(() => ({
    report: reportMock,
  }));

  jest.doMock('@debank/festats', () => ({
    __esModule: true,
    default: StatsReportMock,
    SITE: {
      rabbyMobile: 'v2/rabbyMobile',
    },
  }));

  const { appStorage } =
    require('@/core/storage/mmkv') as typeof import('@/core/storage/mmkv');
  const { APP_STORE_NAMES } =
    require('@/core/storage/storeConstant') as typeof import('@/core/storage/storeConstant');

  appStorage.clearAll();
  appStorage.setItem(APP_STORE_NAMES.preference, preference);

  const { stats } = require('./stats') as typeof import('./stats');

  return {
    stats,
    reportMock,
    StatsReportMock,
  };
}

describe('stats', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('@debank/festats');
    jest.dontMock('@/core/native/RNHelpers');
    jest.dontMock('react-native-haptic-feedback');
  });

  it('does not call festats while user behavior tracking is opted out', () => {
    const { stats, reportMock } = loadStats({
      userBehaviorTrackingOptOut: true,
    });

    stats.report('event', { value: 1 });

    expect(reportMock).not.toHaveBeenCalled();
  });

  it('calls festats when user behavior tracking is allowed', () => {
    const { stats, reportMock } = loadStats({
      userBehaviorTrackingOptOut: false,
    });

    stats.report('event', { value: 1 });

    expect(reportMock).toHaveBeenCalledWith('event', { value: 1 });
  });
});
