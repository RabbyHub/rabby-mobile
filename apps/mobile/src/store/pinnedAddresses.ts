import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

import type { IPinAddress } from '@/types/account';

export function isSamePinnedAddress(left: IPinAddress, right: IPinAddress) {
  return (
    left.brandName === right.brandName &&
    isSameAddress(left.address, right.address)
  );
}

export function normalizePinnedAddresses(addresses: IPinAddress[]) {
  return addresses.reduce<IPinAddress[]>((result, item) => {
    if (
      !item.brandName ||
      !item.address ||
      result.some(existing => isSamePinnedAddress(existing, item))
    ) {
      return result;
    }

    result.push(item);
    return result;
  }, []);
}

export function updatePinnedAddressList(
  addresses: IPinAddress[],
  payload: IPinAddress & { nextPinned?: boolean },
) {
  const normalized = normalizePinnedAddresses(addresses);
  const wasPinned = normalized.some(item => isSamePinnedAddress(item, payload));
  const nextPinned = payload.nextPinned ?? !wasPinned;
  const nextAddresses = normalized.filter(
    item => !isSamePinnedAddress(item, payload),
  );

  if (nextPinned) {
    nextAddresses.unshift({
      brandName: payload.brandName,
      address: payload.address,
    });
  }

  return {
    nextPinned,
    nextAddresses,
  };
}
