import { resolveNativeModule } from './utils';
import type {
  NativeCreateQRCodeVideoRequest,
  NativeDecodeQRCodesFromVideoRequest,
  NativePickedVideoFile,
  NativeQRCodeVideoMatrix,
} from './utils';
import type {
  NativeAccessibleVisualMediaList,
  NativeAccessibleVisualMediaQueryOptions,
  NativeFileCapabilityRequestOptions,
  NativeFileCapabilitySnapshot,
} from './fileCapability';

const { RNFileHelpers: nativeModule } = resolveNativeModule('RNFileHelpers');

export type {
  NativeCreateQRCodeVideoRequest,
  NativeDecodeQRCodesFromVideoRequest,
  NativePickedVideoFile,
  NativeQRCodeVideoMatrix,
};

const RNFileHelpers = Object.freeze({
  ...nativeModule,
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
    ((
      _options?: NativeAccessibleVisualMediaQueryOptions,
    ): Promise<NativeAccessibleVisualMediaList> =>
      Promise.reject(
        new Error('RNFileHelpers.listAccessibleVisualMedia is not available'),
      )),
  pickVideoFile:
    nativeModule.pickVideoFile ||
    ((): Promise<NativePickedVideoFile | null> =>
      Promise.reject(
        new Error('RNFileHelpers.pickVideoFile is not available'),
      )),
  cancelVideoFilePicker:
    nativeModule.cancelVideoFilePicker || (() => undefined),
  createQRCodeVideo:
    nativeModule.createQRCodeVideo ||
    ((_request: NativeCreateQRCodeVideoRequest): Promise<string> =>
      Promise.reject(
        new Error('RNFileHelpers.createQRCodeVideo is not available'),
      )),
  decodeQRCodesFromVideo:
    nativeModule.decodeQRCodesFromVideo ||
    ((_request: NativeDecodeQRCodesFromVideoRequest): Promise<string[]> =>
      Promise.reject(
        new Error('RNFileHelpers.decodeQRCodesFromVideo is not available'),
      )),
  cancelQRCodeVideoJob:
    nativeModule.cancelQRCodeVideoJob || ((_jobId: string): void => {}),
});

export default RNFileHelpers;
