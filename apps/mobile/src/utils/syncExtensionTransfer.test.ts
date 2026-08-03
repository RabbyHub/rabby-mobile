import { UR, URDecoder, UREncoder } from '@ngraveio/bc-ur';
import { gzipSync, strToU8 } from 'fflate';

import {
  MAX_SYNC_ENCRYPTED_DATA_BYTES,
  MAX_SYNC_METADATA_ADDRESS_LENGTH,
  MAX_SYNC_METADATA_ENTRIES,
  MAX_SYNC_METADATA_LABEL_LENGTH,
  MAX_SYNC_PAYLOAD_LENGTH,
  MAX_SYNC_UR_PARTS,
  SYNC_TRANSFER_FORMAT,
  SYNC_TRANSFER_VERSION,
  SYNC_UR_FRAGMENT_LENGTH,
  createSyncUREncoder,
  decodeSyncUR,
  isSyncURPart,
  parseSyncExtensionTransferPayload,
  receiveSyncURPart,
} from './syncExtensionTransfer';

const createVault = () => ({
  data: Buffer.alloc(48, 0xa5).toString('base64'),
  iv: Buffer.alloc(16, 0xb6).toString('base64'),
  salt: Buffer.alloc(32, 0xc7).toString('base64'),
  keyMetadata: {
    algorithm: 'PBKDF2',
    params: { iterations: 900000 },
  },
});

const createPayload = (byteCount = 4000) => {
  let state = 0x12345678;
  const data = Buffer.from(
    Array.from({ length: byteCount }, () => {
      state = (state * 1664525 + 1013904223) % 0x100000000;
      return Math.floor(state / 0x1000000);
    }),
  ).toString('base64');

  return JSON.stringify({
    format: SYNC_TRANSFER_FORMAT,
    version: SYNC_TRANSFER_VERSION,
    vault: {
      ...createVault(),
      data,
    },
    whitelist: [],
    highligtedAddresses: [],
    alianNames: [],
  });
};

const createRawEncoder = (input: string, type = 'bytes') =>
  new UREncoder(
    new UR(Buffer.from(gzipSync(strToU8(input))), type),
    SYNC_UR_FRAGMENT_LENGTH,
  );

const decodeEncoder = (encoder: UREncoder) => {
  const decoder = new URDecoder();
  let result: string | undefined;

  encoder.encodeWhole().forEach(part => {
    result = receiveSyncURPart(decoder, part).result ?? result;
  });

  return { decoder, result };
};

const completeDecoder = (encoder: UREncoder) => {
  const decoder = new URDecoder();
  encoder.encodeWhole().forEach(part => decoder.receivePart(part));
  return decoder;
};

