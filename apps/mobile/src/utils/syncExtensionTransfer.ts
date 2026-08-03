import { UR, URDecoder, UREncoder } from '@ngraveio/bc-ur';
import { Gunzip, gzipSync, strFromU8, strToU8 } from 'fflate';

export const SYNC_TRANSFER_FORMAT = 'rabby-wallet-transfer' as const;
export const SYNC_TRANSFER_VERSION = 1 as const;

export const SYNC_UR_FRAGMENT_LENGTH = 200;
export const MAX_SYNC_UR_PART_LENGTH = 2000;
export const MAX_SYNC_UR_PARTS = 4096;
export const MAX_SYNC_PAYLOAD_LENGTH = 20 * 1024 * 1024;
export const MAX_SYNC_ENCRYPTED_DATA_BYTES = 12 * 1024 * 1024;
export const MAX_SYNC_METADATA_ENTRIES = 10_000;
export const MAX_SYNC_METADATA_ADDRESS_LENGTH = 128;
export const MAX_SYNC_METADATA_LABEL_LENGTH = 256;

const SYNC_AES_GCM_IV_BYTES = 16;
const SYNC_AES_GCM_TAG_BYTES = 16;
const SYNC_PBKDF2_SALT_BYTES = 32;
const MIN_SYNC_PBKDF2_ITERATIONS = 10_000;
const MAX_SYNC_PBKDF2_ITERATIONS = 1_000_000;

// At 4 Mbps and two fountain-code passes this keeps generated videos well
// below a 200 MiB upload limit while allowing about 160 KiB of compressed data.
export const MAX_SYNC_VIDEO_FRAGMENTS = 800;
export const SYNC_VIDEO_FRAME_DURATION = 200;
export const SYNC_VIDEO_REDUNDANCY = 2;
export const SYNC_VIDEO_TAIL_FRAMES = 2;
export const MAX_SYNC_VIDEO_DURATION_SECONDS =
  Math.ceil(
    ((MAX_SYNC_VIDEO_FRAGMENTS * SYNC_VIDEO_REDUNDANCY +
      SYNC_VIDEO_TAIL_FRAMES) *
      SYNC_VIDEO_FRAME_DURATION) /
      1000,
  ) + 60;

type SyncTransferVault = {
  data: string;
  iv: string;
  salt: string;
  keyMetadata?: {
    algorithm: 'PBKDF2';
    params: { iterations: number };
  };
};

export type SyncExtensionTransferPayload = {
  format?: typeof SYNC_TRANSFER_FORMAT;
  version?: typeof SYNC_TRANSFER_VERSION;
  vault: SyncTransferVault;
  whitelist?: string[];
  highligtedAddresses?: Array<{ address: string; brandName: string }>;
  alianNames?: Array<{ address: string; name: string }>;
};

export type NormalizedSyncExtensionTransferPayload = Omit<
  SyncExtensionTransferPayload,
  'whitelist' | 'highligtedAddresses' | 'alianNames'
> & {
  whitelist: string[];
  highligtedAddresses: Array<{ address: string; brandName: string }>;
  alianNames: Array<{ address: string; name: string }>;
};

const MULTI_PART_SEQUENCE_PATTERN = /^(\d+)-(\d+)$/;
const BYTEWORDS_BODY_PATTERN = /^[a-z]+$/i;
const CANONICAL_BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hasOnlyKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
) => Object.keys(value).every(key => allowedKeys.includes(key));

const isBoundedString = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.length <= maxLength;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= MAX_SYNC_METADATA_ENTRIES &&
  value.every(item => isBoundedString(item, MAX_SYNC_METADATA_ADDRESS_LENGTH));

const isPinnedAddressArray = (
  value: unknown,
): value is Array<{ address: string; brandName: string }> =>
  Array.isArray(value) &&
  value.length <= MAX_SYNC_METADATA_ENTRIES &&
  value.every(
    item =>
      isRecord(item) &&
      isBoundedString(item.address, MAX_SYNC_METADATA_ADDRESS_LENGTH) &&
      isBoundedString(item.brandName, MAX_SYNC_METADATA_LABEL_LENGTH),
  );

const isAliasArray = (
  value: unknown,
): value is Array<{ address: string; name: string }> =>
  Array.isArray(value) &&
  value.length <= MAX_SYNC_METADATA_ENTRIES &&
  value.every(
    item =>
      isRecord(item) &&
      isBoundedString(item.address, MAX_SYNC_METADATA_ADDRESS_LENGTH) &&
      isBoundedString(item.name, MAX_SYNC_METADATA_LABEL_LENGTH),
  );

