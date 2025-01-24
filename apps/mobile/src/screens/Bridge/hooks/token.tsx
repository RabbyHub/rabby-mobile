import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { ETH_USDT_CONTRACT } from '@/constant/swap';
import { useAsyncInitializeChainList } from '@/hooks/useChain';
import { formatSpeicalAmount, formatUsdValue } from '@/utils/number';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { findChain, findChainByEnum, findChainByServerID } from '@/utils/chain';
import {
  BridgeQuote,
  GasLevel,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// import { useAsyncFn, useDebounce } from 'react-use';
import useAsync from 'react-use/lib/useAsync';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import useDebounce from 'react-use/lib/useDebounce';
import { stats } from '@/utils/stats';
import { openapi } from '@/core/request';
import {
  useQuoteVisible,
  useRefreshId,
  useSetQuoteVisible,
  useSetRefreshId,
} from './context';
import { getChainDefaultToken } from '@/constant/swap';
import { tokenAmountBn } from '@/screens/Swap/utils';
import BigNumber from 'bignumber.js';
import { useBridgeSlippage } from './slippage';
import { isNaN } from 'lodash';
import {
  useCurrentAccount,
  useLoadMatteredChainBalances,
} from '@/hooks/account';
import { useAggregatorsList, useBridgeSupportedChains } from './atom';
import { getERC20Allowance } from '@/core/apis/provider';
import { GasLevelType } from '@/components/ReserveGasPopup';
import { apiProvider } from '@/core/apis';
import { useMount } from 'ahooks';
import { useNavigationState } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';

export interface SelectedBridgeQuote extends Omit<BridgeQuote, 'tx'> {
  shouldApproveToken?: boolean;
  shouldTwoStepApprove?: boolean;
  loading?: boolean;
  tx?: BridgeQuote['tx'];
  manualClick?: boolean;
}

export const tokenPriceImpact = (
  fromToken?: TokenItem,
  toToken?: TokenItem,
  fromAmount?: string | number,
  toAmount?: string | number,
) => {
  const notReady = [fromToken, toToken, fromAmount, toAmount].some(e =>
    isNaN(e),
  );

  if (notReady) {
    return;
  }

  const fromUsdBn = new BigNumber(fromAmount || 0).times(fromToken?.price || 0);
  const toUsdBn = new BigNumber(toAmount || 0).times(toToken?.price || 0);

  const cut = toUsdBn.minus(fromUsdBn).div(fromUsdBn).times(100);

  return {
    showLoss: cut.lte(-5),
    lossUsd: formatUsdValue(toUsdBn.minus(fromUsdBn).abs().toString()),
    diff: cut.abs().toFixed(2),
    fromUsd: formatUsdValue(fromUsdBn.toString(10)),
    toUsd: formatUsdValue(toUsdBn.toString(10)),
  };
};

const useToken = (type: 'from' | 'to') => {
  const refreshId = useRefreshId();

  const { currentAccount } = useCurrentAccount();
  const userAddress = currentAccount?.address;

  const [chain, setChain] = useState<CHAINS_ENUM>();

  const [token, setToken] = useState<TokenItem & { tokenId?: string }>();

  const switchChain: (changeChain?: CHAINS_ENUM, resetToken?: boolean) => void =
    useCallback(
      (changeChain?: CHAINS_ENUM, resetToken = true) => {
        setChain(changeChain);
        if (resetToken) {
          if (type === 'from') {
            setToken(
              changeChain ? getChainDefaultToken(changeChain) : undefined,
            );
          } else {
            setToken(undefined);
          }
        }
      },
      [type],
    );

  const { value, loading, error } = useAsync(async () => {
    if (userAddress && token?.id && chain) {
      const data = await openapi.getToken(
        userAddress,
        findChainByEnum(chain)!.serverId,
        token.id,
      );
      return { ...data, tokenId: token.id };
    }
  }, [refreshId, userAddress, token?.id, token?.raw_amount_hex_str, chain]);

  useDebounce(
    () => {
      if (value && !error && !loading) {
        setToken(value);
      }
    },
    300,
    [value, error, loading],
  );

  return [chain, token, setToken, switchChain] as const;
};

export const useBridge = (isForMultipleAdderss?: boolean) => {
  const { currentAccount } = useCurrentAccount();
  const userAddress = currentAccount?.address;
  const refreshId = useRefreshId();

  const setRefreshId = useSetRefreshId();

  const [fromChain, fromToken, setFromToken, switchFromChain] =
    useToken('from');
  const [toChain, toToken, setToToken, switchToChain] = useToken('to');

  const [amount, setAmount] = useState('');

  const slippageObj = useBridgeSlippage();

  const [recommendFromToken, setRecommendFromToken] = useState<TokenItem>();

  const fillRecommendFromToken = useCallback(() => {
    if (recommendFromToken) {
      const targetChain = findChainByServerID(recommendFromToken?.chain);
      if (targetChain) {
        switchFromChain(targetChain.enum, false);
        setFromToken(recommendFromToken);
        setAmount('');
      }
    }
  }, [recommendFromToken, switchFromChain, setFromToken]);

  const [selectedBridgeQuote, setOriSelectedBridgeQuote] = useState<
    SelectedBridgeQuote | undefined
  >();

  const expiredTimer = useRef<NodeJS.Timeout>();

  const inSufficient = useMemo(
    () =>
      fromToken
        ? tokenAmountBn(fromToken).lt(amount)
        : new BigNumber(0).lt(amount),
    [fromToken, amount],
  );

  const getRecommendToChain = async (chain: CHAINS_ENUM) => {
    if (userAddress) {
      // const getRemoteRecommendChain = async () => {
      //   const data = await openapi.getRecommendBridgeToChain({
      //     from_chain_id: findChainByEnum(chain)!.serverId,
      //   });
      //   switchToChain(findChainByServerID(data.to_chain_id)?.enum);
      // };
      const getRemoteRecommendChain = async () => {
        const data = await openapi.getRecommendBridgeToChain({
          from_chain_id: findChainByEnum(chain)!.serverId,
        });
        return findChainByServerID(data.to_chain_id)?.enum;
      };

      const getBridgeHistory = async () => {
        const latestTx = await openapi.getBridgeHistoryList({
          user_addr: userAddress,
          start: 0,
          limit: 1,
        });
        return latestTx?.history_list?.[0]?.to_token;
      };

      const [remoteChain, latestToToken] = await Promise.all([
        getRemoteRecommendChain(),
        getBridgeHistory(),
      ]);

      if (latestToToken) {
        const lastBridgeChain = findChainByServerID(latestToToken.chain);
        if (lastBridgeChain && lastBridgeChain.enum !== chain) {
          switchToChain(lastBridgeChain.enum);
          setToToken(latestToToken);
        } else {
          switchToChain(remoteChain);
        }
      } else {
        switchToChain(remoteChain);
      }
    }
  };

  const { value: isSameToken, loading: isSameTokenLoading } =
    useAsync(async () => {
      if (fromChain && fromToken?.id && toChain && toToken?.id) {
        try {
          const data = await openapi.isSameBridgeToken({
            from_chain_id: findChainByEnum(fromChain)!.serverId,
            from_token_id: fromToken?.id,
            to_chain_id: findChainByEnum(toChain)!.serverId,
            to_token_id: toToken?.id,
          });
          return data?.every(e => e.is_same);
        } catch (error) {
          return false;
        }
      }
      return false;
    }, [fromChain, fromToken?.id, toChain, toToken?.id]);

  useEffect(() => {
    if (!isSameTokenLoading && slippageObj.autoSlippage) {
      slippageObj.setSlippage(isSameToken ? '0.5' : '1');
    }
  }, [slippageObj, isSameToken, isSameTokenLoading]);

  const { fetchOrderedChainList } = useLoadMatteredChainBalances();
  const supportedChains = useBridgeSupportedChains();
  // the most worth chain is the first
  // useAsyncInitializeChainList({
  //   supportChains: supportedChains,
  //   onChainInitializedAsync: firstEnum => {
  //     switchFromChain(firstEnum);
  //     getRecommendToChain(firstEnum);
  //   },
  // });

  const navState = useNavigationState(
    s =>
      s.routes.find(
        r =>
          r.name ===
          (isForMultipleAdderss ? RootNames.MultiBridge : RootNames.Bridge),
      )?.params,
  ) as
    | {
        chainEnum?: CHAINS_ENUM | undefined;
        tokenId?: TokenItem['id'];
      }
    | undefined;

  useMount(() => {
    if (!navState?.chainEnum || !navState?.tokenId) {
      return;
    }

    const chainItem = findChainByEnum(navState?.chainEnum, { fallback: true });
    switchFromChain(chainItem?.enum || CHAINS_ENUM.ETH, false);
    setFromToken({
      ...getChainDefaultToken(chainItem?.enum || CHAINS_ENUM.ETH),
      id: navState?.tokenId,
    });
  });

  const initIdRef = useRef(0); // just work on lastest fetch and clear old fetch
  const initChainByCache = useCallback(async () => {
    initIdRef.current += 1;
    const currentFetchId = initIdRef.current;
    const { firstChain } = await fetchOrderedChainList({
      supportChains: supportedChains,
    });
    if (initIdRef.current !== currentFetchId) {
      return;
    }
    const firstChainEnum = firstChain?.enum || CHAINS_ENUM.ETH;
    setAmount('');
    switchFromChain(navState?.chainEnum ?? firstChainEnum);
    const getRemoteRecommendChain = async () => {
      if (initIdRef.current === currentFetchId) {
        const data = await openapi.getRecommendBridgeToChain({
          from_chain_id: findChainByEnum(firstChainEnum)!.serverId,
        });
        initIdRef.current === currentFetchId &&
          switchToChain(findChainByServerID(data.to_chain_id)?.enum);
      }
    };
    if (userAddress) {
      const latestTx = await openapi.getBridgeHistoryList({
        user_addr: userAddress,
        start: 0,
        limit: 1,
      });
      if (initIdRef.current !== currentFetchId) {
        return;
      }
      const latestToToken = latestTx?.history_list?.[0]?.to_token;
      if (latestToToken) {
        const lastBridgeChain = findChainByServerID(latestToToken.chain);
        if (lastBridgeChain && lastBridgeChain.enum !== firstChainEnum) {
          switchToChain(lastBridgeChain.enum);
          setToToken(latestToToken);
        } else {
          await getRemoteRecommendChain();
        }
      } else {
        await getRemoteRecommendChain();
      }
    }
  }, [
    navState,
    fetchOrderedChainList,
    userAddress,
    setAmount,
    supportedChains,
    setToToken,
    switchFromChain,
    switchToChain,
  ]);

  useEffect(() => {
    initChainByCache();
  }, [initChainByCache]);

  const handleAmountChange = useCallback((e: string) => {
    const v = formatSpeicalAmount(e);
    if (!/^\d*(\.\d*)?$/.test(v)) {
      return;
    }
    setAmount(v);
  }, []);

  const switchToken = useCallback(() => {
    switchFromChain(toChain, false);
    switchToChain(fromChain, false);
    setFromToken(toToken);
    setToToken(fromToken);
  }, [
    setFromToken,
    toToken,
    setToToken,
    fromToken,
    switchFromChain,
    toChain,
    switchToChain,
    fromChain,
  ]);

  const [quoteList, setQuotesList] = useState<SelectedBridgeQuote[]>([]);

  const setSelectedBridgeQuote = useCallback(
    (quote?: SelectedBridgeQuote) => {
      if (!quote?.manualClick && expiredTimer.current) {
        clearTimeout(expiredTimer.current);
      }
      if (!quote?.manualClick) {
        expiredTimer.current = setTimeout(() => {
          setRefreshId(e => e + 1);
        }, 1000 * 30);
      }
      setOriSelectedBridgeQuote(quote);
    },
    [setRefreshId],
  );

  useEffect(() => {
    setQuotesList([]);
    setRecommendFromToken(undefined);
  }, [fromToken?.id, toToken?.id, fromChain, toChain, amount, inSufficient]);

  // const aggregatorsList = useBridgeSupportedChains(s => s.bridge.aggregatorsList || []);
  const aggregatorsList = useAggregatorsList();

  const fetchIdRef = useRef(0);
  const [{ loading: quoteLoading, error: quotesError }, getQuoteList] =
    useAsyncFn(async () => {
      fetchIdRef.current += 1;
      const currentFetchId = fetchIdRef.current;

      if (
        !inSufficient &&
        userAddress &&
        fromToken?.id &&
        toToken?.id &&
        toToken &&
        fromChain &&
        toChain &&
        Number(amount) > 0 &&
        aggregatorsList.length > 0
      ) {
        let isEmpty = false;
        const result: SelectedBridgeQuote[] = [];

        setQuotesList(e => {
          if (!e.length) {
            isEmpty = true;
          }
          return e?.map(e => ({ ...e, loading: true }));
        });

        const originData: Omit<BridgeQuote, 'tx'>[] = [];

        const getQUoteV2 = async (alternativeToken?: TokenItem) =>
          await Promise.allSettled(
            aggregatorsList.map(async bridgeAggregator => {
              const data = await openapi
                .getBridgeQuoteV2({
                  aggregator_id: bridgeAggregator.id,
                  user_addr: userAddress,
                  from_chain_id: alternativeToken?.chain || fromToken.chain,
                  from_token_id: alternativeToken?.id || fromToken.id,
                  from_token_raw_amount: alternativeToken
                    ? new BigNumber(amount)
                        .times(fromToken.price)
                        .div(alternativeToken.price)
                        .times(10 ** alternativeToken.decimals)
                        .toFixed(0, 1)
                        .toString()
                    : new BigNumber(amount)
                        .times(10 ** fromToken.decimals)
                        .toFixed(0, 1)
                        .toString(),
                  to_chain_id: toToken.chain,
                  to_token_id: toToken.id,
                  slippage: new BigNumber(slippageObj.slippageState)
                    .div(100)
                    .toString(10),
                })
                .catch(e => {
                  if (
                    currentFetchId === fetchIdRef.current &&
                    !alternativeToken
                  ) {
                    stats.report('bridgeQuoteResult', {
                      aggregatorIds: bridgeAggregator.id,
                      fromChainId: fromToken.chain,
                      fromTokenId: fromToken.id,
                      toTokenId: toToken.id,
                      toChainId: toToken.chain,
                      status: 'fail',
                    });
                  }
                });

              if (alternativeToken) {
                if (
                  data &&
                  data?.length &&
                  currentFetchId === fetchIdRef.current
                ) {
                  setRecommendFromToken(alternativeToken);
                  return;
                }
              }
              if (data && currentFetchId === fetchIdRef.current) {
                originData.push(...data);
              }
              if (currentFetchId === fetchIdRef.current) {
                stats.report('bridgeQuoteResult', {
                  aggregatorIds: bridgeAggregator.id,
                  fromChainId: fromToken.chain,
                  fromTokenId: fromToken.id,
                  toTokenId: toToken.id,
                  toChainId: toToken.chain,
                  status: data?.length ? 'success' : 'none',
                });
              }
              return data;
            }),
          );

        await getQUoteV2();

        const data = originData?.filter(
          quote =>
            !!quote?.bridge &&
            !!quote?.bridge?.id &&
            !!quote?.bridge?.logo_url &&
            !!quote.bridge.name,
        );

        if (currentFetchId === fetchIdRef.current) {
          setPending(false);

          if (data.length < 1) {
            try {
              const res = await openapi.getRecommendFromToken({
                user_addr: userAddress,
                from_chain_id: fromToken.chain,
                from_token_id: fromToken.id,
                from_token_amount: new BigNumber(amount)
                  .times(10 ** fromToken.decimals)
                  .toFixed(0, 1)
                  .toString(),
                to_chain_id: toToken.chain,
                to_token_id: toToken.id,
              });
              if (res?.token_list?.[0]) {
                await getQUoteV2(res?.token_list?.[0]);
              } else {
                setRecommendFromToken(undefined);
              }
            } catch (error) {
              setRecommendFromToken(undefined);
            }

            setSelectedBridgeQuote(undefined);
          }

          stats.report('bridgeQuoteResult', {
            aggregatorIds: aggregatorsList.map(e => e.id).join(','),
            fromChainId: fromToken.chain,
            fromTokenId: fromToken.id,
            toTokenId: toToken.id,
            toChainId: toToken.chain,
            status: data ? (data?.length === 0 ? 'none' : 'success') : 'fail',
          });
        }

        if (data && currentFetchId === fetchIdRef.current) {
          if (!isEmpty) {
            setQuotesList(data.map(e => ({ ...e, loading: true })));
          }

          await Promise.allSettled(
            data.map(async quote => {
              if (currentFetchId !== fetchIdRef.current) {
                return;
              }
              let tokenApproved = false;
              let allowance = '0';
              const fromFindChain = findChain({ serverId: fromToken?.chain });
              if (fromToken?.id === fromFindChain?.nativeTokenAddress) {
                tokenApproved = true;
              } else {
                allowance = await getERC20Allowance(
                  fromToken.chain,
                  fromToken.id,
                  quote.approve_contract_id,
                );
                tokenApproved = new BigNumber(allowance).gte(
                  new BigNumber(amount).times(10 ** fromToken.decimals),
                );
              }
              let shouldTwoStepApprove = false;
              if (
                fromFindChain?.enum === CHAINS_ENUM.ETH &&
                isSameAddress(fromToken.id, ETH_USDT_CONTRACT) &&
                Number(allowance) !== 0 &&
                !tokenApproved
              ) {
                shouldTwoStepApprove = true;
              }

              if (isEmpty) {
                result.push({
                  ...quote,
                  shouldTwoStepApprove,
                  shouldApproveToken: !tokenApproved,
                });
              } else {
                if (
                  currentFetchId === fetchIdRef.current &&
                  Number(amount) > 0
                ) {
                  setQuotesList(e => {
                    const filteredArr = e.filter(
                      item =>
                        item.aggregator.id !== quote.aggregator.id ||
                        item.bridge.id !== quote.bridge.id,
                    );
                    return [
                      ...filteredArr,
                      {
                        ...quote,
                        loading: false,
                        shouldTwoStepApprove,
                        shouldApproveToken: !tokenApproved,
                      },
                    ];
                  });
                }
              }
            }),
          );

          if (
            isEmpty &&
            currentFetchId === fetchIdRef.current &&
            Number(amount) > 0
          ) {
            setQuotesList(result);
          }
        }
      }
      setSelectedBridgeQuote(undefined);
    }, [
      inSufficient,
      aggregatorsList,
      refreshId,
      userAddress,
      fromToken?.id,
      toToken?.id,
      fromChain,
      toChain,
      amount,
      slippageObj.slippage,
    ]);

  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (
      !inSufficient &&
      userAddress &&
      fromToken?.id &&
      toToken?.id &&
      toToken &&
      fromChain &&
      toChain &&
      Number(amount) > 0 &&
      aggregatorsList.length > 0
    ) {
      setPending(true);
    } else {
      setPending(false);
    }
  }, [
    inSufficient,
    userAddress,
    fromToken?.id,
    toToken?.id,
    toToken,
    fromChain,
    toChain,
    amount,
    aggregatorsList.length,
    refreshId,
  ]);

  const [, cancelDebounce] = useDebounce(
    () => {
      getQuoteList();
    },
    300,
    [getQuoteList],
  );

  const [bestQuoteId, setBestQuoteId] = useState<
    | {
        bridgeId: string;
        aggregatorId: string;
      }
    | undefined
  >(undefined);

  const openQuote = useSetQuoteVisible();

  const openQuotesList = useCallback(() => {
    openQuote(true);
  }, [openQuote]);

  useEffect(() => {
    if (!quoteLoading && toToken && quoteList.every(e => !e.loading)) {
      const sortedList = quoteList?.sort((b, a) => {
        return new BigNumber(a.to_token_amount)
          .times(toToken.price || 1)
          .minus(a.gas_fee.usd_value)
          .minus(
            new BigNumber(b.to_token_amount)
              .times(toToken.price || 1)
              .minus(b.gas_fee.usd_value),
          )
          .toNumber();
      });
      if (
        sortedList[0] &&
        sortedList[0]?.bridge_id &&
        sortedList[0]?.aggregator?.id
      ) {
        setBestQuoteId({
          bridgeId: sortedList[0]?.bridge_id,
          aggregatorId: sortedList[0]?.aggregator?.id,
        });

        let useQuote = sortedList[0];

        setOriSelectedBridgeQuote(preItem => {
          useQuote = preItem?.manualClick ? preItem : sortedList[0];
          return preItem;
        });

        setSelectedBridgeQuote(useQuote);
      }
    }
  }, [quoteList, quoteLoading, toToken, setSelectedBridgeQuote]);

  if (quotesError) {
    console.error('quotesError', quotesError);
  }

  const showLoss = useMemo(() => {
    if (selectedBridgeQuote) {
      return !!tokenPriceImpact(
        fromToken,
        toToken,
        amount,
        selectedBridgeQuote?.to_token_amount,
      )?.showLoss;
    }
    return false;
  }, [fromToken, toToken, amount, selectedBridgeQuote]);

  const clearExpiredTimer = useCallback(() => {
    if (expiredTimer.current) {
      clearTimeout(expiredTimer.current);
    }
  }, []);

  const chainInfo = useMemo(
    () => findChainByEnum(fromChain) || CHAINS[fromChain || 'ETH'],
    [fromChain],
  );

  const [gasLevel, setGasLevel] = useState<GasLevelType>('normal');
  const gasPriceRef = useRef<number>();

  const { value: gasList } = useAsync(() => {
    gasPriceRef.current = undefined;
    setGasLevel('normal');
    return apiProvider.gasMarketV2({
      chainId: chainInfo.serverId,
    });
  }, [chainInfo?.serverId]);

  const [passGasPrice, setUseGasPrice] = useState(false);
  const [reserveGasOpen, setReserveGasOpen] = useState(false);
  const isMaxRef = useRef(false);
  const [clickMaxBtnCount, setClickMaxBtnCount] = useState(0);

  const normalGasPrice = useMemo(
    () => gasList?.find(e => e.level === 'normal')?.price,
    [gasList],
  );

  const nativeTokenDecimals = useMemo(
    () => findChain({ enum: fromChain })?.nativeTokenDecimals || 1e18,
    [fromChain],
  );

  const gasLimit = useMemo(
    () => (fromChain === CHAINS_ENUM.ETH ? 1000000 : 2000000),
    [fromChain],
  );

  const payTokenIsNativeToken = useMemo(() => {
    if (fromToken) {
      return isSameAddress(fromToken.id, chainInfo.nativeTokenAddress);
    }
    return false;
  }, [chainInfo?.nativeTokenAddress, fromToken]);

  useEffect(() => {
    if (payTokenIsNativeToken && gasList) {
      const checkGasIsEnough = (price: number) => {
        return new BigNumber(fromToken?.raw_amount_hex_str || 0, 16).gte(
          new BigNumber(gasLimit).times(price),
        );
      };
      const normalPrice = gasList?.find(e => e.level === 'normal')?.price || 0;
      const slowPrice = gasList?.find(e => e.level === 'slow')?.price || 0;
      const isNormalEnough = checkGasIsEnough(normalPrice);
      const isSlowEnough = checkGasIsEnough(slowPrice);
      if (isNormalEnough) {
        setGasLevel('normal');
        gasPriceRef.current = normalGasPrice;
      } else if (isSlowEnough) {
        setGasLevel('slow');
        gasPriceRef.current = slowPrice;
      } else {
        setGasLevel('custom');
        gasPriceRef.current = 0;
      }
    }
  }, [
    payTokenIsNativeToken,
    gasList,
    gasLimit,
    fromToken?.raw_amount_hex_str,
    normalGasPrice,
  ]);

  const closeReserveGasOpen = useCallback(() => {
    setReserveGasOpen(false);
  }, []);

  const closeReserveGasOpenAndUpdatePayAmount = useCallback(() => {
    setReserveGasOpen(false);

    if (fromToken && gasPriceRef.current !== undefined) {
      const val = tokenAmountBn(fromToken).minus(
        new BigNumber(gasLimit)
          .times(gasPriceRef.current)
          .div(10 ** nativeTokenDecimals),
      );
      setAmount(val.lt(0) ? '0' : val.toString(10));
      setClickMaxBtnCount(e => e + 1);
    }
  }, [fromToken, nativeTokenDecimals, gasLimit]);

  const changeGasPrice = useCallback(
    (gasLevel: GasLevel) => {
      gasPriceRef.current = gasLevel.level === 'custom' ? 0 : gasLevel.price;
      setGasLevel(gasLevel.level as GasLevelType);
      closeReserveGasOpenAndUpdatePayAmount();
      setUseGasPrice(true);
    },
    [closeReserveGasOpenAndUpdatePayAmount],
  );

  const handleMax = useCallback(() => {
    if (payTokenIsNativeToken) {
      setReserveGasOpen(true);
      return;
    }

    if (!payTokenIsNativeToken && fromToken) {
      isMaxRef.current = true;
      handleAmountChange?.(tokenAmountBn(fromToken)?.toString(10));
      setClickMaxBtnCount(e => e + 1);
    }
  }, [fromToken, handleAmountChange, setReserveGasOpen, payTokenIsNativeToken]);

  return {
    clearExpiredTimer,

    fromChain,
    fromToken,
    setFromToken,
    switchFromChain,
    toChain,
    toToken,
    setToToken,
    switchToChain,
    switchToken,

    recommendFromToken,
    fillRecommendFromToken,

    inSufficient,
    amount,
    handleAmountChange,
    showLoss,

    openQuotesList,
    quoteLoading: pending || quoteLoading,
    quoteList,

    bestQuoteId,
    selectedBridgeQuote,

    gasLevel,
    gasLimit,
    changeGasPrice,
    gasList,
    reserveGasOpen,
    closeReserveGasOpen,
    passGasPrice,
    handleMax,
    clickMaxBtnCount,
    isMaxRef,
    payTokenIsNativeToken,

    setSelectedBridgeQuote,
    ...slippageObj,
  };
};
