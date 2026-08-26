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
