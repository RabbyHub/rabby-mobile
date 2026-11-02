import { useEffect, useMemo, useRef, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import type { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { isStableTokenPair } from '@rabby-wallet/rabby-swap';
import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { gasMarketV2 } from '@/core/apis/provider';
import { openapi } from '@/core/request';
import type { Account } from '@/core/startupServices/preference';
import { useBridgeSupportedChains } from '@/screens/Bridge/hooks/atom';
import { useGasAccountInfo } from '@/screens/GasAccount/hooks';
import { getSwapGasReserveGasLimit } from '@/screens/Swap/utils';
import useTokenList from '@/store/tokens';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import { defaultTokenFilter } from '@/utils/lpToken';
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

type ChainNetInfo = { gasPriceWei: number; nativePrice: number };

/**
 * `memes`, `memeTokenKeys` and `account` must be referentially stable
 * (memoized) across renders, otherwise the plan is recomputed on every render.
 */
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
  const [refreshSettled, setRefreshSettled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setRefreshSettled(false);
    useTokenList
      .getState()
      .getTokenList(account.address, true)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setRefreshSettled(true);
        }
      });
    return () => {
      cancelled = true;
    };
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
      (tokens || []).filter(defaultTokenFilter).map(t => ({
        id: t.id,
        chain: t.chain,
        symbol: t.symbol,
        price: t.price || 0,
        usdValue: t.usd_value ?? (t.amount || 0) * (t.price || 0),
        isNative: isSameAddress(
          t.id,
          findChainByServerID(t.chain)?.nativeTokenAddress || '',
        ),
        // the same list Swap uses for its stablecoin fee tier
        isStable: isStableTokenPair(t, t),
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
  const walletTokensRef = useRef(walletTokens);
  walletTokensRef.current = walletTokens;
  const accountRef = useRef(account);
  accountRef.current = account;

  const accountAddress = account.address;
  const [gasByChain, setGasByChain] = useState<Record<string, ChainNetInfo>>(
    {},
  );
  const requestedGasChainsRef = useRef(new Set<string>());

  // Per chain, so a slow chain holds back only the assets on it.
  useEffect(() => {
    const chains = chainsKey ? chainsKey.split(',') : [];
    chains
      .filter(
        chainServerId => !requestedGasChainsRef.current.has(chainServerId),
      )
      .forEach(async chainServerId => {
        requestedGasChainsRef.current.add(chainServerId);
        const chain = findChainByServerID(chainServerId);
        const native = walletTokensRef.current.find(
          t => t.chain === chainServerId && t.isNative,
        );
        const [levels, nativePrice] = await Promise.all([
          gasMarketV2({ chainId: chainServerId }, accountRef.current).catch(
            (): GasLevel[] => [],
          ),
          native?.price ??
            openapi
              .getToken(
                accountAddress,
                chainServerId,
                chain?.nativeTokenAddress || '',
              )
              .then(t => t.price || 0)
              .catch(() => 0),
        ]);
        setGasByChain(prev => ({
          ...prev,
          [chainServerId]: {
            gasPriceWei: levels.find(l => l.level === 'normal')?.price || 0,
            nativePrice,
          },
        }));
      });
  }, [chainsKey, accountAddress]);

  const chainGas = useMemo(() => {
    const result: Record<string, ChainGasInfo> = {};
    for (const [chainServerId, net] of Object.entries(gasByChain)) {
      const chain = findChainByServerID(chainServerId);
      const native = walletTokens.find(
        t => t.chain === chainServerId && t.isNative,
      );
      result[chainServerId] = toChainGasInfo({
        gasLimit: getSwapGasReserveGasLimit(chain?.enum || ''),
        gasPriceWei: net.gasPriceWei,
        nativeDecimals: chain?.nativeTokenDecimals || 18,
        nativePrice: net.nativePrice,
        nativeBalanceUsd: native?.usdValue ?? 0,
        bridgeSupported: bridgeChains.has(chainServerId),
      });
    }
    return result;
  }, [gasByChain, walletTokens, bridgeChains]);

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const toggle = useMemoizedFn((key: string) => {
    setSelectedKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );
  });

  const selectedAssets = useMemo(
    () => assets.filter(a => selectedKeys.includes(tokenKey(a))),
    [assets, selectedKeys],
  );

  const plan = useMemo(
    () =>
      planBuy({
        amountUsd,
        memes,
        sources: selectedAssets,
        chainGas,
        gasAccountBalanceUsd,
      }),
    [amountUsd, memes, selectedAssets, chainGas, gasAccountBalanceUsd],
  );

  return {
    assets,
    selectedKeys,
    toggle,
    plan,
    /** same as the Swap token selector: show what there is, the list grows as the refresh completes */
    listReady: assets.length > 0 || refreshSettled,
    /** the plan needs gas only for the chains of the selected assets */
    gasReady: selectedAssets.every(a => !!gasByChain[a.chain]),
  };
};
