import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import { ExtractMethods } from './types';

export type NativePermissionState =
  | 'granted'
  | 'denied'
  | 'limited'
  | 'restricted'
  | 'not-determined'
  | 'not-applicable'
  | 'unavailable';

export type NativeVisualMediaAccess =
  | 'full'
  | 'limited'
  | 'partial'
  | 'denied'
  | 'restricted'
  | 'not-determined'
  | 'unavailable';

export type NativeSharedFilesAccess =
  | 'selection-required'
  | 'broad-read'
  | 'all-files'
  | 'unavailable';

export type NativeFileCapabilityRequestOptions = {
  includeImages?: boolean;
  includeVideos?: boolean;
};

export type NativeAccessibleVisualMediaQueryOptions = {
  mediaType?: 'image' | 'video';
  limit?: number;
};

export type NativeAccessibleVisualMediaItem = {
  id: string;
  uri: string;
  previewUri?: string;
  name: string;
  mediaType: 'image' | 'video';
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  dateAddedMs: number;
};

export type NativeAccessibleVisualMediaList = {
  platform: 'android' | 'ios';
  mediaType: 'image' | 'video';
  limit: number;
  truncated: boolean;
  items: NativeAccessibleVisualMediaItem[];
};

export type NativeFileCapabilitySnapshot = {
  platform: 'android' | 'ios';
  osVersion: string;
  sdkInt?: number;
  visualMedia: {
    access: NativeVisualMediaAccess;
    canRequest: boolean;
    canReselect: boolean;
    image: NativePermissionState;
    video: NativePermissionState;
    userSelected: NativePermissionState;
  };
  sharedFiles: {
    access: NativeSharedFilesAccess;
    appSandboxReadable: boolean;
    manageAllFiles: NativePermissionState;
    note: string;
  };
};

export interface Spec extends TurboModule {
  getFileCapabilitySnapshot(): Promise<NativeFileCapabilitySnapshot>;
  requestVisualMediaAccess(
    options?: NativeFileCapabilityRequestOptions,
  ): Promise<NativeFileCapabilitySnapshot>;
  listAccessibleVisualMedia(
    options?: NativeAccessibleVisualMediaQueryOptions,
  ): Promise<NativeAccessibleVisualMediaList>;
}

export default TurboModuleRegistry.get<Spec>('RNFileHelpers');

export type Methods = ExtractMethods<Spec>;
