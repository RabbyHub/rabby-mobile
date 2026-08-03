import QRCode from 'qrcode';

/* eslint-disable no-bitwise -- QR matrices are intentionally bit-packed. */

import {
  createSyncUREncoder,
  getSyncVideoFrameCount,
} from './syncExtensionTransfer';

export type PackedQRCodeFrame = {
  /** Number of QR modules on each side, excluding the native quiet zone. */
  size: number;
  /** Row-major module bits, most-significant bit first, encoded as base64. */
  data: string;
};

export type BuildSyncVideoFramesOptions = {
  onProgress?: (progress: number) => void;
  isCancelled?: () => boolean;
};

const FRAME_BUILD_BATCH_SIZE = 8;

const yieldToEventLoop = () =>
  new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });

export function packQRCodeFrame(value: string): PackedQRCodeFrame {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const moduleBits = qr.modules.data;
  const packed = new Uint8Array(Math.ceil(moduleBits.length / 8));

  for (let index = 0; index < moduleBits.length; index += 1) {
    if (moduleBits[index]) {
      packed[index >> 3] |= 1 << (7 - (index & 7));
    }
  }

  return {
    size: qr.modules.size,
    data: Buffer.from(packed).toString('base64'),
  };
}

/**
 * Pre-build compact QR matrices for the native H.264 encoder. Keeping the QR
 * algorithm in JS avoids adding a second QR encoder dependency on Android,
 * while bit-packing keeps the React Native bridge payload small.
 */
export async function buildSyncVideoFrames(
  input: string,
  options: BuildSyncVideoFramesOptions = {},
) {
  const encoder = createSyncUREncoder(input);
  const frameCount = getSyncVideoFrameCount(encoder);
  const frames: PackedQRCodeFrame[] = [];

  for (let index = 0; index < frameCount; index += 1) {
    if (options.isCancelled?.()) {
      throw new Error('Wallet transfer video export cancelled');
    }

    frames.push(packQRCodeFrame(encoder.nextPart()));
    options.onProgress?.((index + 1) / frameCount);

    if ((index + 1) % FRAME_BUILD_BATCH_SIZE === 0) {
      await yieldToEventLoop();
    }
  }

  return frames;
}
