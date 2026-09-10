jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('@/core/native/RNScreenshotPrevent', () => ({
  __esModule: true,
  default: {
    iosOnScreenCaptureChanged: jest.fn(),
    iosProtectFromScreenRecording: jest.fn(),
    iosUnprotectFromScreenRecording: jest.fn(),
    onUserDidTakeScreenshot: jest.fn(),
  },
}));

jest.mock('@/hooks/appSettings', () => ({
  getExpScreenCapture: () => ({ forceAllowScreenshot: false }),
  useIosForceDisableAlertForSensitiveScene: () => ({
    iosForceDisableAlertForSensitiveScene: false,
  }),
}));

jest.mock('./security', () => ({
  setIOSScreenCapture: jest.fn(),
}));

jest.mock('@/utils/navigation', () => ({
  getLatestNavigationName: () => 'ImportSecret',
}));

import { perfEvents } from '@/core/utils/perf';
import { startSubscribeAtSensitiveScene } from './sensitiveScene';

describe('sensitive scene screen capture protection', () => {
  it('reconciles a protected route that became ready before subscribing', () => {
    const protectionStates: boolean[] = [];
    const eventSubscription = perfEvents.subscribe(
      'CHANGE_PREVENT_SCREENSHOT',
      isPrevented => protectionStates.push(isPrevented),
    );

    const unsubscribeScene = startSubscribeAtSensitiveScene();

    expect(protectionStates).toEqual([true]);

    unsubscribeScene();
    eventSubscription.remove();
    perfEvents.emit('EVENT_ROUTE_CHANGE', { currentRouteName: undefined });
  });
});
