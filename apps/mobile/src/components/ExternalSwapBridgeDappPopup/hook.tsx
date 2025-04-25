import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useBridgeSupportedChains } from '@/screens/Bridge/hooks/atom';
import { findChainByEnum } from '@/utils/chain';
import { CHAINS_ENUM } from '@debank/common';
import { atom, useAtom } from 'jotai';
import { loadable } from 'jotai/utils';
import { useMemo } from 'react';
import useAsync from 'react-use/lib/useAsync';

type SwapBridgeDapps = {
  chain_ids: string[];
  dapp: {
    id: string;
    logo_url: string;
    name: string;
  };
};

const fetchBridgeDapps = async () => {
  const res = await fetch('https://static.debank.com/bridge_dapp_chains.json');
  const data: SwapBridgeDapps[] = await res.json();
  return data;
};

const fetchSwapDapps = async () => {
  const res = await fetch('https://static.debank.com/swap_dapp_chains.json');
  const data: SwapBridgeDapps[] = await res.json();
  return data;
};

const swapDappsAtom = loadable(atom(async () => fetchSwapDapps()));

const bridgeDappsAtom = loadable(atom(async () => fetchBridgeDapps()));

export const useExternalSwapBridgeDapps = (
  chain: CHAINS_ENUM | CHAINS_ENUM[],
  type: 'swap' | 'bridge',
) => {
  const bridgeSupportedChains = useBridgeSupportedChains();

  const [swapValue] = useAtom(swapDappsAtom);

  const [bridgeValue] = useAtom(bridgeDappsAtom);

  const { value, loading } = useAsync(async () => {
    if (swapValue.state === 'hasData' && bridgeValue.state === 'hasData') {
      return type === 'swap' ? swapValue.data : bridgeValue.data;
    }
    return [] as SwapBridgeDapps[];
  }, [type, swapValue, bridgeValue]);

  const isSupportedChain = useMemo(() => {
    const supportedChains =
      type === 'swap' ? SWAP_SUPPORT_CHAINS : bridgeSupportedChains;
    return Array.isArray(chain)
      ? chain.every(e => supportedChains.includes(e))
      : supportedChains.includes(chain);
  }, [chain, type, bridgeSupportedChains]);

  const data = useMemo(() => {
    if (!isSupportedChain && value) {
      let filterData: SwapBridgeDapps[] = [];
      if (type === 'swap') {
        const targetChain = findChainByEnum(chain as CHAINS_ENUM);
        if (!targetChain) {
          return [];
        }
        filterData = value?.filter(item =>
          item.chain_ids.some(e => e === targetChain.serverId),
        );
      } else {
        const targetFromChain = findChainByEnum(chain[0]);
        const targetToChain = findChainByEnum(chain[1]);

        if (!targetFromChain || !targetToChain) {
          return [];
        }

        filterData = value?.filter(
          item =>
            item.chain_ids.some(e => e === targetFromChain?.serverId) &&
            item.chain_ids.some(e => e === targetToChain?.serverId),
        );
      }

      return filterData?.map(({ dapp }) => ({
        name: dapp.name,
        logo: dapp.logo_url,
        url: dapp?.id,
      }));
    }
    return [];
  }, [isSupportedChain, value, type, chain]);

  const { openTab } = useBrowser();

  return {
    data,
    isSupportedChain,
    loading:
      loading ||
      swapValue.state === 'loading' ||
      bridgeValue.state === 'loading',
    openTab,
  };
};