describe('syncExtensionTransfer', () => {
  it('round-trips a real multi-part Rabby transfer encoder', () => {
    const payload = createPayload();
    const encoder = createSyncUREncoder(payload);
    const { decoder, result } = decodeEncoder(encoder);

    expect(encoder.fragmentsLength).toBeGreaterThan(1);
    expect(decoder.isComplete()).toBe(true);
    expect(decoder.isSuccess()).toBe(true);
    expect(result).toBe(payload);
  });

  it('recovers from duplicate, omitted, and out-of-order fountain parts', () => {
    const payload = createPayload();
    const encoder = createSyncUREncoder(payload);
    const fragmentCount = encoder.fragmentsLength;
    const generatedParts = Array.from({ length: fragmentCount * 4 }, () =>
      encoder.nextPart(),
    );
    const omittedIndexes = new Set([
      1,
      Math.floor(fragmentCount / 3),
      Math.floor((fragmentCount * 2) / 3),
    ]);
    const retainedParts = generatedParts.filter(
      (_, index) => index >= fragmentCount || !omittedIndexes.has(index),
    );
    const duplicatePart = retainedParts[retainedParts.length - 1]!;
    const deliveredParts = [
      duplicatePart,
      duplicatePart,
      ...retainedParts.slice().reverse(),
    ];
    const decoder = new URDecoder();
    let result: string | undefined;

    for (const part of deliveredParts) {
      if (decoder.isComplete()) {
        break;
      }
      result = receiveSyncURPart(decoder, part).result ?? result;
    }

    expect(decoder.isComplete()).toBe(true);
    expect(result).toBe(payload);
  });

  it('rejects malformed parts, other UR types, and oversized part counts', () => {
    const decoder = new URDecoder();

    expect(isSyncURPart('not-a-ur')).toBe(false);
    expect(isSyncURPart('ur:bytes/1-2/abcd/extra')).toBe(false);
    expect(isSyncURPart(`ur:bytes/1-${MAX_SYNC_UR_PARTS + 1}/abcd`)).toBe(
      false,
    );
    expect(receiveSyncURPart(decoder, 'ur:crypto-psbt/abcd')).toEqual({
      accepted: false,
      progress: 0,
    });

    const otherTypeEncoder = createRawEncoder(createPayload(64), 'crypto-psbt');
    const otherTypeDecoder = new URDecoder();
    otherTypeEncoder
      .encodeWhole()
      .forEach(part => otherTypeDecoder.receivePart(part));
    expect(() => decodeSyncUR(otherTypeDecoder)).toThrow(
      'Unsupported wallet transfer QR code',
    );
  });

  it.each([
    [
      'format',
      {
        format: 'another-wallet-transfer',
        version: SYNC_TRANSFER_VERSION,
        vault: createVault(),
      },
      'Unsupported wallet transfer data format',
    ],
    [
      'version',
      {
        format: SYNC_TRANSFER_FORMAT,
        version: SYNC_TRANSFER_VERSION + 1,
        vault: createVault(),
      },
      'Unsupported wallet transfer data version',
    ],
    [
      'vault',
      {
        format: SYNC_TRANSFER_FORMAT,
        version: SYNC_TRANSFER_VERSION,
        vault: {},
      },
      'Invalid wallet transfer data',
    ],
  ])('rejects an invalid %s payload', (_, payload, expectedError) => {
    const decoder = completeDecoder(createRawEncoder(JSON.stringify(payload)));

    expect(() => decodeSyncUR(decoder)).toThrow(expectedError);
  });

  it('accepts a legacy Rabby payload without format and version fields', () => {
    const payload = JSON.stringify({ vault: createVault() });
    const { result } = decodeEncoder(createSyncUREncoder(payload));

    expect(result).toBe(payload);
    expect(parseSyncExtensionTransferPayload(payload)).toMatchObject({
      whitelist: [],
      highligtedAddresses: [],
      alianNames: [],
    });
  });

  it('accepts both browser-passworder legacy and current PBKDF2 costs', () => {
    const legacyVault = createVault();
    delete (legacyVault as Partial<typeof legacyVault>).keyMetadata;
    expect(
      parseSyncExtensionTransferPayload(JSON.stringify({ vault: legacyVault }))
        .vault,
    ).toEqual(legacyVault);

    expect(
      parseSyncExtensionTransferPayload(
        JSON.stringify({
          vault: {
            ...createVault(),
            keyMetadata: {
              algorithm: 'PBKDF2',
              params: { iterations: 10_000 },
            },
          },
        }),
      ).vault.keyMetadata?.params.iterations,
    ).toBe(10_000);
  });

  it.each([
    ['non-canonical data base64', { data: 'AA=A' }],
    ['short AES-GCM data', { data: Buffer.alloc(16).toString('base64') }],
    ['wrong AES-GCM IV size', { iv: Buffer.alloc(12).toString('base64') }],
    ['wrong PBKDF2 salt size', { salt: Buffer.alloc(16).toString('base64') }],
    [
      'unsupported derivation algorithm',
      {
        keyMetadata: {
          algorithm: 'scrypt',
          params: { iterations: 900_000 },
        },
      },
    ],
    [
      'excessive PBKDF2 cost',
      {
        keyMetadata: {
          algorithm: 'PBKDF2',
          params: { iterations: 1_000_001 },
        },
      },
    ],
    [
      'fractional PBKDF2 cost',
      {
        keyMetadata: {
          algorithm: 'PBKDF2',
          params: { iterations: 900_000.5 },
        },
      },
    ],
    ['unexpected encryption field', { cipher: 'AES-GCM' }],
  ])('rejects a malicious browser-passworder envelope: %s', (_, override) => {
    const payload = JSON.stringify({
      vault: { ...createVault(), ...override },
    });

    expect(() => parseSyncExtensionTransferPayload(payload)).toThrow(
      'Invalid wallet transfer data',
    );
  });

  it('rejects an oversized encrypted vault before decryption', () => {
    const payload = JSON.stringify({
      vault: {
        ...createVault(),
        data: Buffer.alloc(MAX_SYNC_ENCRYPTED_DATA_BYTES + 1).toString(
          'base64',
        ),
      },
    });

    expect(Buffer.byteLength(payload)).toBeLessThan(MAX_SYNC_PAYLOAD_LENGTH);
    expect(() => parseSyncExtensionTransferPayload(payload)).toThrow(
      'Invalid wallet transfer data',
    );
  });

  it('bounds, de-duplicates, and projects real extension metadata fields', () => {
    const address = '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa';
    const duplicateAddress = address.toLowerCase();
    const payload = JSON.stringify({
      vault: createVault(),
      whitelist: [address, duplicateAddress],
      highligtedAddresses: [
        { address, brandName: 'Watch Address', legacyField: true },
        { address: duplicateAddress, brandName: 'Watch Address' },
        { address, brandName: 'Ledger' },
      ],
      alianNames: [
        {
          address,
          name: 'First',
          isAlias: true,
          isContact: false,
          cexId: 'binance',
        },
        { address: duplicateAddress, name: 'Ignored duplicate' },
      ],
    });

    expect(parseSyncExtensionTransferPayload(payload)).toMatchObject({
      whitelist: [address],
      highligtedAddresses: [
        { address, brandName: 'Watch Address' },
        { address, brandName: 'Ledger' },
      ],
      alianNames: [{ address, name: 'First' }],
    });
  });

  it.each([
    [
      'entry count',
      {
        whitelist: Array(MAX_SYNC_METADATA_ENTRIES + 1).fill(
          '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        ),
      },
    ],
    [
      'address length',
      { whitelist: ['a'.repeat(MAX_SYNC_METADATA_ADDRESS_LENGTH + 1)] },
    ],
    [
      'brand length',
      {
        highligtedAddresses: [
          {
            address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            brandName: 'b'.repeat(MAX_SYNC_METADATA_LABEL_LENGTH + 1),
          },
        ],
      },
    ],
    [
      'alias length',
      {
        alianNames: [
          {
            address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            name: 'n'.repeat(MAX_SYNC_METADATA_LABEL_LENGTH + 1),
          },
        ],
      },
    ],
  ])('rejects metadata above the %s limit', (_, metadata) => {
    expect(() =>
      parseSyncExtensionTransferPayload(
        JSON.stringify({ vault: createVault(), ...metadata }),
      ),
    ).toThrow('Invalid wallet transfer metadata');
  });

  it('rejects malformed transfer metadata before importing it', () => {
    const payload = JSON.stringify({
      format: SYNC_TRANSFER_FORMAT,
      version: SYNC_TRANSFER_VERSION,
      vault: createVault(),
      whitelist: 'not-an-array',
    });

    expect(() => parseSyncExtensionTransferPayload(payload)).toThrow(
      'Invalid wallet transfer metadata',
    );
  });

  it('rejects invalid JSON after decoding', () => {
    const decoder = completeDecoder(createRawEncoder('{invalid-json'));

    expect(() => decodeSyncUR(decoder)).toThrow('Invalid wallet transfer data');
  });

  it('rejects a direct payload above the total size limit before parsing', () => {
    expect(() =>
      parseSyncExtensionTransferPayload(
        'x'.repeat(MAX_SYNC_PAYLOAD_LENGTH + 1),
      ),
    ).toThrow('Wallet transfer data is too large');
  });

  it('stops streaming decompression above the payload limit', () => {
    const oversizedPayload = JSON.stringify({
      format: SYNC_TRANSFER_FORMAT,
      version: SYNC_TRANSFER_VERSION,
      vault: createVault(),
      padding: 'x'.repeat(MAX_SYNC_PAYLOAD_LENGTH),
    });
    const decoder = completeDecoder(createRawEncoder(oversizedPayload));

    expect(() => decodeSyncUR(decoder)).toThrow(
      'Wallet transfer data is too large',
    );
  });
});
