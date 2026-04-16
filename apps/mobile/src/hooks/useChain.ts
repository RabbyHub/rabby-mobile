import { useState, useRef, useMemo, useCallback, useEffect } from 'react';

import { findChainByEnum, varyAndSortChainItems } from '@/utils/chain';
import { CHAINS_ENUM, Chain } from '@debank/common';
import {
  useChainBalances,
  useLoadMatteredChainBalances,
} from './accountChainBalance';
import { preferenceService } from '@/core/services';
import { Account } from '@/core/services/preference';

export type ChainSelectorPurpose =
  | 'dashboard'
  | 'sendToken'
  | 'connect'
  | 'swap'
  | 'customRPC'
  | 'addAsset';

type FetchDataStage = false | 'fetching' | 'fetched' | 'inited';
/**
 * @description support mainnet ONLY now
 */
export function useAsyncInitializeChainList({
  supportChains,
  onChainInitializedAsync,
  account,
}: {
  supportChains?: Chain['enum'][];
  onChainInitializedAsync?: (firstEnum: CHAINS_ENUM) => void;
  account: Account;
}) {
  const { matteredChainBalances } = useChainBalances();

  const pinned = useMemo(() => {
    return ((
      preferenceService.getPreference('pinnedChain') as CHAINS_ENUM[]
    )?.filter(item => findChainByEnum(item)) || []) as CHAINS_ENUM[];
  }, []);

  const { matteredList, unmatteredList } = useMemo(() => {
    return varyAndSortChainItems({
      supportChains,
      pinned,
      matteredChainBalances,
    });
  }, [pinned, supportChains, matteredChainBalances]);

  const fetchChainDataStageRef = useRef<FetchDataStage>(false);
  const chainRef = useRef<CHAINS_ENUM>(CHAINS_ENUM.ETH);
  const [, setSpinner] = useState(0);
  const updateInitStage = useCallback(
    async (nextStage: Exclude<FetchDataStage, false>) => {
      if (!nextStage) return;
      fetchChainDataStageRef.current = nextStage;
      setSpinner(prev => prev + 1);
    },
    [],
  );

  const { getMatteredChainBalance } = useLoadMatteredChainBalances({
    account: account,
  });

  const fetchDataOnce = useCallback(async () => {
    if (fetchChainDataStageRef.current) return;
    updateInitStage('fetching');

    preferenceService.getPreference('pinnedChain');
    await getMatteredChainBalance({ address: account.address });
    updateInitStage('fetched');
  }, [updateInitStage, getMatteredChainBalance, account.address]);

  useEffect(() => {
    fetchDataOnce();
  }, [fetchDataOnce]);

  const firstEnum = matteredList[0]?.enum;

  const markFinishInitializeChainExternally = useCallback(
    (chain: CHAINS_ENUM) => {
      if (fetchChainDataStageRef.current === 'fetched') {
        chainRef.current = chain;
        updateInitStage('inited');
      }
    },
    [updateInitStage],
  );

  useEffect(() => {
    if (firstEnum && fetchChainDataStageRef.current === 'fetched') {
      updateInitStage('inited');
      chainRef.current = firstEnum;
      onChainInitializedAsync?.(firstEnum);
    }
  }, [firstEnum, updateInitStage, onChainInitializedAsync]);

  return {
    matteredList,
    unmatteredList: unmatteredList,
    pinned,
    fetchDataOnce,
    markFinishInitializeChainExternally,
  };
}
