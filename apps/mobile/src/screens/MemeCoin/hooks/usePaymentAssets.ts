import { useEffect, useMemo, useRef, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import type { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { gasMarketV2 } from '@/core/apis/provider';
import { openapi } from '@/core/request';
import type { Account } from '@/core/startupServices/preference';
import { useBridgeSupportedChains } from '@/screens/Bridge/hooks/atom';
import { useGasAccountInfo } from '@/screens/GasAccount/hooks';
import { getSwapGasReserveGasLimit } from '@/screens/Swap/utils';
import useTokenList from '@/store/tokens';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import { pickDefaultPaymentAsset } from '../engine/defaultSelection';
import { toChainGasInfo } from '../engine/gas';
import { tokenKey } from '../engine/keys';
import {
  buildPaymentAssetList,
  type WalletToken,
} from '../engine/paymentAssets';
import { planBuy } from '../engine/planner';
import type { ChainGasInfo, MemeTarget } from '../engine/types';

const toServerIds = (enums: string[]) =>
  new Set(
    enums
      .map(e => findChainByEnum(e)?.serverId)
      .filter((id): id is string => !!id),
  );

export const usePaymentAssets = ({
  account,
  memes,
  memeTokenKeys,
  amountUsd,
}: {
  account: Account;
  memes: MemeTarget[];
  /** Keys must be built with `tokenKey()` (chain + lowercase id); the payment list matches these exact strings. */
  memeTokenKeys: ReadonlySet<string>;
  amountUsd: number;
}) => {
  useEffect(() => {
    useTokenList.getState().getTokenList(account.address, true);
  }, [account.address]);

  const tokens = useTokenList(
    s => s.tokenListMap[account.address.toLowerCase()],
  );
  const bridgeChainEnums = useBridgeSupportedChains();
  const { value: gasAccountInfo } = useGasAccountInfo();
  const gasAccountBalanceUsd = gasAccountInfo?.account.balance ?? 0;

  const memeChains = useMemo(() => new Set(memes.map(m => m.chain)), [memes]);
  const swapChains = useMemo(() => toServerIds(SWAP_SUPPORT_CHAINS), []);
  const bridgeChains = useMemo(
    () => toServerIds(bridgeChainEnums),
    [bridgeChainEnums],
  );

  const walletTokens = useMemo<WalletToken[]>(
    () =>
      (tokens || []).map(t => ({
        id: t.id,
        chain: t.chain,
        symbol: t.symbol,
        price: t.price || 0,
        usdValue: t.usd_value ?? (t.amount || 0) * (t.price || 0),
        isNative: isSameAddress(
          t.id,
          findChainByServerID(t.chain)?.nativeTokenAddress || '',
        ),
      })),
    [tokens],
  );

  const assets = useMemo(
    () =>
      buildPaymentAssetList({
        tokens: walletTokens,
        memeTokenKeys,
        memeChains,
        swapSupportedChains: swapChains,
        bridgeSupportedChains: bridgeChains,
      }),
    [walletTokens, memeTokenKeys, memeChains, swapChains, bridgeChains],
  );

  const chainsKey = useMemo(
    () =>
      Array.from(new Set(assets.map(a => a.chain)))
        .sort()
        .join(','),
    [assets],
  );
  const [chainGas, setChainGas] = useState<Record<string, ChainGasInfo>>({});
  const [chainGasReady, setChainGasReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const chains = chainsKey ? chainsKey.split(',') : [];
    Promise.all(
      chains.map(async chainServerId => {
        const chain = findChainByServerID(chainServerId);
        const native = walletTokens.find(
          t => t.chain === chainServerId && t.isNative,
        );
        const [levels, nativePrice] = await Promise.all([
          gasMarketV2({ chainId: chainServerId }, account).catch(
            (): GasLevel[] => [],
          ),
          native?.price ??
            openapi
              .getToken(
                account.address,
                chainServerId,
                chain?.nativeTokenAddress || '',
              )
              .then(t => t.price || 0)
              .catch(() => 0),
        ]);
        return [
          chainServerId,
          toChainGasInfo({
            gasLimit: getSwapGasReserveGasLimit(chain?.enum || ''),
            gasPriceWei: levels.find(l => l.level === 'normal')?.price || 0,
            nativeDecimals: chain?.nativeTokenDecimals || 18,
            nativePrice,
            nativeBalanceUsd: native?.usdValue ?? 0,
            bridgeSupported: bridgeChains.has(chainServerId),
          }),
        ] as const;
      }),
    ).then(entries => {
      if (!cancelled) {
        setChainGas(Object.fromEntries(entries));
        setChainGasReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
    // walletTokens / bridgeChains changes are reflected through chainsKey refetch on the next list update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainsKey, account]);

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const touchedRef = useRef(false);

  useEffect(() => {
    if (touchedRef.current || !chainGasReady) {
      return;
    }
    const picked = pickDefaultPaymentAsset({
      assets,
      memes,
      amountUsd,
      chainGas,
      gasAccountBalanceUsd,
    });
    setSelectedKeys(picked ? [tokenKey(picked)] : []);
  }, [assets, memes, amountUsd, chainGas, gasAccountBalanceUsd, chainGasReady]);

  const toggle = useMemoizedFn((key: string) => {
    touchedRef.current = true;
    setSelectedKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );
  });

  const plan = useMemo(
    () =>
      planBuy({
        amountUsd,
        memes,
        sources: assets.filter(a => selectedKeys.includes(tokenKey(a))),
        chainGas,
        gasAccountBalanceUsd,
      }),
    [amountUsd, memes, assets, selectedKeys, chainGas, gasAccountBalanceUsd],
  );

  return {
    assets,
    selectedKeys,
    toggle,
    plan,
    ready: tokens !== undefined && chainGasReady,
  };
};
