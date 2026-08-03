import { URDecoder } from '@ngraveio/bc-ur';

import {
  MAX_SYNC_VIDEO_DURATION_SECONDS,
  receiveSyncURPart,
} from './syncExtensionTransfer';

export const MAX_SYNC_VIDEO_FILE_SIZE = 200 * 1024 * 1024;

export type SyncTransferVideoValidationError =
  | 'invalidVideo'
  | 'videoTooLarge'
  | 'videoTooLong';

export type SyncTransferVideoAsset = {
  uri?: string;
  type?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
};

export function validateSyncTransferVideoAsset(asset?: SyncTransferVideoAsset) {
  if (!asset?.uri) {
    return { error: 'invalidVideo' as const };
  }

  const isVideo =
    asset.type?.toLowerCase().startsWith('video/') ||
    /\.(mp4|m4v|mov)$/i.test(asset.fileName || asset.uri);
  if (!isVideo) {
    return { error: 'invalidVideo' as const };
  }
  if (
    typeof asset.fileSize === 'number' &&
    asset.fileSize > MAX_SYNC_VIDEO_FILE_SIZE
  ) {
    return { error: 'videoTooLarge' as const };
  }
  if (
    typeof asset.duration === 'number' &&
    asset.duration > MAX_SYNC_VIDEO_DURATION_SECONDS
  ) {
    return { error: 'videoTooLong' as const };
  }

  return { uri: asset.uri };
}

export function decodeSyncTransferVideoParts(parts: readonly string[]) {
  const decoder = new URDecoder();

  for (const part of parts) {
    const result = receiveSyncURPart(decoder, part);
    if (result.result) {
      return result.result;
    }
  }

  throw new Error('Incomplete wallet transfer QR video');
}