const getCanonicalBase64ByteLength = (value: string, maxBytes: number) => {
  if (
    value.length === 0 ||
    value.length > Math.ceil(maxBytes / 3) * 4 ||
    value.length % 4 !== 0 ||
    !CANONICAL_BASE64_PATTERN.test(value)
  ) {
    return undefined;
  }

  const decoded = Buffer.from(value, 'base64');
  if (decoded.length > maxBytes || decoded.toString('base64') !== value) {
    return undefined;
  }

  return decoded.length;
};

const isValidKeyMetadata = (value: unknown) => {
  if (!isRecord(value) || !hasOnlyKeys(value, ['algorithm', 'params'])) {
    return false;
  }
  if (value.algorithm !== 'PBKDF2' || !isRecord(value.params)) {
    return false;
  }
  if (!hasOnlyKeys(value.params, ['iterations'])) {
    return false;
  }

  const iterations = value.params.iterations;
  return (
    Number.isSafeInteger(iterations) &&
    (iterations as number) >= MIN_SYNC_PBKDF2_ITERATIONS &&
    (iterations as number) <= MAX_SYNC_PBKDF2_ITERATIONS
  );
};

const isValidSyncTransferVault = (
  value: unknown,
): value is SyncTransferVault => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['data', 'iv', 'salt', 'keyMetadata']) ||
    typeof value.data !== 'string' ||
    typeof value.iv !== 'string' ||
    typeof value.salt !== 'string'
  ) {
    return false;
  }

  const dataLength = getCanonicalBase64ByteLength(
    value.data,
    MAX_SYNC_ENCRYPTED_DATA_BYTES,
  );
  const ivLength = getCanonicalBase64ByteLength(
    value.iv,
    SYNC_AES_GCM_IV_BYTES,
  );
  const saltLength = getCanonicalBase64ByteLength(
    value.salt,
    SYNC_PBKDF2_SALT_BYTES,
  );

  if (
    dataLength === undefined ||
    dataLength <= SYNC_AES_GCM_TAG_BYTES ||
    ivLength !== SYNC_AES_GCM_IV_BYTES ||
    saltLength !== SYNC_PBKDF2_SALT_BYTES
  ) {
    return false;
  }

  // browser-passworder v6 fixes SHA-256 and AES-256-GCM in its wire format.
  // A missing keyMetadata object is its legacy 10,000-iteration PBKDF2 format.
  return (
    value.keyMetadata === undefined || isValidKeyMetadata(value.keyMetadata)
  );
};

