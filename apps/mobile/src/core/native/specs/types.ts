import { type EventEmitter } from 'react-native/Libraries/Types/CodegenTypes';

// export type TrimNeverValues<T extends Record<string, any>> = {
//   [K in keyof T]-?: T[K] extends never ? never : T[K];
// };
export type TrimNeverValues<T extends Record<string, any>> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};

export type ExtractEventEmitters<T extends Record<string, any>> =
  TrimNeverValues<{
    [P in keyof T as T[P] extends (...args: any[]) => void
      ? P
      : never]: T[P] extends EventEmitter<any> ? T[P] : never;
  }>;

export type ExtractMethods<T extends Record<string, any>> = TrimNeverValues<{
  [P in keyof T as T[P] extends (...args: any[]) => void
    ? P
    : never]: T[P] extends EventEmitter<any> ? never : T[P];
}>;

export const enum NativeModuleNames {
  RNHelpers = 'RNHelpers',
  ReactNativeSecurity = 'ReactNativeSecurity',
  RNScreenshotPrevent = 'RNScreenshotPrevent',
  RNTimeChanged = 'RNTimeChanged',
}
