import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ChainId } from '@aave/contract-helpers';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { OptimalRate } from '@paraswap/sdk';
import { last, noop } from 'lodash';
import BigNumber from 'bignumber.js';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';
import { PopulatedTransaction } from 'ethers';

import { apiProvider } from '@/core/apis';
import { useTheme2024 } from '@/hooks/theme';
import { toast } from '@/components2024/Toast';
import { Button } from '@/components2024/Button';
import { useMiniSigner } from '@/hooks/useSigner';
import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { transactionHistoryService } from '@/core/services';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import RcIconWalletCC from '@/assets2024/icons/swap/wallet-cc.svg';
import { CheckBoxRect } from '@/components2024/CheckBox';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { DirectSignGasInfo } from '@/screens/Bridge/components/BridgeShowMore';
import { BridgeSlippage } from '@/screens/Bridge/components/BridgeSlippage';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { formatSpeicalAmount, formatTokenAmount } from '@/utils/number';
import { WarningText } from '@/screens/Bridge/components/WarningText';
import RcIconBluePolygon from '@/assets2024/icons/bridge/IconBluePolygon.svg';
import {
  MINI_SIGN_ERROR,
  useSignatureStore,
} from '@/components2024/MiniSignV2/state/SignatureManager';
import {
  CUSTOM_HISTORY_ACTION,
  CUSTOM_HISTORY_TITLE_TYPE,
} from '@/screens/Transaction/components/type';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';

import { SwapType } from '../../types/swap';
import DebtSwapModalOverview from './Overview';
import TokenIcon from '../../components/TokenIcon';
import { APP_CODE_LENDING_DEBT_SWAP } from '../../utils/constant';
import { ParaswapRatesType, SwappableToken } from '../../types/swap';
import { getParaswap } from '../../config/paraswap';
import { getParaswapSellRates } from '../../components/actions/DebtSwap/paraswap';
import { usePoolDataProviderContract, useSelectedMarket } from '../../hooks';
import {
  useDebtSwapSlippage,
  useFormatValues,
  useHFForDebtSwap,
  useSwapReserves,
} from './hooks';
import DebtSwapModalSlider from './Slider';
import {
  DEFAULT_DEBT_SWAP_SLIPPAGE,
  maxInputAmountWithSlippage,
  formatTx,
} from './utils';
import {
  buildDebtSwitchTx,
  generateApproveDelegation,
} from '../../poolService';
import { normalizeBN } from '@aave/math-utils';
import {
  getApproveAmount,
  getPriceImpactData,
  getToAmountAfterSlippage,
} from './warning';
import BridgeSwitchBtn from '@/screens/Bridge/components/BridgeSwitchBtn';

interface DebtSwapModalProps {
  fromToken: SwappableToken;
  onClose?: () => void;
}

const BOTTOM_SIZE = {
  BUTTON: 116,
  CHECKBOX: 40,
  TIPS: 80,
};

