const BASE45_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const BASE45_VALUE_BY_CHARACTER = new Map(
  [...BASE45_ALPHABET].map((character, index) => [character, index]),
);

export const REGRESSION_WATCH_ADDRESS_QR_PREFIX = 'RABBY-WATCH-V1:';
export const MAX_REGRESSION_WATCH_ADDRESS_FIXTURE_ADDRESSES = 120;

export function normalizeRegressionWatchAddresses(addresses: string[]) {
  const normalized = addresses.map(address => address.trim().toLowerCase());
  if (normalized.some(address => !/^0x[a-f0-9]{40}$/.test(address))) {
    throw new Error('Watch-address fixture contains an invalid EVM address');
  }

  const uniqueAddresses = [...new Set(normalized)];
  if (!uniqueAddresses.length) {
    throw new Error('Watch-address fixture contains no EVM addresses');
  }
  if (uniqueAddresses.length > MAX_REGRESSION_WATCH_ADDRESS_FIXTURE_ADDRESSES) {
    throw new Error(
      `Watch-address fixture exceeds ${MAX_REGRESSION_WATCH_ADDRESS_FIXTURE_ADDRESSES} addresses`,
    );
  }
  return uniqueAddresses;
}

function encodeBase45(bytes: number[]) {
  let result = '';
  for (let index = 0; index < bytes.length; index += 2) {
    if (index + 1 < bytes.length) {
      let value = bytes[index]! * 256 + bytes[index + 1]!;
      result += BASE45_ALPHABET[value % 45];
      value = Math.floor(value / 45);
      result += BASE45_ALPHABET[value % 45];
      result += BASE45_ALPHABET[Math.floor(value / 45)];
    } else {
      const value = bytes[index]!;
      result += BASE45_ALPHABET[value % 45];
      result += BASE45_ALPHABET[Math.floor(value / 45)];
    }
  }
  return result;
}

function decodeBase45(value: string) {
  if (value.length % 3 === 1) {
    throw new Error('Watch-address QR payload has an invalid Base45 length');
  }

  const bytes: number[] = [];
  for (let index = 0; index < value.length; ) {
    const remaining = value.length - index;
    const groupLength = remaining >= 3 ? 3 : 2;
    const first = BASE45_VALUE_BY_CHARACTER.get(value[index]!);
    const second = BASE45_VALUE_BY_CHARACTER.get(value[index + 1]!);
    const third =
      groupLength === 3
        ? BASE45_VALUE_BY_CHARACTER.get(value[index + 2]!)
        : undefined;

    if (
      first === undefined ||
      second === undefined ||
      (third === undefined && groupLength === 3)
    ) {
      throw new Error('Watch-address QR payload contains invalid Base45 data');
    }

    const decoded =
      first + second * 45 + (groupLength === 3 ? third! * 45 * 45 : 0);
    if (groupLength === 3) {
      if (decoded > 0xffff) {
        throw new Error(
          'Watch-address QR payload contains invalid Base45 data',
        );
      }
      bytes.push(Math.floor(decoded / 256), decoded % 256);
    } else {
      if (decoded > 0xff) {
        throw new Error(
          'Watch-address QR payload contains invalid Base45 data',
        );
      }
      bytes.push(decoded);
    }
    index += groupLength;
  }
  return bytes;
}

export function encodeRegressionWatchAddressQrPayload(addresses: string[]) {
  const normalized = normalizeRegressionWatchAddresses(addresses);
  const bytes = normalized.flatMap(address => {
    const hex = address.slice(2);
    return Array.from({ length: 20 }, (_, index) =>
      Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
    );
  });
  return REGRESSION_WATCH_ADDRESS_QR_PREFIX + encodeBase45(bytes);
}

export function decodeRegressionWatchAddressQrPayload(payload: string) {
  if (!payload.startsWith(REGRESSION_WATCH_ADDRESS_QR_PREFIX)) {
    throw new Error('Watch-address QR payload has an unsupported format');
  }

  const bytes = decodeBase45(
    payload.slice(REGRESSION_WATCH_ADDRESS_QR_PREFIX.length),
  );
  if (!bytes.length || bytes.length % 20 !== 0) {
    throw new Error('Watch-address QR payload has an invalid address length');
  }

  const addresses = Array.from(
    { length: bytes.length / 20 },
    (_, addressIndex) => {
      const hex = bytes
        .slice(addressIndex * 20, addressIndex * 20 + 20)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
      return `0x${hex}`;
    },
  );
  return normalizeRegressionWatchAddresses(addresses);
}
