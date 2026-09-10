import { NativeModuleNames } from './types';

import RNFileHelpers from './NativeRNFileHelpers';
import RNHelpers from './NativeRNHelpers';
import RNThread from './NativeRNThread';
import ReactNativeSecurity from './NativeReactNativeSecurity';
import RNScreenshotPrevent from './NativeRNScreenshotPrevent';
import RNTimeChanged from './NativeRNTimeChanged';

export const TurboNativeModules = {
  [NativeModuleNames.RNFileHelpers]: RNFileHelpers,
  [NativeModuleNames.RNHelpers]: RNHelpers,
  [NativeModuleNames.RNThread]: RNThread,
  [NativeModuleNames.ReactNativeSecurity]: ReactNativeSecurity,
  [NativeModuleNames.RNScreenshotPrevent]: RNScreenshotPrevent,
  [NativeModuleNames.RNTimeChanged]: RNTimeChanged,
};
