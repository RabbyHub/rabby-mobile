import { startSubscribeUserDidTakeScreenshot } from './hooks';
import RNScreenshotPrevent from '@/core/native/RNScreenshotPrevent';
import { AppScreenshotFS, appScreenshotFS } from '@/core/storage/fs';
import RNFS from '@rabby-wallet/react-native-fs';
import { Image } from 'react-native';

// Unit coverage of the real JS subscription owner. Native notification delivery
// and native demand counting are not simulated or claimed by these tests.
jest.mock('@/core/native/RNScreenshotPrevent', () => ({
  __esModule: true,
  default: {
    onUserDidTakeScreenshot: jest.fn(),
    startScreenCaptureDetection: jest.fn(),
    stopScreenCaptureDetection: jest.fn(),
  },
}));
jest.mock('@/core/native/utils', () => ({ IS_IOS: true, IS_ANDROID: false }));
jest.mock('@/core/storage/fs', () => ({
  appScreenshotFS: {
    initializeBeforeCapture: jest.fn(),
    saveScreenshotFrom: jest.fn(),
  },
  AppScreenshotFS: {
    cleanupNativeScreenshotCaptureSource: jest.fn(),
    normalizeLocalFilePath: (path: string) => path,
  },
}));
jest.mock('@rabby-wallet/react-native-fs', () => ({
  exists: jest.fn(),
  unlink: jest.fn(),
}));
jest.mock('@/core/request', () => ({ openapi: {} }));
jest.mock('@/core/storage/mmkv', () => ({
  zustandByMMKV: (_key: string, initial: object) =>
    require('zustand').create(() => initial),
}));
jest.mock('@/core/storage/mmkvConstants', () => ({ APP_MMKV_WEAK_KEYS: {} }));
jest.mock('@/constant', () => ({ isNonPublicProductionEnv: false }));
jest.mock('./utils', () => ({ getScreenshotFeedbackExtra: jest.fn() }));
jest.mock('@/hooks/native/security', () => ({
  getGlobalScreenCapturable: () => true,
}));
jest.mock('@/core/utils/store', () => ({ resolveValFromUpdater: jest.fn() }));
jest.mock('@/core/utils/reexports', () => ({
  zCreate: require('zustand').create,
}));
jest.mock('@/core/utils/device', () => ({ isGteAndroid: () => true }));
jest.mock('@/core/utils/perf', () => ({
  perfEvents: { subscribe: jest.fn() },
}));
jest.mock('@/utils/modalGate', () => ({
  MODAL_GATE_IDS: {},
  getVisibleBlockingModalIds: () => [],
  subscribeModalGateDebugSnapshot: jest.fn(),
}));
jest.mock('@/core/apis/device', () => ({ makeDeviceUUID: jest.fn() }));

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const initialize = jest.mocked(appScreenshotFS.initializeBeforeCapture);
const subscribe = jest.mocked(RNScreenshotPrevent.onUserDidTakeScreenshot);
const start = jest.mocked(RNScreenshotPrevent.startScreenCaptureDetection);
const stop = jest.mocked(RNScreenshotPrevent.stopScreenCaptureDetection);
const cleanup = jest.mocked(
  AppScreenshotFS.cleanupNativeScreenshotCaptureSource,
);
const remove = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  initialize.mockResolvedValue(undefined);
  start.mockResolvedValue(undefined);
  stop.mockResolvedValue(undefined);
  subscribe.mockReturnValue({ remove } as ReturnType<typeof subscribe>);
  cleanup.mockReset().mockResolvedValue(undefined);
  jest
    .mocked(appScreenshotFS.saveScreenshotFrom)
    .mockReset()
    .mockResolvedValue(null);
  jest.mocked(RNFS.exists).mockReset().mockResolvedValue(true);
  jest.mocked(RNFS.unlink).mockReset().mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

it('finishes file initialization and installs the listener before authorizing native capture', async () => {
  const initialization = deferred();
  const nativeStart = deferred();
  initialize.mockReturnValueOnce(initialization.promise);
  start.mockReturnValueOnce(nativeStart.promise);
  const ready = startSubscribeUserDidTakeScreenshot();
  expect(subscribe).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
  initialization.resolve();
  await Promise.resolve();
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledTimes(1);
  expect(subscribe.mock.invocationCallOrder[0]).toBeLessThan(
    start.mock.invocationCallOrder[0],
  );
  let completed = false;
  ready.then(() => {
    completed = true;
  });
  await Promise.resolve();
  expect(completed).toBe(false);
  nativeStart.resolve();
  const subscription = await ready;
  expect(completed).toBe(true);
  await subscription.remove();
});

it('never subscribes or starts capture when initialization fails', async () => {
  const error = new Error('initialization failed');
  initialize.mockRejectedValueOnce(error);
  await expect(startSubscribeUserDidTakeScreenshot()).rejects.toBe(error);
  expect(subscribe).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
});

it('removes the listener if native start fails', async () => {
  const error = new Error('native start failed');
  start.mockRejectedValueOnce(error);
  await expect(startSubscribeUserDidTakeScreenshot()).rejects.toBe(error);
  expect(remove).toHaveBeenCalledTimes(1);
});

