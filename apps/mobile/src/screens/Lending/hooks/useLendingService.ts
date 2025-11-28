import { CHAINS_ENUM } from '@/constant/chains';
import { lendingService } from '@/core/services/shared';
import type { LendingServiceStore } from '@/core/services/lendingService';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { useMemo } from 'react';
import { CustomMarket } from '../config/market';

export const lendingAtom = atom<LendingServiceStore>({
  lastSelectedChain: CustomMarket.proto_mainnet_v3,
  skipHealthFactorWarning: false,
});
lendingAtom.onMount = setter => {
  Promise.all([
    lendingService.getLastSelectedChain(),
    lendingService.getSkipHealthFactorWarning(),
  ])
    .then(([chainId, skipWarning]) => {
      setter({
        lastSelectedChain: chainId,
        skipHealthFactorWarning: skipWarning,
      });
    })
    .catch(error => {
      console.error('Failed to initialize lending service state:', error);
    });
};

export const useLendingService = () => {
  const [lendingStore, setLendingStore] = useAtom(lendingAtom);

  const lastSelectedChain = useMemo(() => {
    return lendingStore.lastSelectedChain || CustomMarket.proto_mainnet_v3;
  }, [lendingStore.lastSelectedChain]);

  const skipHealthFactorWarning = useMemo(() => {
    return lendingStore.skipHealthFactorWarning || false;
  }, [lendingStore.skipHealthFactorWarning]);

  const setLastSelectedChain = useMemoizedFn(async (chainId: CustomMarket) => {
    try {
      await lendingService.setLastSelectedChain(chainId);
      setLendingStore(prev => ({
        ...prev,
        lastSelectedChain: chainId,
      }));
    } catch (error) {
      console.error('Failed to set last selected chain:', error);
    }
  });

  const getLastSelectedChain = useMemoizedFn(async () => {
    try {
      const chainId = await lendingService.getLastSelectedChain();
      setLendingStore(prev => ({
        ...prev,
        lastSelectedChain: chainId,
      }));
      return chainId;
    } catch (error) {
      console.error('Failed to get last selected chain:', error);
      return CHAINS_ENUM.ETH;
    }
  });

  const setSkipHealthFactorWarning = useMemoizedFn(async (skip: boolean) => {
    try {
      await lendingService.setSkipHealthFactorWarning(skip);
      setLendingStore(prev => ({
        ...prev,
        skipHealthFactorWarning: skip,
      }));
    } catch (error) {
      console.error('Failed to set skip health factor warning:', error);
    }
  });

  const getSkipHealthFactorWarning = useMemoizedFn(async () => {
    try {
      const skip = await lendingService.getSkipHealthFactorWarning();
      setLendingStore(prev => ({
        ...prev,
        skipHealthFactorWarning: skip,
      }));
      return skip;
    } catch (error) {
      console.error('Failed to get skip health factor warning:', error);
      return false;
    }
  });

  const syncState = useMemoizedFn(async () => {
    try {
      const [chainId, skipWarning] = await Promise.all([
        lendingService.getLastSelectedChain(),
        lendingService.getSkipHealthFactorWarning(),
      ]);

      setLendingStore({
        lastSelectedChain: chainId,
        skipHealthFactorWarning: skipWarning,
      });
    } catch (error) {
      console.error('Failed to sync lending service state:', error);
    }
  });

  return {
    lastSelectedChain,
    skipHealthFactorWarning,
    lendingStore,

    setLastSelectedChain,
    getLastSelectedChain,
    setSkipHealthFactorWarning,
    getSkipHealthFactorWarning,

    syncState,
  };
};
