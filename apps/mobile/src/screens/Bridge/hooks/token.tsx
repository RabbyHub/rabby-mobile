import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { ETH_USDT_CONTRACT } from '@/constant/swap';
import { formatSpeicalAmount, formatUsdValue } from '@/utils/number';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { findChain, findChainByEnum, findChainByServerID } from '@/utils/chain';
import { BridgeQuote, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// import { useAsyncFn, useDebounce } from 'react-use';
import useAsync from 'react-use/lib/useAsync';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import useDebounce from 'react-use/lib/useDebounce';
import { stats } from '@/utils/stats';
import { openapi } from '@/core/request';
import { useRefreshId, useSetQuoteVisible, useSetRefreshId } from './context';
import { getChainDefaultToken } from '@/constant/swap';
import { tokenAmountBn } from '@/screens/Swap/utils';
import BigNumber from 'bignumber.js';
import { useBridgeSlippage } from './slippage';
import { isNaN } from 'lodash';
import { useLoadMatteredChainBalances } from '@/hooks/accountChainBalance';
import { useAggregatorsList, useBridgeSupportedChains } from './atom';
import { getERC20Allowance } from '@/core/apis/provider';
import { apiProvider } from '@/core/apis';
import { useMount } from 'ahooks';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { useSwapBridgeSlider } from '@/screens/Swap/hooks/slider';
import { eventBus, EVENTS } from '@/utils/events';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { useClearMiniGasStateEffect } from '@/hooks/miniSignGasStore';
import { atom, useAtomValue, useSetAtom } from 'jotai';

export const enableInsufficientQuote = true;

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

const tokenRefreshIdAtom = atom(0);
const useTokenRefreshId = () => useAtomValue(tokenRefreshIdAtom);
const useSetTokenRefreshId = () => useSetAtom(tokenRefreshIdAtom);

const useToken = (type: 'from' | 'to') => {
  const refreshId = useTokenRefreshId();

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const userAddress = currentAccount?.address;

  // 使用 useRef 保持 chain 状态，避免账户切换时重置
  const chainRef = useRef<CHAINS_ENUM | undefined>();
  const [chain, setChain] = useState<CHAINS_ENUM | undefined>(chainRef.current);

  // 标记是否已经初始化过 chain，避免重复初始化
  const isInitializedRef = useRef(false);

  const [token, setToken] = useState<TokenItem & { tokenId?: string }>();

  // 同步 chain 状态到 ref，保持状态持久化
  useEffect(() => {
    if (chain) {
      chainRef.current = chain;
    }
  }, [chain]);

  const switchChain: (changeChain?: CHAINS_ENUM, resetToken?: boolean) => void =
    useCallback(
      (changeChain?: CHAINS_ENUM, resetToken = true) => {
        // 同时更新 state 和 ref
        setChain(changeChain);
        if (changeChain) {
          chainRef.current = changeChain;
          isInitializedRef.current = true; // 标记已初始化
        }
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

export const useBridge = (isForMultipleAddress?: boolean) => {
  const setTokenRefreshId = useSetTokenRefreshId();

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const userAddress = currentAccount?.address;
  const refreshId = useRefreshId();

  const setRefreshId = useSetRefreshId();

  const [fromChain, fromToken, setFromToken, switchFromChain] =
    useToken('from');
  const [toChain, toToken, setToToken, switchToChain] = useToken('to');

  // 标记是否已经初始化过 fromChain，避免重复初始化
  const isFromChainInitializedRef = useRef(false);
  // 标记是否已经初始化过 toChain，避免重复初始化
  const isToChainInitializedRef = useRef(false);

  // 包装 switchFromChain，更新初始化标记
  const wrappedSwitchFromChain = useCallback(
    (chain?: CHAINS_ENUM, resetToken?: boolean) => {
      if (chain) {
        isFromChainInitializedRef.current = true;
      }
      switchFromChain(chain, resetToken);
    },
    [switchFromChain],
  );

  // 包装 switchToChain，更新初始化标记
  const wrappedSwitchToChain = useCallback(
    (chain?: CHAINS_ENUM, resetToken?: boolean) => {
      if (chain) {
        isToChainInitializedRef.current = true;
      }
      switchToChain(chain, resetToken);
    },
    [switchToChain],
  );

  if (!toChain && toToken) {
    wrappedSwitchToChain();
  }

  const [amount, setAmount] = useState('');

  const slippageObj = useBridgeSlippage();

  const [recommendFromToken, setRecommendFromToken] = useState<TokenItem>();

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

  const inSufficientCanGetQuote = useMemo(
    () => (enableInsufficientQuote ? true : !inSufficient),
    [inSufficient],
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
          is_all: true,
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
          wrappedSwitchToChain(lastBridgeChain.enum);
          setToToken(latestToToken);
        } else {
          wrappedSwitchToChain(remoteChain);
        }
      } else {
        wrappedSwitchToChain(remoteChain);
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

  const { fetchOrderedChainList } = useLoadMatteredChainBalances({
    account: currentAccount!,
  });
  const supportedChains = useBridgeSupportedChains();
  // the most worth chain is the first
  // useAsyncInitializeChainList({
  //   supportChains: supportedChains,
  //   onChainInitializedAsync: firstEnum => {
  //     switchFromChain(firstEnum);
  //     getRecommendToChain(firstEnum);
  //   },
  // });

  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        typeof RootNames.Bridge | typeof RootNames.MultiBridge
      >
    >();
  const navState = route.params;

  // init from token and chain
  useMount(() => {
    if (!navState?.chainEnum || !navState?.tokenId) {
      return;
    }

    const chainItem = findChainByEnum(navState?.chainEnum, { fallback: true });
    wrappedSwitchFromChain(chainItem?.enum || CHAINS_ENUM.ETH, false);
    setFromToken({
      ...getChainDefaultToken(chainItem?.enum || CHAINS_ENUM.ETH),
      id: navState?.tokenId,
    });
  });

  // init to token and chain
  useMount(() => {
    if (!navState?.toChainEnum || !navState?.toTokenId) {
      return;
    }

    const chainItem = findChainByEnum(navState?.toChainEnum, {
      fallback: true,
    });
    wrappedSwitchToChain(chainItem?.enum || CHAINS_ENUM.ETH, false);
    setToToken({
      ...getChainDefaultToken(chainItem?.enum || CHAINS_ENUM.ETH),
      id: navState?.toTokenId,
    });
  });

  const switchToken = useCallback(() => {
    wrappedSwitchFromChain(toChain, false);
    wrappedSwitchToChain(fromChain, false);
    setFromToken(toToken);
    setToToken(fromToken);
  }, [
    setFromToken,
    toToken,
    setToToken,
    fromToken,
    wrappedSwitchFromChain,
    toChain,
    wrappedSwitchToChain,
    fromChain,
  ]);

  const [quoteList, setQuotesList] = useState<SelectedBridgeQuote[]>([]);

  const setSelectedBridgeQuote = useCallback(
    (quote?: SelectedBridgeQuote) => {
      if (!quote?.manualClick && expiredTimer.current) {
        clearTimeout(expiredTimer.current);
      }

      if (!quote?.manualClick && quote) {
        expiredTimer.current = setTimeout(() => {
          setRefreshId(e => e + 1);
        }, 1000 * 30);
      }
      setOriSelectedBridgeQuote(quote);
    },
    [setRefreshId],
  );

  // const aggregatorsList = useBridgeSupportedChains(s => s.bridge.aggregatorsList || []);
  const aggregatorsList = useAggregatorsList();

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

  const { value: gasList } = useAsync(() => {
    return apiProvider.gasMarketV2(
      {
        chainId: chainInfo.serverId,
      },
      currentAccount!,
    );
  }, [chainInfo?.serverId]);

  const [passGasPrice, setUseGasPrice] = useState(false);
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

  const handleSlider100 = useCallback(() => {
    if (fromToken) {
      setUseGasPrice(false);
      setAmount(tokenAmountBn(fromToken).toString(10));
    }
    if (payTokenIsNativeToken && fromToken) {
      if (normalGasPrice) {
        const val = tokenAmountBn(fromToken).minus(
          new BigNumber(gasLimit)
            .times(normalGasPrice)
            .div(10 ** nativeTokenDecimals),
        );
        if (!val.lt(0)) {
          setUseGasPrice(true);
        }
        setAmount(
          val.lt(0) ? tokenAmountBn(fromToken).toString(10) : val.toString(10),
        );
      }
    }
  }, [
    fromToken,
    gasLimit,
    nativeTokenDecimals,
    normalGasPrice,
    payTokenIsNativeToken,
  ]);

  const {
    onChangeSlider,
    slider,
    setSlider,
    isDraggingSlider,
    setIsDraggingSlider,
  } = useSwapBridgeSlider({
    setAmount,
    fromToken,
    handleSlider100,
  });

  const handleAmountChange = useCallback(
    (e: string) => {
      const v = formatSpeicalAmount(e);
      if (!/^\d*(\.\d*)?$/.test(v)) {
        return;
      }
      if (fromToken) {
        const slider = v
          ? Number(
              new BigNumber(v || 0)
                .div(fromToken?.amount ? tokenAmountBn(fromToken) : 1)
                .times(100)
                .toFixed(0),
            )
          : 0;
        setSlider(slider < 0 ? 0 : slider > 100 ? 100 : slider);
        if (!fromToken?.amount) {
          setSlider(0);
        }
      }
      setUseGasPrice(false);
      setAmount(v);
      if (Number(v) > 0) {
        setPending(true);
      }
    },
    [fromToken, setSlider],
  );

  const handleMax = useCallback(() => {
    setUseGasPrice(false);

    if (payTokenIsNativeToken && fromToken) {
      if (normalGasPrice) {
        const val = tokenAmountBn(fromToken).minus(
          new BigNumber(gasLimit)
            .times(normalGasPrice)
            .div(10 ** nativeTokenDecimals),
        );
        if (!val.lt(0)) {
          setUseGasPrice(true);
        }
        setAmount(
          val.lt(0) ? tokenAmountBn(fromToken).toString(10) : val.toString(10),
        );
        setSlider(100);
      }
    }

    if (!payTokenIsNativeToken && fromToken) {
      isMaxRef.current = true;
      handleAmountChange?.(tokenAmountBn(fromToken)?.toString(10));
      setClickMaxBtnCount(e => e + 1);
    }
  }, [
    payTokenIsNativeToken,
    fromToken,
    normalGasPrice,
    gasLimit,
    nativeTokenDecimals,
    setSlider,
    handleAmountChange,
  ]);

  const fillRecommendFromToken = useCallback(() => {
    if (recommendFromToken) {
      const targetChain = findChainByServerID(recommendFromToken?.chain);
      if (targetChain) {
        wrappedSwitchFromChain(targetChain.enum, false);
        setFromToken(recommendFromToken);
        setAmount('');
        setSlider(0);
        setIsDraggingSlider(false);
      }
    }
  }, [
    recommendFromToken,
    wrappedSwitchFromChain,
    setFromToken,
    setSlider,
    setIsDraggingSlider,
  ]);

  const fetchIdRef = useRef(0);
  const [{ loading: quoteLoading, error: quotesError }, getQuoteList] =
    useAsyncFn(async () => {
      fetchIdRef.current += 1;
      const currentFetchId = fetchIdRef.current;

      if (
        inSufficientCanGetQuote &&
        userAddress &&
        fromToken?.id &&
        toToken?.id &&
        toToken &&
        fromChain &&
        toChain &&
        Number(amount) > 0 &&
        aggregatorsList.length > 0 &&
        !isDraggingSlider
      ) {
        let isEmpty = false;
        const result: SelectedBridgeQuote[] = [];
        setTokenRefreshId(e => e + 1);

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
                  currentAccount.address,
                  currentAccount,
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
    }, [
      inSufficientCanGetQuote,
      aggregatorsList,
      refreshId,
      userAddress,
      fromToken?.id,
      toToken?.id,
      fromChain,
      toChain,
      amount,
      slippageObj.slippage,
      isDraggingSlider,
    ]);

  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (
      inSufficientCanGetQuote &&
      userAddress &&
      fromToken?.id &&
      toToken?.id &&
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
    inSufficientCanGetQuote,
    userAddress,
    fromToken?.id,
    toToken?.id,
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

  useEffect(() => {
    if (!quoteLoading && toToken?.id && quoteList.every(e => !e.loading)) {
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
    // ignore toToken price update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteList, quoteLoading, toToken?.id, setSelectedBridgeQuote]);

  if (quotesError) {
    console.error('quotesError', quotesError);
  }

  const initIdRef = useRef(0); // just work on lastest fetch and clear old fetch
  const initChainByCache = useCallback(async () => {
    initIdRef.current += 1;
    const currentFetchId = initIdRef.current;
    const { firstChain } = await fetchOrderedChainList({
      address: currentAccount?.address,
      supportChains: supportedChains,
    });
    if (initIdRef.current !== currentFetchId) {
      return;
    }
    const firstChainEnum = firstChain?.enum || CHAINS_ENUM.ETH;
    setAmount('');
    setSlider(0);
    setIsDraggingSlider(false);
    // 只有在没有导航状态且未初始化时才设置 chain
    if (!navState?.chainEnum && !isFromChainInitializedRef.current) {
      console.log('initChainByCache - setting initial chain:', firstChainEnum);
      wrappedSwitchFromChain(firstChainEnum);
    }
    const getRemoteRecommendChain = async () => {
      if (initIdRef.current === currentFetchId) {
        const data = await openapi.getRecommendBridgeToChain({
          from_chain_id: findChainByEnum(firstChainEnum)!.serverId,
        });
        // 只有在未初始化时才设置 to chain
        if (
          initIdRef.current === currentFetchId &&
          !isToChainInitializedRef.current
        ) {
          console.log(
            'initChainByCache - setting initial to chain:',
            findChainByServerID(data.to_chain_id)?.enum,
          );
          wrappedSwitchToChain(findChainByServerID(data.to_chain_id)?.enum);
        }
      }
    };
    if (userAddress) {
      const latestTx = await openapi.getBridgeHistoryList({
        user_addr: userAddress,
        start: 0,
        limit: 1,
        is_all: true,
      });
      if (initIdRef.current !== currentFetchId) {
        return;
      }
      const latestToToken = latestTx?.history_list?.[0]?.to_token;
      if (latestToToken && !isToChainInitializedRef.current) {
        const lastBridgeChain = findChainByServerID(latestToToken.chain);
        if (lastBridgeChain && lastBridgeChain.enum !== firstChainEnum) {
          wrappedSwitchToChain(lastBridgeChain.enum);
          setToToken(latestToToken);
        } else {
          await getRemoteRecommendChain();
        }
      } else if (!isToChainInitializedRef.current) {
        await getRemoteRecommendChain();
      }
    }
  }, [
    currentAccount?.address,
    fetchOrderedChainList,
    supportedChains,
    setSlider,
    setIsDraggingSlider,
    navState?.chainEnum,
    wrappedSwitchFromChain,
    userAddress,
    wrappedSwitchToChain,
    setToToken,
    isFromChainInitializedRef,
    isToChainInitializedRef,
  ]);

  useEffect(() => {
    initChainByCache();
  }, [initChainByCache]);

  useEffect(() => {
    setQuotesList([]);
    setRecommendFromToken(undefined);
    setSelectedBridgeQuote(undefined);
  }, [fromToken?.id, toToken?.id, fromChain, toChain, setSelectedBridgeQuote]);

  useEffect(() => {
    if (!inSufficientCanGetQuote) {
      setQuotesList([]);
      setRecommendFromToken(undefined);
      setSelectedBridgeQuote(undefined);
    }
  }, [inSufficientCanGetQuote, setSelectedBridgeQuote]);

  useEffect(() => {
    if (!enableInsufficientQuote || !amount || Number(amount) === 0) {
      setQuotesList([]);
      setRecommendFromToken(undefined);
      setSelectedBridgeQuote(undefined);
    }
  }, [amount, setSelectedBridgeQuote]);

  useEffect(() => {
    setAmount('');
    setSlider(0);
    setIsDraggingSlider(false);
  }, [fromChain, setIsDraggingSlider, setSlider]);

  useFocusEffect(
    useCallback(() => {
      const refresh = () => {
        setTokenRefreshId(e => e + 1);
      };
      eventBus.addListener(EVENTS.RELOAD_TX, refresh);
      return () => {
        eventBus.removeListener(EVENTS.RELOAD_TX, refresh);
      };
    }, [setTokenRefreshId]),
  );

  useClearMiniGasStateEffect({
    chainServerId: findChainByEnum(fromChain)?.serverId || '',
  });

  return {
    clearExpiredTimer,

    fromChain,
    fromToken,
    setFromToken,
    switchFromChain: wrappedSwitchFromChain,
    toChain,
    toToken,
    setToToken,
    switchToChain: wrappedSwitchToChain,
    switchToken,

    recommendFromToken,
    fillRecommendFromToken,

    inSufficient,
    inSufficientCanGetQuote,
    amount,
    handleAmountChange,
    showLoss,

    openQuotesList,
    quoteLoading: pending || quoteLoading,
    quoteList,
    setQuotesList,

    bestQuoteId,
    selectedBridgeQuote,

    gasLimit,
    gasList,
    passGasPrice,
    handleMax,
    clickMaxBtnCount,
    isMaxRef,
    payTokenIsNativeToken,

    setSelectedBridgeQuote,
    ...slippageObj,

    onChangeSlider,
    slider,
  };
};
