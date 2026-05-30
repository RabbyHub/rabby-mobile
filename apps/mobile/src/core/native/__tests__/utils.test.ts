import { NativeModules, Platform } from 'react-native';

import {
  makeRnEEClass,
  resolveNativeModule,
  wrapPlatformOnlyMethod,
} from '../utils';

const originalPlatformOS = Platform.OS;

const setPlatformOS = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => os,
  });
};

describe('native utils', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
    setPlatformOS(originalPlatformOS);
    delete (NativeModules as any).RNHelpers;
  });

  afterEach(() => {
    errorSpy.mockRestore();
    setPlatformOS(originalPlatformOS);
    delete (NativeModules as any).RNHelpers;
  });

  describe('resolveNativeModule', () => {
    it('returns an existing native module by name', () => {
      const forceExitApp = jest.fn();
      (NativeModules as any).RNHelpers = { forceExitApp };

      expect(resolveNativeModule('RNHelpers').RNHelpers.forceExitApp).toBe(
        forceExitApp,
      );
    });

    it('returns a throwing proxy when the native module is missing', () => {
      const { RNHelpers } = resolveNativeModule('RNHelpers');

      expect(() => RNHelpers.forceExitApp).toThrow(
        "The native module 'RNHelpers' doesn't seem to be added",
      );
    });
  });

  it('exposes the React Native NativeEventEmitter class for typed event emitters', () => {
    const { NativeEventEmitter } = makeRnEEClass<{
      changed: () => void;
    }>();

    expect(typeof NativeEventEmitter).toBe('function');
  });

  describe('wrapPlatformOnlyMethod', () => {
    it('uses the native method on supported platforms', async () => {
      setPlatformOS('ios');
      const method = jest.fn(async () => undefined);
      const fallbackFn = jest.fn(async () => undefined);

      await wrapPlatformOnlyMethod({
        method,
        fallbackFn,
        platform: 'ios',
      })('arg');

      expect(method).toHaveBeenCalledWith('arg');
      expect(fallbackFn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it('throws when a required platform method is missing', () => {
      setPlatformOS('android');

      expect(() =>
        wrapPlatformOnlyMethod({
          method: undefined,
          fallbackFn: jest.fn(),
          platform: 'android',
        }),
      ).toThrow(
        'Method is not implemented on platform android, but it should be',
      );
    });

    it('uses and returns fallback result on unsupported platforms', async () => {
      setPlatformOS('android');
      const method = jest.fn(async () => undefined);
      const fallbackFn = jest.fn(async () => undefined);

      await expect(
        wrapPlatformOnlyMethod({
          method,
          fallbackFn,
          platform: 'ios',
        })('arg'),
      ).resolves.toBeUndefined();

      expect(method).not.toHaveBeenCalled();
      expect(fallbackFn).toHaveBeenCalledWith('arg');
      expect(console.error).toHaveBeenCalledWith(expect.any(Error));
    });

    it('supports multiple allowed platforms', () => {
      setPlatformOS('android');
      const method = jest.fn();
      const fallbackFn = jest.fn();

      wrapPlatformOnlyMethod({
        method,
        fallbackFn,
        platform: ['ios', 'android'],
      })();

      expect(method).toHaveBeenCalledTimes(1);
      expect(fallbackFn).not.toHaveBeenCalled();
    });
  });
});