export default function DebtSwapModal({
  fromToken,
  onClose,
}: DebtSwapModalProps) {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'Lending',
  });

  const { chainEnum, chainInfo, selectedMarketData } = useSelectedMarket();
  const { pools } = usePoolDataProviderContract();
  const { ctx } = useSignatureStore();

  const [fromAmount, setFromAmount] = useState<string>('');
  const debouncedFromAmount = useDebouncedValue(fromAmount, 400);
  const [toToken, setToToken] = useState<SwappableToken | undefined>();
  const [toAmount, setToAmount] = useState<string>('');

  const [quote, setQuote] = useState<ParaswapRatesType | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);

  const [slider, setSlider] = useState<number>(0);
  const [riskChecked, setRiskChecked] = useState(false);
  const [noQuote, setNoQuote] = useState(false);
  const [quoteRefreshId, setQuoteRefreshId] = useState(0);

  const [swapRate, setSwapRate] = useState<{
    optimalRateData?: OptimalRate;
    inputAmount?: string;
    outputAmount?: string;
    slippageBps?: number;
    maxInputAmountWithSlippage?: string;
  }>({});

  const [currentTxs, setCurrentTxs] = useState<Tx[]>([]);

  const lastQuoteParamsRef = useRef<{
    rawAmount: string;
    toToken?: string;
    srcAmount?: string;
  }>();

  const quoteExpiredTimerRef = useRef<NodeJS.Timeout>();
  const enableQuoteAutoRefreshRef = useRef(false);

  const { fromBalanceBn, fromBalanceDisplay, fromUsdValue, toUsdValue } =
    useFormatValues({
      fromToken,
      toToken,
      fromAmount,
      toAmount,
    });
  const { fromReserve, toReserve, isSameToken, toDisplayReserve } =
    useSwapReserves({
      fromToken,
      toToken,
    });
  const {
    slippage,
    slippageBpsRef,
    setSlippage,
    autoSlippage,
    setAutoSlippage,
    isCustomSlippage,
    setIsCustomSlippage,
    displaySlippage,
  } = useDebtSwapSlippage({
    fromToken,
    toToken,
    setSwapRate,
  });
  const toAmountAfterSlippage = useMemo(() => {
    return getToAmountAfterSlippage({
      inputAmount: toAmount,
      slippage: Number(slippage) * 100,
    });
  }, [toAmount, slippage]);

  const priceImpactData = useMemo(() => {
    return getPriceImpactData({
      fromToken,
      toToken,
      fromAmount: debouncedFromAmount,
      toAmount: toAmountAfterSlippage,
    });
  }, [debouncedFromAmount, toToken, fromToken, toAmountAfterSlippage]);

  useEffect(() => {
    setRiskChecked(false);
  }, [displaySlippage, priceImpactData.showConfirmation]);

  const canShowDirectSubmit = useMemo(
    () => isAccountSupportMiniApproval(currentAccount?.type || ''),
    [currentAccount?.type],
  );

  const clearQuoteExpiredTimer = useCallback(() => {
    if (quoteExpiredTimerRef.current) {
      clearTimeout(quoteExpiredTimerRef.current);
    }
  }, []);

  useEffect(
    () => () => {
      clearQuoteExpiredTimer();
    },
    [clearQuoteExpiredTimer],
  );

  const onChangeSlider = useCallback(
    (v: number) => {
      setSlider(v);
      if (v === 100) {
        setFromAmount(fromBalanceBn.toString(10));
        return;
      }
      const newAmountBn = new BigNumber(v).div(100).times(fromBalanceBn);
      const isTooSmall = newAmountBn.lt(0.0001);
      setFromAmount(
        isTooSmall
          ? newAmountBn.toString(10)
          : new BigNumber(newAmountBn.toFixed(4, 1)).toString(10),
      );
    },
    [fromBalanceBn],
  );

  const onInputChange = useCallback(
    (text: string) => {
      const formatted = formatSpeicalAmount(text);
      if (!/^\d*(\.\d*)?$/.test(formatted)) {
        return;
      }

      // 允许输入过程中的中间状态，例如 "0."，并且当清空时保持输入为空
      if (formatted === '') {
        setFromAmount('');
        setSlider(0);
        return;
      }

      const amountBn = new BigNumber(formatted || 0);
      const exceedBalance = amountBn.gt(fromBalanceBn);
      const safeAmountBn = exceedBalance ? fromBalanceBn : amountBn;
      const displayAmountStr = exceedBalance
        ? fromBalanceBn.toString(10)
        : formatted;

      setFromAmount(displayAmountStr);

      const percentage = fromBalanceBn.gt(0)
        ? safeAmountBn.div(fromBalanceBn).times(100).toNumber()
        : 0;
      const clampedPercentage = Math.min(100, Math.max(0, percentage));
      setSlider(Math.round(clampedPercentage));
    },
    [fromBalanceBn],
  );

  const handleOpenTokenSelect = useCallback(() => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DEBT_TOKEN_SELECT,
      excludeTokenAddress: fromToken.underlyingAddress,
      onChange: (selectedToken: SwappableToken) => {
        setToToken(selectedToken);
        setToAmount('');
        setQuote(null);
        setSwapRate({});
        setIsQuoteLoading(false);
        if (fromAmount) {
          setFromAmount(fromAmount);
        }
        removeGlobalBottomSheetModal2024(modalId);
      },
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        rootViewType: 'View',
        handleStyle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-0']
            : colors2024['neutral-bg-1'],
        },
      },
    });
  }, [fromToken.underlyingAddress, fromAmount, colors2024, isLight]);

  useEffect(() => {
    let cancelled = false;
    const fetchQuote = async () => {
      const resetQuote = () => {
        setToAmount('');
        setQuote(null);
        setSwapRate({});
        setIsQuoteLoading(false);
        setNoQuote(false);
        enableQuoteAutoRefreshRef.current = false;
        clearQuoteExpiredTimer();
      };

      setIsQuoteLoading(true);
      if (
        !toToken ||
        isSameToken ||
        !debouncedFromAmount ||
        !currentAccount?.address
      ) {
        resetQuote();
        return;
      }

      const amountBn = new BigNumber(debouncedFromAmount || 0);
      if (amountBn.lte(0)) {
        resetQuote();
        return;
      }
      try {
        const rawAmount = normalizeBN(
          debouncedFromAmount,
          -1 * fromToken.decimals,
        ).toFixed(0);
        const quoteRes = await getParaswapSellRates({
          swapType: SwapType.DebtSwap,
          chainId: fromToken.chainId,
          amount: rawAmount,
          srcToken: toToken.addressToSwap,
          destToken: fromToken.addressToSwap,
          user: currentAccount.address,
          srcDecimals: toToken.decimals,
          destDecimals: fromToken.decimals,
          side: 'buy',
          appCode: APP_CODE_LENDING_DEBT_SWAP,
          options: {
            partner: APP_CODE_LENDING_DEBT_SWAP,
          },
          invertedQuoteRoute: true,
        });
        if (cancelled || !quoteRes) {
          if (!cancelled) {
            setNoQuote(true);
            enableQuoteAutoRefreshRef.current = false;
            clearQuoteExpiredTimer();
          }
          return;
        }
        // paraswap不提供建议滑点，基于硬编码设置默认值
        const destAmount = normalizeBN(
          quoteRes.destSpotAmount,
          quoteRes.destDecimals,
        ).toFixed();

        lastQuoteParamsRef.current = {
          rawAmount,
          toToken: toToken.addressToSwap,
          srcAmount: quoteRes.destSpotAmount,
        };
        setQuote(quoteRes);
        setSwapRate({
          optimalRateData: quoteRes.optimalRateData,
          inputAmount: quoteRes.destSpotAmount,
          outputAmount: rawAmount,
          slippageBps: slippageBpsRef.current,
          maxInputAmountWithSlippage: maxInputAmountWithSlippage(
            quoteRes.destSpotAmount,
            slippageBpsRef.current,
          ),
        });
        setToAmount(destAmount);
        setNoQuote(false);
        enableQuoteAutoRefreshRef.current = true;
        clearQuoteExpiredTimer();
        quoteExpiredTimerRef.current = setTimeout(() => {
          if (enableQuoteAutoRefreshRef.current) {
            setQuoteRefreshId(prev => prev + 1);
          }
        }, 1000 * 30);
      } catch (e) {
        if (!cancelled) {
          setToAmount('');
          setQuote(null);
          setSwapRate({});
          setNoQuote(true);
          enableQuoteAutoRefreshRef.current = false;
          clearQuoteExpiredTimer();
        }
      } finally {
        if (!cancelled) {
          setIsQuoteLoading(false);
        }
      }
    };
    fetchQuote();
    return () => {
      cancelled = true;
    };
  }, [
    debouncedFromAmount,
    fromToken.addressToSwap,
    fromToken.chainId,
    fromToken.decimals,
    toToken,
    currentAccount?.address,
    isSameToken,
    fromToken.symbol,
    slippageBpsRef,
    quoteRefreshId,
    clearQuoteExpiredTimer,
  ]);

  const {
    openDirect,
    prefetch: prefetchMiniSigner,
    close: closeMiniSigner,
  } = useMiniSigner({
    account: currentAccount!,
    chainServerId: chainInfo?.serverId || '',
    autoResetGasStoreOnChainChange: true,
  });

  const buildDebtSwapTxs = useCallback(async (): Promise<Tx[]> => {
    if (
      !currentAccount ||
      !toToken ||
      !quote ||
      !swapRate.optimalRateData ||
      !selectedMarketData?.addresses?.DEBT_SWITCH_ADAPTER ||
      !pools?.provider ||
      !toReserve ||
      !fromReserve
    ) {
      return [];
    }

    const rawAmount = normalizeBN(
      debouncedFromAmount,
      -1 * fromToken.decimals,
    ).toFixed(0);
    if (
      !lastQuoteParamsRef.current ||
      lastQuoteParamsRef.current.rawAmount !== rawAmount ||
      lastQuoteParamsRef.current.toToken !== toToken.addressToSwap
    ) {
      throw new Error('quote-outdated');
    }

    const { paraswap, feeTarget } = getParaswap(fromToken.chainId as ChainId);
    const slippageBps = swapRate.slippageBps ?? DEFAULT_DEBT_SWAP_SLIPPAGE;
    const txParams: any = await paraswap.buildTx(
      {
        srcToken: toToken.addressToSwap,
        destToken: fromToken.addressToSwap,
        // 只考虑 buy 场景，固定使用 destAmount = rawAmount
        destAmount: rawAmount,
        slippage: slippageBps,
        priceRoute: swapRate.optimalRateData,
        userAddress: currentAccount.address,
        partnerAddress: feeTarget,
        srcDecimals: toToken.decimals,
        destDecimals: fromToken.decimals,
        isDirectFeeTransfer: true,
        takeSurplus: true,
      },
      {
        ignoreChecks: true,
      },
    );

    const swapCallData = txParams.data;
    const augustus = txParams.to;
    const maxNewDebtAmount =
      swapRate.maxInputAmountWithSlippage ||
      swapRate.inputAmount ||
      swapRate.optimalRateData.srcAmount ||
      '0';
    const isMaxSelected = new BigNumber(debouncedFromAmount || 0).gte(
      fromBalanceBn,
    );

    const debtSwitchTx = buildDebtSwitchTx({
      provider: pools.provider,
      address: currentAccount.address,
      fromAddress: fromToken.underlyingAddress,
      rawAmount,
      isMaxSelected,
      debtSwitchAdapterAddress:
        selectedMarketData.addresses.DEBT_SWITCH_ADAPTER,
      maxNewDebtAmount,
      txCalldata: swapCallData,
      augustus,
      newAssetDebtToken: toReserve.variableDebtTokenAddress,
      newAssetUnderlying: toToken.underlyingAddress,
    });

    let delegationTx: PopulatedTransaction | undefined;
    if (toReserve.variableDebtTokenAddress) {
      delegationTx = await generateApproveDelegation({
        provider: pools.provider,
        address: currentAccount.address,
        delegatee: selectedMarketData.addresses.DEBT_SWITCH_ADAPTER,
        debtTokenAddress: toReserve.variableDebtTokenAddress,
        amount: getApproveAmount(maxNewDebtAmount, slippageBps),
        decimals: toToken.decimals,
      });
    }

    const txs: Tx[] = [];
    const formattedDelegationTx = delegationTx
      ? formatTx(delegationTx, currentAccount.address, fromToken.chainId)
      : undefined;
    const formattedDebtSwitchTx = formatTx(
      debtSwitchTx,
      currentAccount.address,
      fromToken.chainId,
    );
    if (formattedDelegationTx) {
      txs.push(formattedDelegationTx);
    }
    if (formattedDebtSwitchTx) {
      txs.push(formattedDebtSwitchTx);
    }
    return txs;
  }, [
    currentAccount,
    debouncedFromAmount,
    fromToken.addressToSwap,
    fromToken.chainId,
    fromToken.decimals,
    fromToken.underlyingAddress,
    fromBalanceBn,
    fromReserve,
    pools?.provider,
    quote,
    selectedMarketData?.addresses?.DEBT_SWITCH_ADAPTER,
    swapRate.inputAmount,
    swapRate.maxInputAmountWithSlippage,
    swapRate.optimalRateData,
    swapRate.slippageBps,
    toReserve,
    toToken,
  ]);

  useEffect(() => {
    let cancelled = false;
    const buildTxs = async () => {
      if (
        !currentAccount ||
        !toToken ||
        !quote ||
        !swapRate.optimalRateData ||
        !selectedMarketData?.addresses?.DEBT_SWITCH_ADAPTER ||
        !pools?.provider ||
        !toReserve ||
        !fromReserve ||
        !debouncedFromAmount ||
        new BigNumber(debouncedFromAmount).lte(0)
      ) {
        if (!cancelled) {
          setCurrentTxs([]);
        }
        return;
      }

      try {
        const txs = await buildDebtSwapTxs();
        if (!cancelled) {
          setCurrentTxs(txs);
        }
      } catch (error) {
        if (!cancelled) {
          setCurrentTxs([]);
        }
      }
    };
    buildTxs();
    return () => {
      cancelled = true;
    };
  }, [
    buildDebtSwapTxs,
    currentAccount,
    debouncedFromAmount,
    fromReserve,
    pools?.provider,
    quote,
    selectedMarketData?.addresses?.DEBT_SWITCH_ADAPTER,
    swapRate.optimalRateData,
    toReserve,
    toToken,
  ]);

  const { currentHF, isHFLow, isLiquidatable, afterSwapInfo } =
    useHFForDebtSwap({
      fromToken,
      toToken,
      fromAmount,
      toAmount: toAmountAfterSlippage,
    });

  useEffect(() => {
    if (!currentAccount || !canShowDirectSubmit || !currentTxs?.length) {
      closeMiniSigner();
      return;
    }
    prefetchMiniSigner({
      txs: currentTxs,
      synGasHeaderInfo: true,
      checkGasFeeTooHigh: true,
    });
  }, [
    canShowDirectSubmit,
    closeMiniSigner,
    currentAccount,
    currentTxs,
    prefetchMiniSigner,
  ]);

  const handleSwap = useCallback(
    async (p?: { ignoreGasFee?: boolean; forceFullSign?: boolean }) => {
      if (!toToken || !fromAmount || !currentAccount) {
        return;
      }

      try {
        setIsLoading(true);
        if (!currentTxs.length) {
          toast.info('please retry');
          return;
        }

        let results: string[] = [];
        if (canShowDirectSubmit && !p?.forceFullSign) {
          try {
            results = await openDirect({
              txs: currentTxs,
              ga: {
                customAction: CUSTOM_HISTORY_ACTION.LENDING,
                customActionTitleType:
                  CUSTOM_HISTORY_TITLE_TYPE.LENDING_DEBT_SWAP,
              },
              checkGasFeeTooHigh: ctx?.gasFeeTooHigh,
              ignoreGasFeeTooHigh: p?.ignoreGasFee,
            });
          } catch (error) {
            console.error('CUSTOM_LOGGER:=>: error', error);
            if (error === MINI_SIGN_ERROR.USER_CANCELLED) {
              closeMiniSigner();
              onClose?.();
              return;
            }
            if (error === MINI_SIGN_ERROR.PREFETCH_FAILURE) {
              await handleSwap({
                ...p,
                forceFullSign: true,
              });
            }
            return;
          }
        } else {
          for (const tx of currentTxs) {
            const hash = await apiProvider.sendRequest({
              data: {
                method: 'eth_sendTransaction',
                params: [tx],
              },
              session: INTERNAL_REQUEST_SESSION,
              account: currentAccount,
            });
            results.push(hash);
          }
        }

        const txId = last(results);
        if (txId && chainInfo?.id) {
          transactionHistoryService.setCustomTxItem(
            currentAccount.address,
            chainInfo?.id,
            txId,
            { actionType: CUSTOM_HISTORY_TITLE_TYPE.LENDING_DEBT_SWAP },
          );
        }
        toast.success(
          `${t('page.Lending.debtSwap.actions.title')} ${t(
            'page.Lending.submitted',
          )}`,
        );
        closeMiniSigner();
        onClose?.();
      } catch (error) {
        console.error('debt swap error', error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      toToken,
      fromAmount,
      currentAccount,
      canShowDirectSubmit,
      chainInfo?.id,
      t,
      closeMiniSigner,
      onClose,
      currentTxs,
      openDirect,
      ctx?.gasFeeTooHigh,
    ],
  );

  const isSlippageHigh = useMemo(() => {
    const slippageValue = new BigNumber(displaySlippage || 0);
    return slippageValue.gt(30);
  }, [displaySlippage]);

  const isRisky = useMemo(() => {
    return isSlippageHigh || priceImpactData.showConfirmation || isHFLow;
  }, [isHFLow, isSlippageHigh, priceImpactData.showConfirmation]);

  const riskDesc = useMemo(() => {
    if (isHFLow) {
      return t('page.Lending.debtSwap.lpRiskWarning');
    }
    return t('page.bridge.showMore.signWarning');
  }, [isHFLow, t]);

  const canSwap = useMemo(() => {
    return (
      !!toToken &&
      !isSameToken &&
      !!quote &&
      !!fromAmount &&
      new BigNumber(fromAmount).gt(0) &&
      new BigNumber(fromAmount).lte(fromBalanceBn) &&
      !isQuoteLoading
    );
  }, [fromAmount, fromBalanceBn, isQuoteLoading, isSameToken, quote, toToken]);

  const buttonDisabled = useMemo(() => {
    return !canSwap || (isRisky && !riskChecked) || isLiquidatable;
  }, [canSwap, isLiquidatable, isRisky, riskChecked]);

  return (
    <AutoLockView style={styles.container}>
      <BottomSheetScrollView
        showsVerticalScrollIndicator
        persistentScrollbar
        style={styles.scrollableBlock}
        contentContainerStyle={[styles.contentContainer]}>
        <BottomSheetHandlableView>
          <View style={styles.header}>
            <Text style={styles.titleText}>
              {t('page.Lending.debtSwap.title')}
            </Text>
          </View>
        </BottomSheetHandlableView>

        <Text style={styles.sectionTitle}>
          {t('page.Lending.debtSwap.actions.amount')}
        </Text>
        <View style={styles.content}>
          {/* From Token */}
          <View style={styles.tokenContainer}>
            <View style={styles.tokenHeader}>
              <Text style={styles.label}>
                {t('page.Lending.debtSwap.actions.borrowed')}
              </Text>
              <View style={styles.sliderContainer}>
                <DebtSwapModalSlider
                  fromToken={fromToken}
                  slider={slider}
                  onChangeSlider={onChangeSlider}
                />
                <Text style={styles.sliderValue}>{slider}%</Text>
              </View>
            </View>

            <View style={styles.tokenBody}>
              <TextInput
                style={styles.amountInput}
                value={fromAmount}
                onChangeText={onInputChange}
                placeholder="0"
                keyboardType="numeric"
                textAlign="left"
                numberOfLines={1}
                multiline={false}
                spellCheck={false}
                inputMode="decimal"
                scrollEnabled={true}
                placeholderTextColor={colors2024['neutral-info']}
              />
              {slider !== 100 && (
                <Pressable
                  style={styles.maxButtonWrapper}
                  onPress={() => onChangeSlider(100)}>
                  <Text style={styles.maxButtonText}>MAX</Text>
                </Pressable>
              )}
              <View style={styles.divider} />
              <View style={styles.tokenInfo}>
                <TokenIcon
                  size={26}
                  chainSize={12}
                  chain={chainEnum}
                  tokenSymbol={fromToken.symbol}
                />
                <View style={styles.tokenDetails}>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.tokenSymbol}>
                    {fromToken.symbol}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.usdValueRow}>
              <Text style={styles.usdValue}>{fromUsdValue}</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceText}>
                  {t('page.Lending.debtSwap.borrowBalance')}{' '}
                  {fromBalanceDisplay}
                </Text>
              </View>
            </View>
          </View>

          {/* Arrow Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <View style={styles.arrowContainer}>
              <BridgeSwitchBtn
                style={styles.arrowWrapper}
                loading={isQuoteLoading}
              />
            </View>
          </View>

          {/* To Token */}
          <Pressable
            style={styles.tokenContainer}
            onPress={handleOpenTokenSelect}>
            <View style={styles.tokenHeader}>
              <Text style={styles.label}>
                {t('page.Lending.debtSwap.actions.swapTo')}
              </Text>
            </View>

            <View style={styles.tokenBody}>
              <Text
                style={[
                  styles.amountDisplay,
                  !toAmount && styles.amountDisplayPlaceholder,
                  isQuoteLoading && styles.loadingOpacity,
                ]}>
                {toAmount ? formatTokenAmount(toAmount) : '0'}
              </Text>
              <View
                style={[
                  styles.tokenInfo,
                  !toToken && styles.placeholderTokenInfo,
                ]}>
                {toToken ? (
                  <>
                    <TokenIcon
                      size={26}
                      chainSize={12}
                      chain={chainEnum}
                      tokenSymbol={toToken.symbol}
                    />
                    <View style={styles.tokenDetails}>
                      <Text style={styles.tokenSymbol}>{toToken.symbol}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.selectTokenText}>
                      {t('page.Lending.debtSwap.actions.select')}
                    </Text>
                  </>
                )}
                <RcIconSwapBottomArrow />
              </View>
            </View>

            {toToken && (
              <View style={styles.usdValueRow}>
                <Text
                  style={[
                    styles.usdValue,
                    isQuoteLoading && styles.loadingOpacity,
                  ]}>
                  {toUsdValue}
                </Text>
                <View style={styles.balanceRow}>
                  <RcIconWalletCC
                    width={16}
                    height={16}
                    color={colors2024['neutral-foot']}
                  />
                  <Text style={styles.balanceText}>
                    {formatTokenAmount(
                      toDisplayReserve?.variableBorrows || '0',
                    )}
                  </Text>
                </View>
              </View>
            )}
          </Pressable>
        </View>
        {noQuote && !isQuoteLoading && (
          <Text style={styles.errorText}>{t('page.swap.no-quote-found')}</Text>
        )}

        {canSwap && !noQuote && (
          <View style={styles.slippageContainer}>
            <BridgeSlippage
              value={slippage}
              displaySlippage={displaySlippage}
              onChange={setSlippage}
              autoSlippage={autoSlippage}
              isCustomSlippage={isCustomSlippage}
              setAutoSlippage={setAutoSlippage}
              setIsCustomSlippage={setIsCustomSlippage}
              type="swap"
              loading={isQuoteLoading}
            />
          </View>
        )}
        {canSwap &&
          !noQuote &&
          priceImpactData.showWarning &&
          !isQuoteLoading && (
            <View style={styles.priceImpactContainer}>
              <View style={styles.priceImpactRow}>
                <Text style={styles.priceImpactText}>
                  {t('page.bridge.price-impact')}
                </Text>
                <View style={styles.priceImpactDiffBox}>
                  <Text style={styles.priceImpactLossAmount}>
                    {(priceImpactData.lostValue * 100).toFixed(1)}%
                  </Text>
                  <RcIconBluePolygon color={colors2024['orange-default']} />
                </View>
              </View>

              <WarningText>
                <Text>
                  {t('page.Lending.debtSwap.priceImpactTips', {
                    lostValue: `${(priceImpactData.lostValue * 100).toFixed(
                      1,
                    )}%`,
                  })}
                </Text>
              </WarningText>
            </View>
          )}
        {canShowDirectSubmit && canSwap && (
          <View style={styles.gasPreContainer}>
            <DirectSignGasInfo
              supportDirectSign={true}
              loading={false}
              openShowMore={noop}
              chainServeId={chainInfo?.serverId || ''}
            />
          </View>
        )}
        {noQuote && !isQuoteLoading ? null : (
          <DebtSwapModalOverview
            fromToken={fromToken}
            toToken={toToken}
            chainEnum={chainEnum}
            fromAmount={debouncedFromAmount}
            currentToAmount={toDisplayReserve?.variableBorrows || '0'}
            toAmount={toAmountAfterSlippage}
            fromBalanceBn={fromBalanceBn.toString()}
            isQuoteLoading={isQuoteLoading}
            currentHF={currentHF}
            afterHF={afterSwapInfo?.hfAfterSwap.toString()}
            showHF={isHFLow || isLiquidatable}
          />
        )}
      </BottomSheetScrollView>

      <View
        style={[
          styles.buttonContainer,
          {
            height:
              BOTTOM_SIZE.BUTTON +
              (isLiquidatable
                ? BOTTOM_SIZE.TIPS
                : isRisky
                ? BOTTOM_SIZE.CHECKBOX
                : 0),
          },
        ]}>
        {isLiquidatable ? (
          <View style={styles.riskContainer}>
            <Text style={styles.dangerWarningText}>
              {t('page.Lending.debtSwap.lpDangerWarning')}
            </Text>
          </View>
        ) : isRisky ? (
          <Pressable
            style={styles.riskContainer}
            onPress={() => {
              setRiskChecked(!riskChecked);
            }}>
            <CheckBoxRect checked={riskChecked} size={16} />
            <Text style={styles.warningText}>{riskDesc}</Text>
          </Pressable>
        ) : null}
        {canShowDirectSubmit ? (
          <DirectSignBtn
            loading={isLoading}
            loadingType="circle"
            key={`${fromToken.underlyingAddress}-${toToken?.underlyingAddress}-${debouncedFromAmount}`}
            showTextOnLoading
            wrapperStyle={styles.directSignBtn}
            authTitle={t('page.Lending.debtSwap.button.swap')}
            title={t('page.Lending.debtSwap.button.swap')}
            onFinished={() => handleSwap()}
            disabled={buttonDisabled || !!ctx?.disabledProcess}
            type="primary"
            syncUnlockTime
            account={currentAccount}
            showHardWalletProcess
          />
        ) : (
          <Button
            loadingType="circle"
            showTextOnLoading
            containerStyle={styles.fullWidthButton}
            onPress={() => handleSwap()}
            title={t('page.Lending.debtSwap.button.swap')}
            loading={isLoading}
            disabled={buttonDisabled}
          />
        )}
      </View>
    </AutoLockView>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    height: '100%',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  scrollableBlock: {
    flex: 1,
    height: '100%',
  },
  contentContainer: {
    paddingHorizontal: 25,
    paddingBottom: 300,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    marginBottom: 12,
    paddingLeft: 4,
  },
  content: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 16,
    paddingVertical: 20,
  },
  slippageContainer: {
    paddingHorizontal: 8,
    marginBottom: 8,
    marginTop: 10,
  },
  tokenContainer: {
    borderRadius: 16,
    padding: 16,
    paddingVertical: 0,
  },
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderValue: {
    width: 40,
    textAlign: 'right',
    color: colors2024['brand-default'],
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'SF Pro',
  },
  tokenBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    //flex: 1,
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 100,
    paddingHorizontal: 4,
    height: 34,
    paddingRight: 8,
    width: 'auto',
  },
  maxButtonWrapper: {
    marginLeft: 8,
    padding: 4,
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 8,
  },
  maxButtonText: {
    color: colors2024['brand-default'],
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
  },
  divider: {
    height: 24,
    width: 1,
    backgroundColor: colors2024['neutral-line'],
    marginHorizontal: 8,
  },
  placeholderTokenInfo: {
    paddingLeft: 12,
  },
  tokenDetails: {
    flexShrink: 0,
  },
  tokenSymbol: {
    fontSize: 16,
    lineHeight: 20,
    maxWidth: 100,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  selectTokenText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
  amountInput: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'left',
    minWidth: 100,
    flex: 1,
  },
  amountDisplay: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
    textAlign: 'left',
    flex: 1,
  },
  amountDisplayPlaceholder: {
    color: colors2024['neutral-info'],
  },
  usdValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  usdValue: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
  dividerContainer: {
    position: 'relative',
    alignItems: 'center',
    marginTop: -6.5,
    marginBottom: -6.5,
  },
  dividerLine: {
    position: 'absolute',
    top: 22.5,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors2024['neutral-line'],
  },
  arrowContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: colors2024['neutral-bg-1'],
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  arrowWrapper: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -45 / 2 }, { translateY: -45 / 2 }],
  },
  arrowText: {
    fontSize: 22,
    color: colors2024['neutral-secondary'],
  },
  gasPreContainer: {
    paddingHorizontal: 8,
    marginTop: 12,
    width: '100%',
  },
  buttonContainer: {
    position: 'absolute',
    paddingHorizontal: 25,
    bottom: 0,
    height: 116,
    paddingTop: 12,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  directSignBtn: {
    width: '100%',
  },
  fullWidthButton: {
    flex: 1,
  },
  loadingOpacity: {
    opacity: 0.5,
  },
  riskContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  warningText: {
    fontSize: 12,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  dangerWarningText: {
    fontSize: 12,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    color: colors2024['red-default'],
  },
  priceImpactContainer: {
    paddingHorizontal: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  priceImpactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceImpactText: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
  priceImpactDiffBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceImpactLossAmount: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: colors2024['orange-default'],
    marginRight: 4,
  },
  priceImpactTooltipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  errorText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['red-default'],
    marginTop: 8,
    paddingHorizontal: 8,
  },
}));
