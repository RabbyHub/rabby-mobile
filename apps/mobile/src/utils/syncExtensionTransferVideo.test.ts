import QRCode from 'qrcode';

/* eslint-disable no-bitwise -- the test reverses the production bit packing. */

import { SYNC_VIDEO_REDUNDANCY } from './syncExtensionTransfer';
import {
  buildSyncVideoFrames,
  packQRCodeFrame,
} from './syncExtensionTransferVideo';

function unpackFrame(frame: ReturnType<typeof packQRCodeFrame>) {
  const packed = Buffer.from(frame.data, 'base64');
  return Array.from({ length: frame.size * frame.size }, (_, index) =>
    Boolean(packed[index >> 3]! & (1 << (7 - (index & 7)))),
  );
}

describe('syncExtensionTransferVideo', () => {
  it('bit-packs the exact M-level QR matrix', () => {
    const value = 'ur:bytes/1-2/lpadamcsfyaoaeaeae';
    const expected = QRCode.create(value, {
      errorCorrectionLevel: 'M',
    }).modules;
    const frame = packQRCodeFrame(value);

    expect(frame.size).toBe(expected.size);
    expect(unpackFrame(frame)).toEqual(
      Array.from(expected.data, module => Boolean(module)),
    );
  });

  it('builds at least twenty fountain frames and reports completion', async () => {
    const progress: number[] = [];
    const frames = await buildSyncVideoFrames(
      JSON.stringify({
        format: 'rabby-wallet-transfer',
        version: 1,
        vault: { data: 'data', iv: 'iv', salt: 'salt' },
      }),
      { onProgress: value => progress.push(value) },
    );

    expect(frames).toHaveLength(20);
    expect(frames.length).toBeGreaterThanOrEqual(SYNC_VIDEO_REDUNDANCY);
    expect(progress.at(-1)).toBe(1);
  });

  it('supports cancellation between frames', async () => {
    await expect(
      buildSyncVideoFrames(
        JSON.stringify({
          format: 'rabby-wallet-transfer',
          version: 1,
          vault: { data: 'data', iv: 'iv', salt: 'salt' },
        }),
        { isCancelled: () => true },
      ),
    ).rejects.toThrow('cancelled');
  });
});
