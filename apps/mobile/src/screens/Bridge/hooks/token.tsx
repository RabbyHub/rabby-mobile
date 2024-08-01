import { BridgeQuote, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  useQuoteVisible,
  useRefreshId,
  useSetQuoteVisible,
  useSetRefreshId,
} from './context';

import { findChain } from '@/utils/chain';
import { CHAINS_ENUM } from '@debank/common';
import { openapi } from '@/core/request';
import { CHAINS } from '@/constant/chains';
import { bridgeService } from '@/core/services';
import { useAsyncInitializeChainList } from '@/hooks/useChain';
import { useAggregatorsList, useBridgeSupportedChains } from './atom';
import { formatSpeicalAmount } from '@/utils/number';
import { stats } from '@/utils/stats';
import { getERC20Allowance } from '@/core/apis/provider';
import { addressUtils } from '@rabby-wallet/base-utils';
import { ETH_USDT_CONTRACT } from '@/constant/swap';
import useAsync from 'react-use/lib/useAsync';
import useDebounce from 'react-use/lib/useDebounce';
import useDebounceValue from '@/hooks/common/useDebounceValue';

const { isSameAddress } = addressUtils;

const useTokenInfo = ({
  userAddress,
  chain,
  defaultToken,
}: {
  userAddress?: string;
  chain?: CHAINS_ENUM;
  defaultToken?: TokenItem;
}) => {
  const refreshId = useRefreshId();
  const [token, setToken] = useState<TokenItem | undefined>(defaultToken);

  const { value, loading, error } = useAsync(async () => {
    if (userAddress && token?.id && chain) {
      const data = await openapi.getToken(
        userAddress,
        findChain({ enum: chain })?.serverId || CHAINS[chain].serverId,
        token.id,
      );
      return data;
    }
  }, [
    refreshId,
    userAddress,
    token?.id,
    //
    token?.raw_amount_hex_str,
    chain,
  ]);

  useDebounce(
    () => {
      if (value && !error && !loading) {
        setToken(value);
      }
    },
    300,
    [value, error, loading],
  );

  if (error) {
    console.error('token info error', chain, token?.symbol, token?.id, error);
  }
  return [token, setToken] as const;
};

export interface SelectedBridgeQuote extends Omit<BridgeQuote, 'tx'> {
  shouldApproveToken?: boolean;
  shouldTwoStepApprove?: boolean;
  loading?: boolean;
  tx?: BridgeQuote['tx'];
  manualClick?: boolean;
}

