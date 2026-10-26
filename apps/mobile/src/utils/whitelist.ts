import { addressUtils } from '@rabby-wallet/base-utils';

const { isSameAddress } = addressUtils;

export type WhitelistRecord = {
  address: string;
  addedAt?: number | null;
};

type WhitelistRecordLike = string | WhitelistRecord;

function toWhitelistRecord(
  recordLike: WhitelistRecordLike,
): WhitelistRecord | null {
  const address =
    typeof recordLike === 'string' ? recordLike : recordLike?.address;

  if (!address) {
    return null;
  }

  const normalizedAddress = address.toLowerCase();

  return typeof recordLike === 'string'
    ? { address: normalizedAddress }
    : {
        ...recordLike,
        address: normalizedAddress,
      };
}

export function normalizeWhitelistRecords(records: WhitelistRecordLike[] = []) {
  return records.reduce<WhitelistRecord[]>((result, recordLike) => {
    const record = toWhitelistRecord(recordLike);
    if (!record) {
      return result;
    }

    if (result.some(item => isSameAddress(item.address, record.address))) {
      return result;
    }

    result.push(record);
    return result;
  }, []);
}

export function normalizeWhitelistAddresses(addresses: string[] = []) {
  return normalizeWhitelistRecords(addresses).map(item => item.address);
}

export function mergeWhitelistAddresses(
  currentAddresses: string[] = [],
  incomingAddresses: string[] = [],
) {
  return mergeWhitelistRecords(currentAddresses, incomingAddresses).map(
    item => item.address,
  );
}

export function mergeWhitelistRecords(
  currentRecords: WhitelistRecordLike[] = [],
  incomingRecords: WhitelistRecordLike[] = [],
) {
  const mergedRecords = normalizeWhitelistRecords(currentRecords);

  incomingRecords.forEach(recordLike => {
    const record = toWhitelistRecord(recordLike);
    if (!record) {
      return;
    }

    if (
      mergedRecords.some(item => isSameAddress(item.address, record.address))
    ) {
      return;
    }

    mergedRecords.push(record);
  });

  return mergedRecords;
}

export function addWhitelistRecord(
  currentRecords: WhitelistRecordLike[] = [],
  address: string,
  now = Date.now(),
) {
  const mergedRecords = mergeWhitelistRecords(currentRecords, [
    {
      address,
      addedAt: now,
    },
  ]);

  return mergedRecords.map(record =>
    isSameAddress(record.address, address) && record.addedAt == null
      ? {
          ...record,
          addedAt: now,
        }
      : record,
  );
}

export function syncWhitelistRecords(
  currentRecords: WhitelistRecordLike[] = [],
  nextAddresses: string[] = [],
  now = Date.now(),
) {
  const currentNormalized = normalizeWhitelistRecords(currentRecords);
  const currentMap = currentNormalized.reduce<Record<string, WhitelistRecord>>(
    (result, record) => {
      result[record.address] = record;
      return result;
    },
    {},
  );

  return normalizeWhitelistAddresses(nextAddresses).map(address => {
    return currentMap[address] || { address, addedAt: now };
  });
}

export function reorderWhitelistRecords(
  currentRecords: WhitelistRecordLike[] = [],
  nextAddresses: string[],
) {
  if (!Array.isArray(currentRecords) || !Array.isArray(nextAddresses)) {
    throw new Error('Invalid whitelist order');
  }

  const current = currentRecords.map(recordLike => {
    const record = toWhitelistRecord(recordLike);
    if (!record) {
      throw new Error('Invalid whitelist order');
    }
    return typeof recordLike !== 'string' &&
      recordLike.address === record.address
      ? recordLike
      : record;
  });
  const currentAddresses = current.map(record => record.address);
  const next = nextAddresses.map(address => {
    if (typeof address !== 'string' || !address) {
      throw new Error('Invalid whitelist order');
    }

    return address.toLowerCase();
  });

  const currentSet = new Set(currentAddresses);
  const nextSet = new Set(next);

  if (
    currentAddresses.length !== next.length ||
    currentSet.size !== currentAddresses.length ||
    nextSet.size !== next.length ||
    currentAddresses.some(address => !nextSet.has(address)) ||
    next.some(address => !currentSet.has(address))
  ) {
    throw new Error('Invalid whitelist order');
  }

  const currentMap = current.reduce<Record<string, WhitelistRecord>>(
    (result, record) => {
      result[record.address] = record;
      return result;
    },
    {},
  );

  return next.map(address => currentMap[address]);
}

export function sortWhitelistRecords(
  records: WhitelistRecord[] = [],
  resolvedAddedAtByAddress: Record<string, number | null | undefined> = {},
) {
  const normalizedRecords = normalizeWhitelistRecords(records);

  return [...normalizedRecords].sort((left, right) => {
    const leftAddedAt =
      left.addedAt ?? resolvedAddedAtByAddress[left.address] ?? null;
    const rightAddedAt =
      right.addedAt ?? resolvedAddedAtByAddress[right.address] ?? null;

    if (leftAddedAt != null && rightAddedAt != null) {
      if (leftAddedAt !== rightAddedAt) {
        return rightAddedAt - leftAddedAt;
      }
      return left.address.localeCompare(right.address);
    }

    if (leftAddedAt != null) {
      return -1;
    }

    if (rightAddedAt != null) {
      return 1;
    }

    return left.address.localeCompare(right.address);
  });
}
