const mockPlatform: { OS: string; Version: string | number } = {
  OS: 'ios',
  Version: '27.1',
};

jest.mock('react-native', () => ({
  Platform: mockPlatform,
}));

jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: {
    getDeviceId: jest.fn(),
    getModel: jest.fn(),
  },
}));

import DeviceInfo from 'react-native-device-info';

const getDeviceId = DeviceInfo.getDeviceId as jest.Mock;
const getModel = DeviceInfo.getModel as jest.Mock;

function loadModule() {
  let mod: typeof import('./foldableDevice') | undefined;
  jest.isolateModules(() => {
    mod = require('./foldableDevice');
  });
  return mod!;
}

describe('foldableDevice', () => {
  beforeEach(() => {
    mockPlatform.OS = 'ios';
    mockPlatform.Version = '27.1';
    getDeviceId.mockReturnValue('iPhone19,4');
    getModel.mockReturnValue('iPhone Duo');
  });

  it('detects the duo by device id', () => {
    const { isFoldableIosDevice } = loadModule();
    expect(isFoldableIosDevice()).toBe(true);
  });

  it('falls back to the model name for unlisted ids', () => {
    getDeviceId.mockReturnValue('iPhone99,1');
    getModel.mockReturnValue('iPhone Duo');

    const { isFoldableIosDevice } = loadModule();
    expect(isFoldableIosDevice()).toBe(true);
  });

  it('rejects other iPhones and non-iOS platforms', () => {
    getDeviceId.mockReturnValue('iPhone17,1');
    getModel.mockReturnValue('iPhone 18 Pro');
    expect(loadModule().isFoldableIosDevice()).toBe(false);

    mockPlatform.OS = 'android';
    expect(loadModule().isFoldableIosDevice()).toBe(false);
  });

  it('fails closed when the native device lookup throws', () => {
    getDeviceId.mockImplementation(() => {
      throw new Error('boom');
    });

    expect(loadModule().isFoldableIosDevice()).toBe(false);
  });

  it('only matches the letterboxed side-column posture', () => {
    const { isFoldableSideColumnPosture } = loadModule();

    expect(isFoldableSideColumnPosture({ top: 0, right: 84 })).toBe(true);
    // iPad landscape / split windows keep a real status-bar inset.
    expect(isFoldableSideColumnPosture({ top: 24, right: 84 })).toBe(false);
    // No system column.
    expect(isFoldableSideColumnPosture({ top: 0, right: 0 })).toBe(false);
  });

  it('requires the calibrated iOS major version', () => {
    mockPlatform.Version = '26.4';
    expect(
      loadModule().isFoldableSideColumnPosture({ top: 0, right: 84 }),
    ).toBe(false);

    mockPlatform.Version = 27;
    expect(
      loadModule().isFoldableSideColumnPosture({ top: 0, right: 84 }),
    ).toBe(true);

    mockPlatform.Version = '28.0';
    expect(
      loadModule().isFoldableSideColumnPosture({ top: 0, right: 84 }),
    ).toBe(true);
  });
});