export const useTokenPair = (userAddress: string) => {
  const refreshId = useRefreshId();

  const {
    initialSelectedChain,
    oChain,
    defaultSelectedFromToken,
    defaultSelectedToToken,
  } = useMemo(() => {
    const lastSelectedChain = bridgeService.getSelectedChain();

    return {
      initialSelectedChain: lastSelectedChain,
      oChain: bridgeService.getSelectedChain() || CHAINS_ENUM.ETH,
      defaultSelectedFromToken: bridgeService.getSelectedFromToken(),
      defaultSelectedToToken: bridgeService.getSelectedToToken(),
    };
  }, []);

  const [chain, setChain] = useState(oChain);
  const handleChain = useCallback((c: CHAINS_ENUM) => {
    setChain(c);
    bridgeService.setSelectedChain(c);
  }, []);

  const [payToken, setPayToken] = useTokenInfo({
    userAddress,
    chain: defaultSelectedFromToken?.chain
      ? findChain({ serverId: defaultSelectedFromToken?.chain })?.enum
      : undefined,
    defaultToken: defaultSelectedFromToken,
  });

  const [receiveToken, setReceiveToken] = useTokenInfo({
    userAddress,
    chain,
    defaultToken: defaultSelectedToToken,
  });

  const setSelectedBridgeQuote: React.Dispatch<
    React.SetStateAction<SelectedBridgeQuote | undefined>
  > = useCallback(p => {
    if (expiredTimer.current) {
      clearTimeout(expiredTimer.current);
    }
    setExpired(false);
    expiredTimer.current = setTimeout(() => {
      setExpired(true);
    }, 1000 * 30);
    setOriSelectedBridgeQuote(p);
  }, []);

  const switchChain = useCallback(
    (c: CHAINS_ENUM) => {
      handleChain(c);
      setPayToken(undefined);
      setReceiveToken(undefined);
      setPayAmount('');
      setSelectedBridgeQuote(undefined);
    },
    [handleChain, setSelectedBridgeQuote, setPayToken, setReceiveToken],
  );

  const supportedChains = useBridgeSupportedChains();

  useAsyncInitializeChainList({
    // NOTICE: now `useTokenPair` is only used for swap page, so we can use `SWAP_SUPPORT_CHAINS` here
    supportChains: supportedChains,
    onChainInitializedAsync: firstEnum => {
      // only init chain if it's not cached before
      if (!initialSelectedChain) {
        switchChain(firstEnum);
      }
    },
  });

  useEffect(() => {
    bridgeService.setSelectedFromToken(payToken);
  }, [payToken]);

  useEffect(() => {
    bridgeService.setSelectedToToken(receiveToken);
  }, [receiveToken]);

  const [inputAmount, setPayAmount] = useState('');

  const debouncePayAmount = useDebounceValue(inputAmount, 300);

  const [selectedBridgeQuote, setOriSelectedBridgeQuote] = useState<
    SelectedBridgeQuote | undefined
  >();

  const expiredTimer = useRef<NodeJS.Timeout>();
  const [expired, setExpired] = useState(false);

  const handleAmountChange = useCallback((e: string) => {
    const v = formatSpeicalAmount(e);
    if (!/^\d*(\.\d*)?$/.test(v)) {
      return;
    }
    setPayAmount(v);
  }, []);

  const handleBalance = useCallback(() => {
    if (payToken) {
      setPayAmount(tokenAmountBn(payToken).toString(10));
    }
  }, [payToken]);

  const inSufficient = useMemo(
    () =>
      payToken
        ? tokenAmountBn(payToken).lt(debouncePayAmount)
        : new BigNumber(0).lt(debouncePayAmount),
    [payToken, debouncePayAmount],
  );

  const [quoteList, setQuotesList] = useState<SelectedBridgeQuote[]>([]);

  useEffect(() => {
    setQuotesList([]);
    setSelectedBridgeQuote(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payToken?.id, receiveToken?.id, chain, debouncePayAmount, inSufficient]);

  const visible = useQuoteVisible();

  useEffect(() => {
    if (!visible) {
      setQuotesList([]);
    }
  }, [visible]);

  const setRefreshId = useSetRefreshId();

  const aggregatorsList = useAggregatorsList();

  const fetchIdRef = useRef(0);

  const [isEmptyQuote, setIsEmptyQuote] = useState(false);

  const { loading: quoteLoading, error: quotesError } = useAsync(async () => {
    if (
      !inSufficient &&
      userAddress &&
      payToken?.id &&
      receiveToken?.id &&
      receiveToken &&
      chain &&
      Number(debouncePayAmount) > 0 &&
      aggregatorsList.length > 0
    ) {
      fetchIdRef.current += 1;
      const currentFetchId = fetchIdRef.current;

      let preQuotesIsEmpty = false;
      const result: SelectedBridgeQuote[] = [];
      setIsEmptyQuote(false);

      setQuotesList(e => {
        if (!e.length) {
          preQuotesIsEmpty = true;
        }
        return e?.map(e => ({ ...e, loading: true }));
      });

      setSelectedBridgeQuote(undefined);

      const originData = await openapi
        .getBridgeQuoteList({
          aggregator_ids: aggregatorsList.map(e => e.id).join(','),
          from_token_id: payToken.id,
          user_addr: userAddress,
          from_chain_id: payToken.chain,
          from_token_raw_amount: new BigNumber(debouncePayAmount)
            .times(10 ** payToken.decimals)
            .toFixed(0, 1)
            .toString(),
          to_chain_id: receiveToken.chain,
          to_token_id: receiveToken.id,
        })
        .catch(err => {
          console.log('err', err);
          setIsEmptyQuote(true);
          if (currentFetchId === fetchIdRef.current) {
            stats.report('bridgeQuoteResult', {
              aggregatorIds: aggregatorsList.map(e => e.id).join(','),
              fromChainId: payToken.chain,
              fromTokenId: payToken.id,
              toTokenId: receiveToken.id,
              toChainId: receiveToken.chain,
              status: 'fail',
              amount: debouncePayAmount,
            });
          }
        })
        .finally(() => {});

      const data = originData?.filter(
        quote =>
          !!quote?.bridge &&
          !!quote?.bridge?.id &&
          !!quote?.bridge?.logo_url &&
          !!quote.bridge.name,
      );

      if (currentFetchId === fetchIdRef.current) {
        stats.report('bridgeQuoteResult', {
          aggregatorIds: aggregatorsList.map(e => e.id).join(','),
          fromChainId: payToken.chain,
          fromTokenId: payToken.id,
          toTokenId: receiveToken.id,
          toChainId: receiveToken.chain,
          status: data ? (data?.length === 0 ? 'none' : 'success') : 'fail',
        });
      }

      if (data && currentFetchId === fetchIdRef.current) {
        if (!preQuotesIsEmpty) {
          setQuotesList(data.map(e => ({ ...e, loading: true })));
        }

        await Promise.allSettled(
          data.map(async quote => {
            if (currentFetchId !== fetchIdRef.current) {
              return;
            }
            let tokenApproved = false;
            let allowance = '0';
            const fromChain = findChain({ serverId: payToken?.chain });
            if (payToken?.id === fromChain?.nativeTokenAddress) {
              tokenApproved = true;
            } else {
              allowance = await getERC20Allowance(
                payToken.chain,
                payToken.id,
                quote.approve_contract_id,
              );
              tokenApproved = new BigNumber(allowance).gte(
                new BigNumber(debouncePayAmount).times(10 ** payToken.decimals),
              );
            }
            let shouldTwoStepApprove = false;
            if (
              fromChain?.enum === CHAINS_ENUM.ETH &&
              isSameAddress(payToken.id, ETH_USDT_CONTRACT) &&
              Number(allowance) !== 0 &&
              !tokenApproved
            ) {
              shouldTwoStepApprove = true;
            }

            if (preQuotesIsEmpty) {
              result.push({
                ...quote,
                shouldTwoStepApprove,
                shouldApproveToken: !tokenApproved,
              });
            } else {
              if (currentFetchId === fetchIdRef.current) {
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

        if (preQuotesIsEmpty && currentFetchId === fetchIdRef.current) {
          setQuotesList(result);
        }
      }
    }
  }, [
    inSufficient,
    aggregatorsList,
    refreshId,
    userAddress,
    payToken?.id,
    receiveToken?.id,
    chain,
    debouncePayAmount,
  ]);

  const [bestQuoteId, setBestQuoteId] = useState<
    | {
        bridgeId: string;
        aggregatorId: string;
      }
    | undefined
  >(undefined);

  const openQuote = useSetQuoteVisible();

  const openQuotesList = useCallback(() => {
    setQuotesList([]);
    setRefreshId(e => e + 1);
    openQuote(true);
  }, [openQuote, setRefreshId]);

  const notAvailableQuote = useMemo(
    () =>
      !quoteLoading &&
      !!receiveToken &&
      Number(debouncePayAmount) > 0 &&
      (!quoteList || !quoteList.length),
    [debouncePayAmount, quoteList, quoteLoading, receiveToken],
  );

  useEffect(() => {
    if (
      !quoteLoading &&
      receiveToken &&
      Number(debouncePayAmount) > 0 &&
      quoteList.every(e => !e.loading)
    ) {
      const sortedList = quoteList?.sort((b, a) => {
        return new BigNumber(a.to_token_amount)
          .times(receiveToken.price || 1)
          .minus(a.gas_fee.usd_value)
          .minus(
            new BigNumber(b.to_token_amount)
              .times(receiveToken.price || 1)
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

        setSelectedBridgeQuote(preItem =>
          preItem?.manualClick ? preItem : sortedList[0],
        );
      }
    }
  }, [
    quoteList,
    quoteLoading,
    receiveToken,
    setSelectedBridgeQuote,
    debouncePayAmount,
  ]);

  if (quotesError) {
    console.error('quotesError', quotesError);
  }

  console.log('quoteLoading', quoteLoading);

  useEffect(() => {
    setExpired(false);
    setSelectedBridgeQuote(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payToken?.id, receiveToken?.id, chain, debouncePayAmount, inSufficient]);

  return {
    chain,
    switchChain,

    payToken,
    setPayToken,
    receiveToken,
    setReceiveToken,

    handleAmountChange,
    handleBalance,
    inputAmount,
    debouncePayAmount,

    inSufficient,

    quoteLoading,
    quoteList,
    selectedBridgeQuote,
    setSelectedBridgeQuote,
    openQuotesList,

    bestQuoteId,

    notAvailableQuote,
    expired,
  };
};

function tokenAmountBn(token: TokenItem) {
  return new BigNumber(token?.raw_amount_hex_str || 0, 16).div(
    10 ** (token?.decimals || 1),
  );
}