const uniqueBy = <T>(values: T[], getKey: (value: T) => string) => {
  const seen = new Set<string>();
  return values.filter(value => {
    const key = getKey(value);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const validateSyncTransferPayload = (
  value: unknown,
): SyncExtensionTransferPayload => {
  if (!isRecord(value)) {
    throw new Error('Invalid wallet transfer data');
  }

  const hasFormat = Object.prototype.hasOwnProperty.call(value, 'format');
  const hasVersion = Object.prototype.hasOwnProperty.call(value, 'version');

  // Existing Rabby extension exports predate the envelope fields, so accept
  // payloads where both are absent while validating every versioned payload.
  if (hasFormat || hasVersion) {
    if (value.format !== SYNC_TRANSFER_FORMAT) {
      throw new Error('Unsupported wallet transfer data format');
    }
    if (value.version !== SYNC_TRANSFER_VERSION) {
      throw new Error('Unsupported wallet transfer data version');
    }
  }

  if (!isValidSyncTransferVault(value.vault)) {
    throw new Error('Invalid wallet transfer data');
  }

  if (
    (value.whitelist !== undefined && !isStringArray(value.whitelist)) ||
    (value.highligtedAddresses !== undefined &&
      !isPinnedAddressArray(value.highligtedAddresses)) ||
    (value.alianNames !== undefined && !isAliasArray(value.alianNames))
  ) {
    throw new Error('Invalid wallet transfer metadata');
  }

  return value as SyncExtensionTransferPayload;
};

export const parseSyncExtensionTransferPayload = (
  input: string,
): NormalizedSyncExtensionTransferPayload => {
  if (
    typeof input !== 'string' ||
    input.length === 0 ||
    input.length > MAX_SYNC_PAYLOAD_LENGTH ||
    Buffer.byteLength(input, 'utf8') > MAX_SYNC_PAYLOAD_LENGTH
  ) {
    throw new Error('Wallet transfer data is too large');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error('Invalid wallet transfer data');
  }

  const payload = validateSyncTransferPayload(parsed);
  return {
    ...payload,
    whitelist: uniqueBy(payload.whitelist || [], address =>
      address.toLowerCase(),
    ),
    highligtedAddresses: uniqueBy(
      (payload.highligtedAddresses || []).map(item => ({
        address: item.address,
        brandName: item.brandName,
      })),
      item => JSON.stringify([item.address.toLowerCase(), item.brandName]),
    ),
    alianNames: uniqueBy(
      (payload.alianNames || []).map(item => ({
        address: item.address,
        name: item.name,
      })),
      item => item.address.toLowerCase(),
    ),
  };
};

const gunzipWithLimit = (input: Uint8Array) => {
  const chunks: Uint8Array[] = [];
  let length = 0;
  const gunzip = new Gunzip(chunk => {
    length += chunk.length;
    if (length > MAX_SYNC_PAYLOAD_LENGTH) {
      throw new Error('Wallet transfer data is too large');
    }
    chunks.push(chunk.slice());
  });

  gunzip.push(input, true);

  const result = new Uint8Array(length);
  let offset = 0;
  chunks.forEach(chunk => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
};

export const createSyncUREncoder = (input: string) =>
  new UREncoder(
    // Rabby extension intentionally stores gzip bytes directly in UR.cbor.
    // Using UR.fromBuffer here would add another CBOR layer and break existing
    // extension-to-mobile transfer QR codes.
    new UR(Buffer.from(gzipSync(strToU8(input))), 'bytes'),
    SYNC_UR_FRAGMENT_LENGTH,
  );

export const getSyncVideoFrameCount = (encoder: UREncoder) => {
  if (encoder.fragmentsLength > MAX_SYNC_VIDEO_FRAGMENTS) {
    throw new Error('Wallet transfer data is too large for video export');
  }

  return Math.max(20, encoder.fragmentsLength * SYNC_VIDEO_REDUNDANCY);
};

export const isSyncURPart = (value: string) => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_SYNC_UR_PART_LENGTH
  ) {
    return false;
  }

  const components = value.split('/');
  if (
    components[0]?.toLowerCase() !== 'ur:bytes' ||
    components.length < 2 ||
    components.length > 3
  ) {
    return false;
  }

  if (components.length === 2) {
    return BYTEWORDS_BODY_PATTERN.test(components[1] || '');
  }

  const sequenceMatch = MULTI_PART_SEQUENCE_PATTERN.exec(components[1] || '');
  if (!sequenceMatch || !BYTEWORDS_BODY_PATTERN.test(components[2] || '')) {
    return false;
  }

  const sequenceNumber = Number(sequenceMatch[1]);
  const sequenceLength = Number(sequenceMatch[2]);
  return (
    Number.isSafeInteger(sequenceNumber) &&
    sequenceNumber > 0 &&
    sequenceNumber <= 0xffffffff &&
    Number.isSafeInteger(sequenceLength) &&
    sequenceLength > 0 &&
    sequenceLength <= MAX_SYNC_UR_PARTS
  );
};

export const decodeSyncUR = (decoder: URDecoder) => {
  if (!decoder.isComplete() || !decoder.isSuccess()) {
    throw new Error('Incomplete wallet transfer QR code');
  }

  const result = decoder.resultUR();
  if (result.type !== 'bytes') {
    throw new Error('Unsupported wallet transfer QR code');
  }

  const decodedBytes = gunzipWithLimit(Uint8Array.from(result.cbor));
  const decoded = strFromU8(decodedBytes);
  if (!decoded || decoded.length > MAX_SYNC_PAYLOAD_LENGTH) {
    throw new Error('Wallet transfer data is too large');
  }

  parseSyncExtensionTransferPayload(decoded);

  return decoded;
};

export const receiveSyncURPart = (decoder: URDecoder, value: string) => {
  if (!isSyncURPart(value)) {
    return { accepted: false, progress: decoder.getProgress() };
  }

  decoder.receivePart(value);

  return {
    accepted: true,
    progress: Math.min(1, Math.max(0, decoder.getProgress())),
    result: decoder.isComplete() ? decodeSyncUR(decoder) : undefined,
  };
};
