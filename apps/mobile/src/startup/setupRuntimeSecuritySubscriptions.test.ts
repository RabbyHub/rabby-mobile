const calls: string[] = [];

jest.mock('@/hooks/native/security', () => ({
  enableIOSAppSwitcherBlur: () => calls.push('enable-app-switcher-blur'),
  startSubscribeIOSAppSwitcherBlur: () =>
    calls.push('subscribe-app-switcher-blur'),
  startSubscribeWhetherPreventScreenshot: () =>
    calls.push('subscribe-native-prevention'),
}));

jest.mock('@/hooks/native/sensitiveScene', () => ({
  startSubscribeAtSensitiveScene: () => calls.push('subscribe-sensitive-scene'),
  startSubscribeIOSJustScreenshotted: () =>
    calls.push('subscribe-screenshot-state'),
  startSubscribeIOSScreenRecording: () =>
    calls.push('subscribe-screen-recording'),
}));

describe('runtime security subscriptions', () => {
  it('installs the native prevention consumer before the initial scene sync', () => {
    const {
      startSetupRuntimeSecuritySubscriptions,
    } = require('./setupRuntimeSecuritySubscriptions');

    startSetupRuntimeSecuritySubscriptions();
    startSetupRuntimeSecuritySubscriptions();

    expect(calls).toEqual([
      'subscribe-native-prevention',
      'subscribe-sensitive-scene',
      'subscribe-screenshot-state',
      'subscribe-app-switcher-blur',
      'enable-app-switcher-blur',
      'subscribe-screen-recording',
    ]);
  });
});
