import { chunk } from 'lodash';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

export function createHomeAssetBatchFetcher<
  T extends { id: string; error_code: number },
>(addresses: string[], request: (addresses: string[]) => Promise<T[]>) {
  const loaders = new Map<string, () => Promise<T[]>>();

  for (const batch of chunk(addresses, 10)) {
    let pending: Promise<T[]> | undefined;
    // Start on first demand so the caller's queue still controls request timing.
    const load = () => (pending ??= request(batch));
    batch.forEach(address => loaders.set(address.toLowerCase(), load));
  }

  return async (address: string): Promise<T> => {
    const load = loaders.get(address.toLowerCase());
    if (!load) {
      throw new Error(`Address is not in the Home asset batch: ${address}`);
    }
    const result = (await load()).find(item => isSameAddress(item.id, address));
    if (!result || result.error_code !== 0) {
      throw new Error(`Home asset batch failed for ${address}`);
    }
    return result;
  };
}
