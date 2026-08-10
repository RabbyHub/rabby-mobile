export type SingleAddressAssetDataTab = 'defi' | 'nft';

export type SingleAddressAssetDataInput = {
  address: string;
  chainServerId?: string;
};

type SingleAddressAssetDataCoordinatorDependencies = {
  loadDefi: (address: string) => Promise<void>;
  loadNft: (address: string) => Promise<void>;
  registerDefi: (address: string, chainServerId?: string) => void;
  registerNft: (address: string, chainServerId?: string) => void;
  now?: () => number;
  reuseMs?: number;
};

const DEFAULT_REUSE_MS = 10_000;

const getRequestKey = (tab: SingleAddressAssetDataTab, address: string) =>
  `${tab}:${address.toLowerCase()}`;

export function createSingleAddressAssetDataCoordinator({
  loadDefi,
  loadNft,
  registerDefi,
  registerNft,
  now = Date.now,
  reuseMs = DEFAULT_REUSE_MS,
}: SingleAddressAssetDataCoordinatorDependencies) {
  const inFlight = new Map<string, Promise<void>>();
  const completedAt = new Map<string, number>();

  const prepare = ({ address, chainServerId }: SingleAddressAssetDataInput) => {
    const normalizedAddress = address.toLowerCase();
    registerDefi(normalizedAddress, chainServerId);
    registerNft(normalizedAddress, chainServerId);
  };

  const ensure = (
    tab: SingleAddressAssetDataTab,
    { address, chainServerId }: SingleAddressAssetDataInput,
  ) => {
    const normalizedAddress = address.toLowerCase();
    const key = getRequestKey(tab, normalizedAddress);
    const activeRequest = inFlight.get(key);
    if (activeRequest) {
      return activeRequest;
    }

    const previousCompletedAt = completedAt.get(key);
    if (
      previousCompletedAt !== undefined &&
      now() - previousCompletedAt < reuseMs
    ) {
      return Promise.resolve();
    }

    if (tab === 'defi') {
      registerDefi(normalizedAddress, chainServerId);
    } else {
      registerNft(normalizedAddress, chainServerId);
    }

    const request = Promise.resolve().then(() =>
      tab === 'defi' ? loadDefi(normalizedAddress) : loadNft(normalizedAddress),
    );
    inFlight.set(key, request);

    return request.then(
      () => {
        if (inFlight.get(key) === request) {
          inFlight.delete(key);
          completedAt.set(key, now());
        }
      },
      error => {
        if (inFlight.get(key) === request) {
          inFlight.delete(key);
        }
        throw error;
      },
    );
  };

  const warm = async (input: SingleAddressAssetDataInput) => {
    prepare(input);
    await ensure('defi', input);
    await ensure('nft', input);
  };

  return {
    ensure,
    prepare,
    warm,
  };
}
