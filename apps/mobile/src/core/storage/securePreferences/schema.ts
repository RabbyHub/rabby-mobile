import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { APP_STORE_NAMES } from '../storeConstant';

export const securePreferenceNames = [
  APP_STORE_NAMES.whitelist,
  APP_STORE_NAMES.contactBook,
  APP_STORE_NAMES.securityEngine,
  APP_STORE_NAMES.rpc,
] as const;

export type SecurePreferenceName = (typeof securePreferenceNames)[number];
export type PreferenceRecord = Record<string, unknown>;

export function asRecord(value: unknown): PreferenceRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as PreferenceRecord)
    : undefined;
}

function isAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isArrayOf(value: unknown, validate: (item: unknown) => boolean) {
  return Array.isArray(value) && value.every(validate);
}

function isAddressMap(value: unknown, label: 'name' | 'alias') {
  const record = asRecord(value);
  return (
    record &&
    Object.entries(record).every(([key, entry]) => {
      const item = asRecord(entry);
      return (
        isAddress(key) &&
        isAddress(item?.address) &&
        isSameAddress(key, item.address) &&
        isString(item[label]) &&
        (label === 'name' ||
          item.isDefaultAlias === undefined ||
          typeof item.isDefaultAlias === 'boolean')
      );
    })
  );
}

function validateSecurityEngine(value: PreferenceRecord) {
  const data = asRecord(value.userData);
  return (
    (value.userData === undefined ||
      (data &&
        ['originWhitelist', 'originBlacklist'].every(key =>
          isArrayOf(data[key], isString),
        ) &&
        ['addressWhitelist', 'addressBlacklist'].every(
          key => data[key] === undefined || isArrayOf(data[key], isAddress),
        ) &&
        ['contractWhitelist', 'contractBlacklist'].every(
          key =>
            data[key] === undefined ||
            isArrayOf(data[key], entry => {
              const contract = asRecord(entry);
              return isAddress(contract?.address) && isString(contract.chainId);
            }),
        ))) &&
    (value.rules === undefined ||
      isArrayOf(value.rules, entry => {
        const rule = asRecord(entry);
        const thresholds = asRecord(rule?.customThreshold);
        return Boolean(
          rule &&
            isString(rule.id) &&
            typeof rule.enable === 'boolean' &&
            thresholds &&
            Object.values(thresholds).every(threshold => {
              if (
                typeof threshold === 'boolean' ||
                isArrayOf(threshold, isString)
              ) {
                return true;
              }
              const range = asRecord(threshold);
              return (
                range &&
                (range.min === null || Number.isFinite(range.min)) &&
                (range.max === null || Number.isFinite(range.max)) &&
                typeof range.minIncluded === 'boolean' &&
                typeof range.maxIncluded === 'boolean'
              );
            }),
        );
      }))
  );
}

// Legacy keys can vary in case. Prefer the existing lowercase entry if both exist.
function normalizeAddressMap(value: unknown) {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }
  const normalized: PreferenceRecord = {};
  for (const [key, item] of Object.entries(record)) {
    const canonicalKey = key.toLowerCase();
    normalized[canonicalKey] = record[canonicalKey] ?? item;
  }
  return normalized;
}

export const projectPreference = {
  [APP_STORE_NAMES.whitelist](value: PreferenceRecord) {
    return { enabled: value.enabled, whitelists: value.whitelists };
  },
  [APP_STORE_NAMES.contactBook](value: PreferenceRecord) {
    return {
      contacts: value.contacts,
      aliases: value.aliases,
    };
  },
  [APP_STORE_NAMES.securityEngine](value: PreferenceRecord) {
    return { userData: value.userData, rules: value.rules };
  },
  [APP_STORE_NAMES.rpc](value: PreferenceRecord) {
    return { customRPC: value.customRPC };
  },
};

export function projectLegacyPreference(
  name: SecurePreferenceName,
  value: PreferenceRecord,
) {
  if (name === APP_STORE_NAMES.contactBook) {
    return {
      contacts: normalizeAddressMap(value.contacts),
      aliases: normalizeAddressMap(value.aliases),
    };
  }
  return projectPreference[name](value);
}

export function getRPCServerCache(value: PreferenceRecord | undefined) {
  const cache: PreferenceRecord = {};
  const defaultRPC = asRecord(value?.defaultRPC);
  if (defaultRPC) {
    cache.defaultRPC = defaultRPC;
  }
  const lastUpdateAt = value?.defaultRPCLastUpdateAt;
  if (typeof lastUpdateAt === 'number' && Number.isFinite(lastUpdateAt)) {
    cache.defaultRPCLastUpdateAt = lastUpdateAt;
  }
  return cache;
}

export function isValidPreference(
  name: SecurePreferenceName,
  value: PreferenceRecord,
) {
  switch (name) {
    case APP_STORE_NAMES.whitelist:
      return (
        (value.enabled === undefined || typeof value.enabled === 'boolean') &&
        (value.whitelists === undefined ||
          isArrayOf(value.whitelists, entry => {
            const item = asRecord(entry);
            return (
              isAddress(entry) ||
              (isAddress(item?.address) &&
                (item.addedAt == null || Number.isFinite(item.addedAt)))
            );
          }))
      );
    case APP_STORE_NAMES.contactBook:
      return (
        (value.contacts === undefined ||
          isAddressMap(value.contacts, 'name')) &&
        (value.aliases === undefined || isAddressMap(value.aliases, 'alias'))
      );
    case APP_STORE_NAMES.securityEngine:
      return validateSecurityEngine(value);
    case APP_STORE_NAMES.rpc: {
      const chains = asRecord(value.customRPC);
      return (
        value.customRPC === undefined ||
        (chains &&
          Object.entries(chains).every(([chain, entry]) => {
            const rpc = asRecord(entry);
            return (
              /^[A-Z0-9_-]+$/i.test(chain) &&
              isString(rpc?.url) &&
              /^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(rpc.url) &&
              typeof rpc.enable === 'boolean'
            );
          }))
      );
    }
  }
}
