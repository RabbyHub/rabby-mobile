import { apisSafe } from '@/core/apis/safe';
import { subscribeGnosisNetworks } from '@/core/utils/safeNetworkEvents';
import { useMemoizedFn, useRequest } from 'ahooks';
import { useEffect } from 'react';

export const useGnosisNetworks = (params: {
  address?: string;
  active?: boolean;
}) => {
  const address = params.address?.toLowerCase();
  const active = params.active ?? true;
  const local = useRequest(
    async (currentAddress: string) => ({
      address: currentAddress,
      networks: await apisSafe.getGnosisNetworkIds(currentAddress),
    }),
    { manual: true },
  );
  const publish = useMemoizedFn(
    (currentAddress: string, networks: string[]) => {
      // A local read started before this event must not overwrite the update.
      local.cancel();
      local.mutate(previous =>
        previous?.address === currentAddress &&
        previous.networks.length === networks.length &&
        previous.networks.every((id, index) => id === networks[index])
          ? previous
          : { address: currentAddress, networks },
      );
    },
  );
  const sync = useRequest(
    (currentAddress: string) => apisSafe.syncGnosisNetworks(currentAddress),
    {
      manual: true,
      onSuccess(networks, [currentAddress]) {
        if (networks) {
          publish(currentAddress, networks);
        }
      },
    },
  );

  const syncNetworks = useMemoizedFn(async () => {
    if (!address || !active) {
      return;
    }
    return sync.runAsync(address);
  });
  const { run: readLocal, cancel: cancelLocal } = local;
  const { run: runSync, cancel: cancelSync } = sync;

  useEffect(() => {
    if (!address || !active) {
      return;
    }
    const unsubscribe = subscribeGnosisNetworks(address, networks =>
      publish(address, networks),
    );
    // Render the stored list immediately; remote discovery is background work.
    readLocal(address);
    runSync(address);
    return () => {
      unsubscribe();
      cancelLocal();
      cancelSync();
    };
  }, [address, active, readLocal, cancelLocal, runSync, cancelSync, publish]);

  return {
    data: local.data?.address === address ? local.data?.networks : undefined,
    loading: local.loading,
    error: sync.error || local.error,
    syncing: sync.loading,
    syncNetworks,
  };
};
