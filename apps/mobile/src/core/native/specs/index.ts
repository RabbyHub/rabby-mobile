import { NativeModuleNames } from './types';

import RNHelpers from './NativeRNHelpers';
import ReactNativeSecurity from './NativeReactNativeSecurity';
import RNScreenshotPrevent from './NativeRNScreenshotPrevent';
import RNTimeChanged from './NativeRNTimeChanged';

export const TurboNativeModules = {
  [NativeModuleNames.RNHelpers]: RNHelpers,
  [NativeModuleNames.ReactNativeSecurity]: ReactNativeSecurity,
  [NativeModuleNames.RNScreenshotPrevent]: RNScreenshotPrevent,
  [NativeModuleNames.RNTimeChanged]: RNTimeChanged,
};