it('stops once before removing the cleanup consumer and rejects late feedback', async () => {
  const nativeStop = deferred();
  stop.mockReturnValueOnce(nativeStop.promise);
  const subscription = await startSubscribeUserDidTakeScreenshot();
  const removing = subscription.remove();
  expect(subscription.remove()).toBe(removing);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();
  await subscribe.mock.calls[0][0]({
    captured: true,
    path: '/tmp/capture.png',
  });
  expect(cleanup).toHaveBeenCalledWith('/tmp/capture.png');
  expect(RNFS.exists).not.toHaveBeenCalled();
  nativeStop.resolve();
  await removing;
  expect(remove).toHaveBeenCalledTimes(1);
  await subscription.remove();
  expect(stop).toHaveBeenCalledTimes(1);
});

it('retains a cleanup consumer if native stop fails instead of pretending capture stopped', async () => {
  const error = new Error('native stop failed');
  stop.mockRejectedValueOnce(error);
  const subscription = await startSubscribeUserDidTakeScreenshot();
  const removing = subscription.remove();
  await expect(removing).rejects.toBe(error);
  expect(subscription.remove()).toBe(removing);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();
  await subscribe.mock.calls[0][0]({ captured: true, path: '/tmp/late.png' });
  expect(cleanup).toHaveBeenCalledWith('/tmp/late.png');
});

it.each(['path', 'imageBase64'] as const)(
  'does not open late feedback if removal happens during %s persistence',
  async imageKind => {
    let finishSave!: (path: string) => void;
    const save = new Promise<string>(resolve => {
      finishSave = resolve;
    });
    jest.mocked(appScreenshotFS.saveScreenshotFrom).mockReturnValueOnce(save);
    jest.mocked(RNFS.exists).mockResolvedValueOnce(true);
    const resolveImage = jest.spyOn(Image, 'resolveAssetSource');
    const subscription = await startSubscribeUserDidTakeScreenshot();
    const handling = subscribe.mock.calls[0][0]({
      captured: true,
      [imageKind]: imageKind === 'path' ? '/tmp/capture.png' : 'base64-image',
    });
    await Promise.resolve();
    expect(appScreenshotFS.saveScreenshotFrom).toHaveBeenCalledTimes(1);
    await subscription.remove();
    finishSave('/tmp/saved.png');
    await handling;
    expect(resolveImage).not.toHaveBeenCalled();
    expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/saved.png');
  },
);

it('does not issue another stop or remove the new listener when an old removal finishes', async () => {
  const oldStop = deferred();
  const oldRemove = jest.fn();
  const newRemove = jest.fn();
  subscribe
    .mockReturnValueOnce({ remove: oldRemove } as ReturnType<typeof subscribe>)
    .mockReturnValueOnce({ remove: newRemove } as ReturnType<typeof subscribe>);
  stop.mockReturnValueOnce(oldStop.promise);
  const oldSubscription = await startSubscribeUserDidTakeScreenshot();
  const removing = oldSubscription.remove();
  const newSubscription = await startSubscribeUserDidTakeScreenshot();
  expect(start).toHaveBeenCalledTimes(2);
  oldStop.resolve();
  await removing;
  await oldSubscription.remove();
  expect(stop).toHaveBeenCalledTimes(1);
  expect(oldRemove).toHaveBeenCalledTimes(1);
  expect(newRemove).not.toHaveBeenCalled();
  await newSubscription.remove();
  expect(stop).toHaveBeenCalledTimes(2);
  expect(newRemove).toHaveBeenCalledTimes(1);
});

it.each([false, true])(
  'gives a broadcast file only to the new owner while old stop is pending (newFirst=%s)',
  async newFirst => {
    const oldStop = deferred();
    stop.mockReturnValueOnce(oldStop.promise);
    const oldSubscription = await startSubscribeUserDidTakeScreenshot();
    const removing = oldSubscription.remove();
    const newSubscription = await startSubscribeUserDidTakeScreenshot();
    let sourceExists = true;
    cleanup.mockImplementation(async () => {
      sourceExists = false;
    });
    jest.mocked(RNFS.exists).mockImplementation(async () => {
      await Promise.resolve();
      return sourceExists;
    });
    const event = { captured: true, path: '/tmp/broadcast.png' };
    const callbacks = subscribe.mock.calls.map(([callback]) => callback);
    try {
      await Promise.all(
        (newFirst ? callbacks.reverse() : callbacks).map(callback =>
          callback(event),
        ),
      );
      expect(cleanup).not.toHaveBeenCalled();
      expect(appScreenshotFS.saveScreenshotFrom).toHaveBeenCalledTimes(1);
      expect(appScreenshotFS.saveScreenshotFrom).toHaveBeenCalledWith(
        event.path,
        {
          cleanupSource: true,
          imageType: undefined,
        },
      );
    } finally {
      oldStop.resolve();
      await removing;
      await newSubscription.remove();
    }
  },
);

it('returns cleanup ownership to an old pending stop when the replacement start fails', async () => {
  const oldStop = deferred();
  stop.mockReturnValueOnce(oldStop.promise);
  const oldSubscription = await startSubscribeUserDidTakeScreenshot();
  const removing = oldSubscription.remove();
  const error = new Error('replacement start failed');
  start.mockRejectedValueOnce(error);
  await expect(startSubscribeUserDidTakeScreenshot()).rejects.toBe(error);
  try {
    await subscribe.mock.calls[0][0]({
      captured: true,
      path: '/tmp/rejected.png',
    });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledWith('/tmp/rejected.png');
  } finally {
    oldStop.resolve();
    await removing;
  }
});
