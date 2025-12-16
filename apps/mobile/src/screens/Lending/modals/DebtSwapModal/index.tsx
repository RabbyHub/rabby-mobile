import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { last, noop } from 'lodash';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';
import { trigger } from 'react-native-haptic-feedback';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  constants,
  BigNumber as EthersBigNumber,
  PopulatedTransaction,
} from 'ethers';

import { Slider } from '@rneui/themed';
import { apiProvider } from '@/core/apis';
import { useTheme2024 } from '@/hooks/theme';
import { toast } from '@/components2024/Toast';
import { IS_ANDROID } from '@/core/native/utils';
import { Button } from '@/components2024/Button';
import { ChainId } from '@aave/contract-helpers';
import { useMiniSigner } from '@/hooks/useSigner';
import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';
import { OptimalRate, SwapSide } from '@paraswap/sdk';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { RcIconSwapBottomArrow } from '@/assets/icons/swap';
import { transactionHistoryService } from '@/core/services';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import { BubbleWithText } from '@/screens/Swap/components/Slider';
import RcIconWalletCC from '@/assets2024/icons/swap/wallet-cc.svg';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { ERC20Service } from '@aave/contract-helpers/dist/esm/erc20-contract';
import { DirectSignGasInfo } from '@/screens/Bridge/components/BridgeShowMore';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { BaseDebtToken } from '@aave/contract-helpers/dist/esm/baseDebtToken-contract';
import {
  formatSpeicalAmount,
  formatTokenAmount,
  formatUsdValue,
} from '@/utils/number';
import {
  MINI_SIGN_ERROR,
  useSignatureStore,
} from '@/components2024/MiniSignV2/state/SignatureManager';
import { DebtSwitchAdapterService } from '@aave/contract-helpers/dist/esm/paraswap-debtSwitch-contract';
import {
  CUSTOM_HISTORY_ACTION,
  CUSTOM_HISTORY_TITLE_TYPE,
} from '@/screens/Transaction/components/type';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';

import { SwapType } from '../../types/swap';
import DebtSwapModalOverview from './Overview';
import TokenIcon from '../../components/TokenIcon';
import { APP_CODE_LENDING_DEBT_SWAP } from '../../utils/constant';
import { ParaswapRatesType, SwappableToken } from '../../types/swap';
import { DEBT_SWAP_PARENT_ID, getParaswap } from '../../config/paraswap';
import { getParaswapSellRates } from '../../components/actions/DebtSwap/paraswap';
import {
  useLendingSummary,
  usePoolDataProviderContract,
  useSelectedMarket,
} from '../../hooks';

interface DebtSwapModalProps {
  fromToken: SwappableToken;
  onClose?: () => void;
}

const sliderHapticTriggerNumbers = [0, 50, 100];
const DEFAULT_DEBT_SWAP_SLIPPAGE = 200; // 2%
const ZERO_PERMIT = {
  value: '0',
  deadline: '0',
  v: 0,
  r: constants.HashZero,
  s: constants.HashZero,
};

