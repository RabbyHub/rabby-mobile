import { isValidAddress } from '@ethereumjs/util';
import { normalize } from 'viem/ens';

const MAX_ENS_NAME_LENGTH = 255;
const ENS_NAME_DISALLOWED_CHARS = /[\s:/?#@\\]/;

export type GalleryQrCodeResult =
  | { status: 'success'; value: string }
  | { status: 'not-found' | 'multiple' | 'invalid' };

const isEnsLikeName = (value: string) => {
  if (
    value.length > MAX_ENS_NAME_LENGTH ||
    ENS_NAME_DISALLOWED_CHARS.test(value)
  ) {
    return false;
  }
  const labels = value.split('.');
  if (labels.length < 2 || labels.some(label => !label)) {
    return false;
  }
  try {
    normalize(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Gallery images may hold sensitive QR codes (e.g. private key or seed phrase
 * backups), so only a single plain address or ENS-like name is accepted. Any
 * other payload must not reach the input field or the ENS resolver.
 */
export const resolveGalleryQrCodePayloads = (
  payloads: readonly string[],
): GalleryQrCodeResult => {
  const candidates = Array.from(
    new Set(payloads.map(payload => payload.trim()).filter(Boolean)),
  );
  if (!candidates.length) {
    return { status: 'not-found' };
  }
  if (candidates.length > 1) {
    return { status: 'multiple' };
  }

  const [value] = candidates;
  if (isValidAddress(value) || isEnsLikeName(value)) {
    return { status: 'success', value };
  }
  return { status: 'invalid' };
};
