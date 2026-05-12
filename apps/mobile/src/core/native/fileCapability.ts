import { Platform } from 'react-native';
import RNFileHelpers from './RNFileHelpers';

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

export type NativeAccessibleVisualMediaType = 'image' | 'video';

export type NativeAccessibleVisualMediaQueryOptions = {
  mediaType?: NativeAccessibleVisualMediaType;
  limit?: number;
};

export type NativeAccessibleVisualMediaItem = {
  id: string;
  uri: string;
  previewUri?: string;
  name: string;
  mediaType: NativeAccessibleVisualMediaType;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  dateAddedMs: number;
};

export type NativeAccessibleVisualMediaList = {
  platform: 'android' | 'ios';
  mediaType: NativeAccessibleVisualMediaType;
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

const FALLBACK_SNAPSHOT: NativeFileCapabilitySnapshot = {
  platform: Platform.OS === 'android' ? 'android' : 'ios',
  osVersion: String(Platform.Version),
  sdkInt: Platform.OS === 'android' ? Number(Platform.Version) : undefined,
  visualMedia: {
    access: 'unavailable',
    canRequest: false,
    canReselect: false,
    image: 'unavailable',
    video: 'unavailable',
    userSelected: 'unavailable',
  },
  sharedFiles: {
    access: 'unavailable',
    appSandboxReadable: true,
    manageAllFiles: 'unavailable',
    note: 'Native file capability helper is unavailable until the app is rebuilt.',
  },
};

const FALLBACK_ACCESSIBLE_VISUAL_MEDIA: NativeAccessibleVisualMediaList = {
  platform: Platform.OS === 'android' ? 'android' : 'ios',
  mediaType: 'image',
  limit: 0,
  truncated: false,
  items: [],
};

export async function getFileCapabilitySnapshot() {
  try {
    return await RNFileHelpers.getFileCapabilitySnapshot();
  } catch (error) {
    console.error('getFileCapabilitySnapshot failed', error);
    return FALLBACK_SNAPSHOT;
  }
}

export async function requestVisualMediaAccess(
  options?: NativeFileCapabilityRequestOptions,
) {
  return RNFileHelpers.requestVisualMediaAccess(options);
}

export async function listAccessibleVisualMedia(
  options?: NativeAccessibleVisualMediaQueryOptions,
) {
  try {
    return await RNFileHelpers.listAccessibleVisualMedia(options);
  } catch (error) {
    console.error('listAccessibleVisualMedia failed', error);
    return {
      ...FALLBACK_ACCESSIBLE_VISUAL_MEDIA,
      mediaType: options?.mediaType || 'image',
      limit: options?.limit || 0,
    };
  }
}
