import { createSyncUREncoder } from './syncExtensionTransfer';
import {
  MAX_SYNC_VIDEO_FILE_SIZE,
  decodeSyncTransferVideoParts,
  validateSyncTransferVideoAsset,
} from './syncExtensionTransferVideoImport';

const payload = JSON.stringify({
  format: 'rabby-wallet-transfer',
  version: 1,
  vault: {
    data: Buffer.alloc(48, 0xa5).toString('base64'),
    iv: Buffer.alloc(16, 0xb6).toString('base64'),
    salt: Buffer.alloc(32, 0xc7).toString('base64'),
    keyMetadata: {
      algorithm: 'PBKDF2',
      params: { iterations: 900_000 },
    },
  },
});

describe('syncExtensionTransferVideoImport', () => {
  it('validates a selected video', () => {
    expect(
      validateSyncTransferVideoAsset({
        uri: 'content://wallet-transfer',
        type: 'video/mp4',
        fileSize: MAX_SYNC_VIDEO_FILE_SIZE,
        duration: 20,
      }),
    ).toEqual({ uri: 'content://wallet-transfer' });
  });

  it('rejects invalid and oversized assets', () => {
    expect(
      validateSyncTransferVideoAsset({
        uri: 'file:///transfer.png',
        type: 'image/png',
      }),
    ).toEqual({ error: 'invalidVideo' });
    expect(
      validateSyncTransferVideoAsset({
        uri: 'file:///transfer.mp4',
        type: 'video/mp4',
        fileSize: MAX_SYNC_VIDEO_FILE_SIZE + 1,
      }),
    ).toEqual({ error: 'videoTooLarge' });
  });

  it('decodes repeated and unordered fountain parts', () => {
    const encoder = createSyncUREncoder(payload);
    const parts = Array.from(
      { length: Math.max(20, encoder.fragmentsLength * 2) },
      () => encoder.nextPart(),
    );

    expect(
      decodeSyncTransferVideoParts([
        parts[2],
        parts[0],
        parts[2],
        ...parts.slice(1),
      ]),
    ).toBe(payload);
  });

  it('rejects incomplete frame sets', () => {
    expect(() => decodeSyncTransferVideoParts([])).toThrow('Incomplete');
  });
});
