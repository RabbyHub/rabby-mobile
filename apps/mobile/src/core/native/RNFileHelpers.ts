import { resolveNativeModule } from './utils';
import { NativeModuleNames } from './specs/types';
import type {
  NativeAccessibleVisualMediaList,
  NativeAccessibleVisualMediaQueryOptions,
  NativeFileCapabilityRequestOptions,
  NativeFileCapabilitySnapshot,
} from './fileCapability';

const { RNFileHelpers: nativeModule } = resolveNativeModule(
  NativeModuleNames.RNFileHelpers,
);

const RNFileHelpers = Object.freeze({
  getFileCapabilitySnapshot:
    nativeModule.getFileCapabilitySnapshot ||
    ((): Promise<NativeFileCapabilitySnapshot> =>
      Promise.reject(
        new Error('RNFileHelpers.getFileCapabilitySnapshot is not available'),
      )),
  requestVisualMediaAccess:
    nativeModule.requestVisualMediaAccess ||
    ((_options?: NativeFileCapabilityRequestOptions) =>
      Promise.reject(
        new Error('RNFileHelpers.requestVisualMediaAccess is not available'),
      )),
  listAccessibleVisualMedia:
    nativeModule.listAccessibleVisualMedia ||
    ((_options?: NativeAccessibleVisualMediaQueryOptions) =>
      Promise.reject(
        new Error('RNFileHelpers.listAccessibleVisualMedia is not available'),
      )),
});

export default RNFileHelpers;