const maxInputAmountWithSlippage = (amount: string, slippageBps: number) => {
  const amt = new BigNumber(amount || 0);
  if (amt.lte(0)) {
    return '0';
  }
  return amt
    .multipliedBy(new BigNumber(1).plus(new BigNumber(slippageBps).div(10000)))
    .integerValue(BigNumber.ROUND_CEIL)
    .toFixed(0);
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
  const [fromAmount, setFromAmount] = useState<string>('');
  const [debouncedFromAmount, setDebouncedFromAmount] = useState<string>('');
  const [toToken, setToToken] = useState<SwappableToken | undefined>();
  const [toAmount, setToAmount] = useState<string>('');
  const [slider, setSlider] = useState<number>(0);
  const previousSlider = useRef<number>(0);
  const { chainEnum, chainInfo, selectedMarketData } = useSelectedMarket();
  const { pools } = usePoolDataProviderContract();
  const { formattedPoolReservesAndIncentives } = useLendingSummary();
  const [isLoading, setIsLoading] = useState(false);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<ParaswapRatesType | null>(null);
  const [swapRate, setSwapRate] = useState<{
    optimalRateData?: OptimalRate;
    inputAmount?: string;
    outputAmount?: string;
    slippageBps?: number;
    maxInputAmountWithSlippage?: string;
  }>({});
  const lastQuoteParamsRef = useRef<{
    rawAmount: string;
    toToken?: string;
    srcAmount?: string;
  }>();
  const { ctx } = useSignatureStore();

  const fromBalanceBn = useMemo(() => {
    return new BigNumber(fromToken?.balance || 0);
  }, [fromToken]);

  const fromBalanceDisplay = useMemo(() => {
    return formatTokenAmount(fromBalanceBn.toString(10));
  }, [fromBalanceBn]);

  const fromUsdValue = useMemo(() => {
    const usdPrice = new BigNumber(fromToken?.usdPrice || 0);
    return formatUsdValue(
      new BigNumber(fromAmount || 0).times(usdPrice).toString(10),
    );
  }, [fromAmount, fromToken?.usdPrice]);

  const toUsdValue = useMemo(() => {
    if (!toToken) {
      return formatUsdValue(0);
    }
    const usdPrice = new BigNumber(toToken?.usdPrice || 0);
    return formatUsdValue(
      new BigNumber(toAmount || 0).times(usdPrice).toString(10),
    );
  }, [toAmount, toToken]);

  const fromReserve = useMemo(
    () =>
      formattedPoolReservesAndIncentives?.find(item =>
        isSameAddress(item.underlyingAsset, fromToken.underlyingAddress),
      ),
    [formattedPoolReservesAndIncentives, fromToken.underlyingAddress],
  );

  const toReserve = useMemo(
    () =>
      formattedPoolReservesAndIncentives?.find(item =>
        isSameAddress(
          item.underlyingAsset,
          toToken?.underlyingAddress || constants.AddressZero,
        ),
      ),
    [formattedPoolReservesAndIncentives, toToken?.underlyingAddress],
  );

  const isSameToken = useMemo(() => {
    if (!toToken) {
      return false;
    }
    return isSameAddress(
      toToken.underlyingAddress,
      fromToken.underlyingAddress,
    );
  }, [fromToken.underlyingAddress, toToken]);

  const handleSlider100 = useCallback(() => {
    setFromAmount(fromBalanceBn.toString(10));
  }, [fromBalanceBn]);

  const canShowDirectSubmit = useMemo(
    () => isAccountSupportMiniApproval(currentAccount?.type || ''),
    [currentAccount?.type],
  );

  const onChangeSlider = useCallback(
    (v: number) => {
      setSlider(v);

      if (
        v !== previousSlider.current &&
        sliderHapticTriggerNumbers.includes(v)
      ) {
        trigger('impactLight', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }

      previousSlider.current = v;

      if (v === 100) {
        handleSlider100();
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
    [fromBalanceBn, handleSlider100],
  );

  const showBubble = useSharedValue(false);
  const { width } = useWindowDimensions();

  const sliderStyle = useAnimatedStyle(
    () => ({
      opacity: showBubble.value ? 1 : 0,
      display: showBubble.value ? 'flex' : 'none',
      position: 'absolute',
      top: IS_ANDROID ? -72 : -60,
      left: 0,
      height: 70,
      width,
      transform: [
        {
          translateX: 0 - width / 2 + (IS_ANDROID ? 7 : 6),
        },
      ],
    }),
    [width],
  );

  const onInputChange = useCallback(
    (text: string) => {
      const formatted = formatSpeicalAmount(text);
      if (!/^\d*(\.\d*)?$/.test(formatted)) {
        return;
      }
      const amountBn = new BigNumber(formatted || 0);
      const safeAmountBn = amountBn.gt(fromBalanceBn)
        ? fromBalanceBn
        : amountBn;
      const safeAmountStr = safeAmountBn.toString(10);
      setFromAmount(safeAmountStr);

      const percentage = fromBalanceBn.gt(0)
        ? safeAmountBn.div(fromBalanceBn).times(100).toNumber()
        : 0;
      const clampedPercentage = Math.min(100, Math.max(0, percentage));
      setSlider(Math.round(clampedPercentage));
    },
    [fromBalanceBn],
  );

  useEffect(() => {
    const _t = setTimeout(() => {
      setDebouncedFromAmount(fromAmount);
    }, 400);
    return () => clearTimeout(_t);
  }, [fromAmount]);

  useEffect(() => {
    let cancelled = false;
    const fetchQuote = async () => {
      const resetQuote = () => {
        setToAmount('');
        setQuote(null);
        setSwapRate({});
        setIsQuoteLoading(false);
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
        const rawAmount = amountBn
          .times(new BigNumber(10).pow(fromToken.decimals))
          .integerValue(BigNumber.ROUND_DOWN)
          .toString(10);

        const quoteRes = await getParaswapSellRates({
          swapType: SwapType.DebtSwap,
          side: 'buy',
          invertedQuoteRoute: true,
          amount: rawAmount,
          srcToken: toToken.addressToSwap,
          srcDecimals: toToken.decimals,
          destToken: fromToken.addressToSwap,
          destDecimals: fromToken.decimals,
          chainId: fromToken.chainId,
          user: currentAccount.address,
          options: {},
          appCode: APP_CODE_LENDING_DEBT_SWAP,
        });
        if (cancelled || !quoteRes) {
          return;
        }
        const slippageRaw =
          quoteRes.suggestedSlippage ?? DEFAULT_DEBT_SWAP_SLIPPAGE;
        const slippageBps =
          slippageRaw > 50 ? slippageRaw : Math.round(slippageRaw * 100);
        const priceRoute = quoteRes.optimalRateData;
        const destAmount = new BigNumber(quoteRes.destSpotAmount)
          .div(new BigNumber(10).pow(quoteRes.destDecimals))
          .toString(10);
        lastQuoteParamsRef.current = {
          rawAmount,
          toToken: toToken.addressToSwap,
          srcAmount: quoteRes.destSpotAmount,
        };
        setQuote(quoteRes);
        setSwapRate({
          optimalRateData: priceRoute,
          inputAmount: quoteRes.destSpotAmount,
          outputAmount: rawAmount,
          slippageBps,
          maxInputAmountWithSlippage: maxInputAmountWithSlippage(
            quoteRes.destSpotAmount,
            slippageBps,
          ),
        });
        setToAmount(destAmount);
      } catch (e) {
        if (!cancelled) {
          setToAmount('');
          setQuote(null);
          setSwapRate({});
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
  ]);

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
          setDebouncedFromAmount(fromAmount);
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

    const rawAmount = new BigNumber(fromAmount || 0)
      .times(new BigNumber(10).pow(fromToken.decimals))
      .integerValue(BigNumber.ROUND_DOWN)
      .toString(10);

    if (
      !lastQuoteParamsRef.current ||
      lastQuoteParamsRef.current.rawAmount !== rawAmount ||
      lastQuoteParamsRef.current.toToken !== toToken.addressToSwap
    ) {
      throw new Error('quote-outdated');
    }

    const { paraswap, feeTarget } = getParaswap(fromToken.chainId as ChainId);
    const kind =
      swapRate.optimalRateData.side === SwapSide.BUY ? 'buy' : 'sell';
    const slippageBps = swapRate.slippageBps ?? DEFAULT_DEBT_SWAP_SLIPPAGE;
    const txParams: any = await paraswap.buildTx(
      {
        srcToken: toToken.addressToSwap,
        destToken: fromToken.addressToSwap,
        srcDecimals: toToken.decimals,
        destDecimals: fromToken.decimals,
        srcAmount:
          kind === 'sell'
            ? swapRate.inputAmount || swapRate.optimalRateData.srcAmount
            : undefined,
        destAmount: kind === 'buy' ? rawAmount : undefined,
        userAddress: currentAccount.address,
        priceRoute: swapRate.optimalRateData,
        partner: DEBT_SWAP_PARENT_ID,
        partnerAddress: feeTarget,
        receiver: selectedMarketData.addresses.DEBT_SWITCH_ADAPTER,
        slippage: slippageBps,
        isDirectFeeTransfer: true,
        takeSurplus: true,
      } as any,
      {
        ignoreChecks: true,
      } as any,
    );

    const swapCallData = txParams.data;
    const augustus = txParams.to;
    const maxNewDebtAmount =
      swapRate.maxInputAmountWithSlippage ||
      swapRate.inputAmount ||
      swapRate.optimalRateData.srcAmount ||
      '0';
    const isMaxSelected = new BigNumber(fromAmount || 0).gte(fromBalanceBn);

    const debtSwitchService = new DebtSwitchAdapterService(
      pools.provider,
      selectedMarketData.addresses.DEBT_SWITCH_ADAPTER,
    );

    const debtSwitchTx = debtSwitchService.debtSwitch({
      user: currentAccount.address,
      debtAssetUnderlying: fromToken.underlyingAddress,
      debtRepayAmount: rawAmount,
      debtRateMode: 2,
      newAssetDebtToken: toReserve.variableDebtTokenAddress,
      newAssetUnderlying: toToken.underlyingAddress,
      maxNewDebtAmount,
      extraCollateralAsset: constants.AddressZero,
      extraCollateralAmount: '0',
      repayAll: isMaxSelected,
      txCalldata: swapCallData,
      augustus,
      creditDelegationPermit: ZERO_PERMIT,
      collateralPermit: ZERO_PERMIT,
    });

    const erc20Service = new ERC20Service(pools.provider);
    const baseDebtService = new BaseDebtToken(pools.provider, erc20Service);
    let delegationTx: PopulatedTransaction | undefined;
    if (toReserve.variableDebtTokenAddress) {
      delegationTx = baseDebtService.generateApproveDelegationTxData({
        user: currentAccount.address,
        delegatee: selectedMarketData.addresses.DEBT_SWITCH_ADAPTER,
        debtTokenAddress: toReserve.variableDebtTokenAddress,
        amount: maxNewDebtAmount,
      });
    }

    const txs: Tx[] = [];
    if (delegationTx?.data) {
      const formattedDelegationTx: any = {
        from: (delegationTx as any).from || currentAccount.address,
        to: (delegationTx as any).to,
        data: (delegationTx as any).data || '0x',
        value:
          (delegationTx as any).value &&
          EthersBigNumber.isBigNumber((delegationTx as any).value)
            ? (delegationTx as any).value.toHexString()
            : (delegationTx as any).value ?? '0x0',
        chainId: fromToken.chainId,
      };
      if ((delegationTx as any).nonce) {
        formattedDelegationTx.nonce = (delegationTx as any).nonce;
      }
      txs.push(formattedDelegationTx as Tx);
    }
    const formattedDebtSwitchTx: any = {
      from: (debtSwitchTx as any).from || currentAccount.address,
      to: (debtSwitchTx as any).to,
      data: (debtSwitchTx as any).data || '0x',
      value:
        (debtSwitchTx as any).value &&
        EthersBigNumber.isBigNumber((debtSwitchTx as any).value)
          ? (debtSwitchTx as any).value.toHexString()
          : (debtSwitchTx as any).value ?? '0x0',
      chainId: fromToken.chainId,
    };
    if ((debtSwitchTx as any).nonce) {
      formattedDebtSwitchTx.nonce = (debtSwitchTx as any).nonce;
    }
    txs.push(formattedDebtSwitchTx as Tx);
    console.log('CUSTOM_LOGGER:=>: txs', txs);
    return txs;
  }, [
    currentAccount,
    fromAmount,
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
    if (currentAccount && canShowDirectSubmit) {
      prefetchMiniSigner({
        buildTxs: buildDebtSwapTxs,
        synGasHeaderInfo: true,
      });
    }
  }, [
    buildDebtSwapTxs,
    canShowDirectSubmit,
    currentAccount,
    prefetchMiniSigner,
  ]);

  const handleSwap = useCallback(
    async (p?: { ignoreGasFee?: boolean; forceFullSign?: boolean }) => {
      if (!toToken || !fromAmount || !currentAccount) {
        return;
      }

      try {
        setIsLoading(true);
        let txs: Tx[] = [];
        try {
          txs = await buildDebtSwapTxs();
        } catch (error: any) {
          if (error?.message === 'quote-outdated') {
            toast.info('quote outdated, please retry');
            return;
          }
          throw error;
        }

        if (!txs.length) {
          toast.info('please retry');
          return;
        }

        let results: string[] = [];
        if (canShowDirectSubmit && !p?.forceFullSign) {
          try {
            results = await openDirect({
              txs,
              ga: {
                customAction: CUSTOM_HISTORY_ACTION.LENDING,
                customActionTitleType:
                  CUSTOM_HISTORY_TITLE_TYPE.LENDING_DEBT_SWAP,
              },
              checkGasFeeTooHigh: ctx?.gasFeeTooHigh,
              ignoreGasFeeTooHigh: p?.ignoreGasFee,
            });
          } catch (error) {
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
          for (const tx of txs) {
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
      buildDebtSwapTxs,
      openDirect,
      ctx?.gasFeeTooHigh,
    ],
  );

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
                <Slider
                  key={`${fromToken?.underlyingAddress}`}
                  allowTouchTrack={true}
                  style={styles.slider}
                  value={slider}
                  onSlidingStart={() => {
                    showBubble.value = true;
                  }}
                  onValueChange={onChangeSlider}
                  onSlidingComplete={v => {
                    showBubble.value = false;
                    onChangeSlider(v);
                  }}
                  minimumValue={0}
                  maximumValue={100}
                  minimumTrackTintColor={colors2024['brand-default']}
                  maximumTrackTintColor={colors2024['neutral-line']}
                  step={1}
                  thumbStyle={styles.thumbStyle}
                  thumbProps={{
                    children: (
                      <View>
                        <View
                          style={[styles.outerThumb, styles.outerThumbWrapper]}>
                          <View style={styles.innerThumb} />
                          <Animated.View style={sliderStyle}>
                            <BubbleWithText slide={slider || 0} />
                          </Animated.View>
                        </View>
                      </View>
                    ),
                  }}
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
              <Text style={styles.arrowText}>↓</Text>
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
                    {formatTokenAmount(toToken.balance)}
                  </Text>
                </View>
              </View>
            )}
          </Pressable>
        </View>
        <DebtSwapModalOverview
          fromToken={fromToken}
          toToken={toToken}
          chainEnum={chainEnum}
          fromAmount={fromAmount}
          toAmount={toAmount}
          fromBalanceBn={fromBalanceBn}
          isQuoteLoading={isQuoteLoading}
        />
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
      </BottomSheetScrollView>

      <View style={[styles.buttonContainer]}>
        {canShowDirectSubmit ? (
          <DirectSignBtn
            loading={isLoading}
            loadingType="circle"
            key={`${fromToken.underlyingAddress}-${toToken?.underlyingAddress}`}
            showTextOnLoading
            wrapperStyle={styles.directSignBtn}
            authTitle={t('page.Lending.debtSwap.button.swap')}
            title={t('page.Lending.debtSwap.button.swap')}
            onFinished={() => handleSwap()}
            disabled={!canSwap}
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
            disabled={!canSwap}
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
  slider: {
    width: 126,
    height: 4,
  },
  sliderValue: {
    width: 40,
    textAlign: 'right',
    color: colors2024['brand-default'],
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'SF Pro',
  },
  thumbStyle: {
    backgroundColor: colors2024['brand-default'],
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  outerThumbWrapper: {
    position: 'relative',
  },
  outerThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors2024['brand-default'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerThumb: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors2024['neutral-bg-1'],
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
}));
