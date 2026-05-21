import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RabbyFeePopup } from '@/components/RabbyFeePopup';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { DEX_WITH_WRAP, getChainDefaultToken } from '@/constant/swap';
import {
  preferenceService,
  swapService,
  transactionHistoryService,
} from '@/core/services';
import { useTheme2024 } from '@/hooks/theme';
import {
  getMarketTabActionPrefix,
  getMarketTabCreateSwapTxAction,
} from '@/screens/Market/analytics';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { DEX_ENUM, DEX_SPENDER_WHITELIST } from '@rabby-wallet/rabby-swap';
import {
  CompositeScreenProps,
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useMemoizedFn, useRequest } from 'ahooks';
import BigNumber from 'bignumber.js';
import { useAtomValue, useSetAtom } from 'jotai';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import useMount from 'react-use/lib/useMount';
import { ChainInfo2024 } from '../Send/components/ChainInfo2024';
import { SwapHeader } from '../Swap/components/Header';
import { LowCreditModal } from '../Swap/components/LowCreditModal';
import { QuoteList } from '../Swap/components/Quotes';
import { TwpStepApproveModal } from '../Swap/components/TwoStepApproveModal';
import {
  useDetectLoss,
  usePollSwapPendingNumber,
  useSlippageStore,
  useSwapUnlimitedAllowance,
  useTokenPair,
} from '../Swap/hooks';
import { refreshIdAtom, useRabbyFeeVisible } from '../Swap/hooks/atom';
import { buildDexSwap, dexSwap } from '../Swap/hooks/swap';
import { Button } from '@/components2024/Button';
import {
  PropsForAccountSwitchScreen,
  ScreenSceneAccountProvider,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { SwapTokenItem } from '../Swap/components/Token';
import BridgeSwitchBtn from '../Bridge/components/BridgeSwitchBtn';
import BridgeShowMore from '../Bridge/components/BridgeShowMore';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { useSwapRecentToTokens } from '../Swap/hooks/recent';
import { useSwitchSceneAccountOnSelectedTokenWithOwner } from '@/databases/hooks/token';
import {
  GetNestedScreenRouteProp,
  RootStackParamsList,
  TransactionNavigatorParamList,
} from '@/navigation-type';
import { TokenInfoPopup } from '../Swap/components/TokenInfoPopup';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import {
  ExternalSwapBridgeDappTips,
  SwapBridgeDappPopup,
} from '@/components/ExternalSwapBridgeDappPopup';
import { useExternalSwapBridgeDapps } from '@/components/ExternalSwapBridgeDappPopup/hook';
import { Tip } from '@/components';
import { useMiniSigner } from '@/hooks/useSigner';
import { isAccountSupportMiniApproval } from '@/utils/account';
import {
  ApprovePendingTxItem,
  PendingTxItem,
} from '../Swap/components/PendingTxItem';
import { toast } from '@/components2024/Toast';
import { last } from 'lodash';
import { SwapTxHistoryItem } from '@/core/services/transactionHistory';
import { matomoRequestEvent } from '@/utils/analytics';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useTwoStepSwap } from '../Swap/hooks/twoStepSwap';
import {
  DirectSignBtn,
  DirectSignBtnMethods,
} from '@/components2024/DirectSignBtn';
import useDebounce from 'react-use/lib/useDebounce';
import { MINI_SIGN_ERROR } from '@/components2024/MiniSignV2/state/SignatureManager';
import { SignatureInstanceProvider } from '@/components2024/MiniSignV2/state/SignatureInstanceContext';
import { useSignatureStoreOf } from '@/components2024/MiniSignV2/state/useSignatureStore';
import { BridgeSlippage } from '../Bridge/components/BridgeSlippage';
import { MarketClosedTip } from '@/components/Token/MarketClosedTip';
import { APP_VERSIONS } from '@/constant';
import { stats } from '@/utils/stats';
import { Text } from '@/components/Typography';
import { storeApiExpSettingData } from '@/hooks/appSettings';
import {
  FormAmountMode,
  FormValuesOnSubmit,
  createAmountComparer,
  shouldIgnoreAmountChangeInMaxMode,
} from '@/utils/form';
import { useMiniSignerEffectPause } from '@/hooks/useMiniSignerEffectPause';
import {
  hasQuotePollingPauseReason,
  type QuotePollingPauseReasonState,
  updateQuotePollingPauseReason,
} from '@/utils/quotePolling';
import ArrowDownSVG from '@/assets/icons/swap/icon-arrow-down-with-bg.svg';

const isAndroid = Platform.OS === 'android';
const BOTTOM_BUTTON_HEIGHT = 58;
const BOTTOM_BUTTON_TITLE_FONT_SIZE = 18;
const BOTTOM_BUTTON_HORIZONTAL_PADDING = 20;
const BOTTOM_BUTTON_BOTTOM_OFFSET = 36;

type SwapRouteProps = CompositeScreenProps<
  NativeStackScreenProps<
    TransactionNavigatorParamList,
    typeof RootNames.SwapBridge
  >,
  NativeStackScreenProps<RootStackParamsList>
>;

type SwapProps = PropsForAccountSwitchScreen<{
  disableHeaderRight?: boolean;
  disableAccountSwitcherModal?: boolean;
}>;

const Swap = ({
  isForMultipleAddress = false,
  disableHeaderRight = false,
  disableAccountSwitcherModal = false,
}: SwapProps) => {
  /** Swap form snapshot for validation during auth */
  interface SwapFormSnapshot {
    amount: string;
    amountMode?: FormAmountMode;
  }

  // Form values snapshot for validation before auth submission
  const formValuesRef = useRef(
    new FormValuesOnSubmit<SwapFormSnapshot>({
      comparers: {
        amount: createAmountComparer(),
      },
    }),
  );

  const { switchAccountOnSelectedToken } =
    useSwitchSceneAccountOnSelectedTokenWithOwner('MakeTransactionAbout');

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  const { t } = useTranslation();
  const keyboardAwareRef = useRef<KeyboardAwareScrollView>(null);

  const { colors2024, styles } = useTheme2024({ getStyle });

  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const {
    runAsync: runFetchSwapPendingCount,
    localPendingTxData,
    clearLocalPendingTxData,
    runFetchLocalPendingTx,
    clearSwapHistoryRedDot,
  } = usePollSwapPendingNumber(5000);

  const headerRight = useCallback(
    () => (
      <SwapHeader
        isForMultipleAddress={isForMultipleAddress}
        clearSwapHistoryRedDot={clearSwapHistoryRedDot}
      />
    ),
    [isForMultipleAddress, clearSwapHistoryRedDot],
  );
  useEffect(() => {
    if (disableHeaderRight) {
      return;
    }
    setNavigationOptions({
      headerRight,
    });
  }, [disableHeaderRight, headerRight, setNavigationOptions]);

  const [twoStepApproveModalVisible, setTwoStepApproveModalVisible] =
    useState(false);

  const [unlimitedAllowance] = useSwapUnlimitedAllowance();

  const userAddress = currentAccount?.address;

  const {
    bestQuoteDex,
    chain,
    switchChain,
    switchSwapAgain,

    payToken,
    setPayToken,
    receiveToken,
    setReceiveToken,
    exchangeToken,

    handleAmountChange,
    payAmount,
    isWrapToken,
    inSufficient,
    slippageChanged,
    slippageState,
    slippage: _slippage,
    setSlippage,
    payTokenIsNativeToken,
    isSlippageHigh,
    isSlippageLow,

    feeRate,

    openQuotesList,
    closeQuotesList,
    quotesListVisible,
    quoteLoading,
    quoteList,

    currentProvider: activeProvider,
    setActiveProvider,
    slippageValidInfo,

    gasList,
    passGasPrice,
    slider,
    onChangeSlider,

    showMoreVisible,

    lowCreditToken: _lowCreditToken,
    lowCreditVisible,
    setLowCreditToken,
    setLowCreditVisible,

    swapUseSlider,
    clearExpiredTimer,
    setAutoQuoteRefreshPaused,
    setReloadTxRefreshPaused,
    finishedQuotes,
    inSufficientCanGetQuote,
    quoteBlockedByClosedMarket,

    autoSuggestSlippage,
  } = useTokenPair({
    account: currentAccount!,
  });
  const quotePollingPauseReasonsRef = useRef<QuotePollingPauseReasonState>({});
  const setQuotePollingPauseReason = useCallback(
    (reason: string, paused: boolean) => {
      const wasPaused = hasQuotePollingPauseReason(
        quotePollingPauseReasonsRef.current,
      );

      quotePollingPauseReasonsRef.current = updateQuotePollingPauseReason({
        state: quotePollingPauseReasonsRef.current,
        reason,
        paused,
      });

      const isPaused = hasQuotePollingPauseReason(
        quotePollingPauseReasonsRef.current,
      );

      if (wasPaused !== isPaused) {
        setAutoQuoteRefreshPaused(isPaused);
      }
    },
    [setAutoQuoteRefreshPaused],
  );
  const setSlippageOptionsQuoteRefreshPaused = useCallback(
    (paused: boolean) => {
      setQuotePollingPauseReason('slippage-options', paused);
    },
    [setQuotePollingPauseReason],
  );
  const setGasSettingsQuoteRefreshPaused = useCallback(
    (paused: boolean) => {
      setQuotePollingPauseReason('gas-settings', paused);
    },
    [setQuotePollingPauseReason],
  );
  const setDepositQuoteRefreshPaused = useCallback(
    (paused: boolean) => {
      setQuotePollingPauseReason('gas-account-deposit', paused);
    },
    [setQuotePollingPauseReason],
  );

  const chainServerId = useMemo(() => {
    return findChainByEnum(chain)?.serverId || CHAINS[chain].serverId;
  }, [chain]);

  const {
    autoSlippage,
    isCustomSlippage,
    setAutoSlippage,
    setIsCustomSlippage,
  } = useSlippageStore();

  const slippage = useMemo(
    () => (autoSlippage ? autoSuggestSlippage : _slippage),
    [_slippage, autoSlippage, autoSuggestSlippage],
  );

  const {
    isSupportedChain,
    data: externalDapps,
    openTab: _openTab,
  } = useExternalSwapBridgeDapps(chain, 'swap');
  const openTab = useMemoizedFn((url: string) => {
    _openTab(url);
    const origin = safeGetOrigin(url);
    if (origin) {
      matomoRequestEvent({
        category: 'Websites Usage',
        action: 'Website_Visit_Other',
        label: origin,
      });
    }
  });
  const [swapDappOpen, setSwapDappOpen] = useState(false);

  const refresh = useSetAtom(refreshIdAtom);
  const refreshId = useAtomValue(refreshIdAtom);

  const [
    { visible: isShowRabbyFeePopup, dexName, dexFeeDesc },
    setIsShowRabbyFeePopup,
  ] = useRabbyFeeVisible();

  const showMEVGuardedSwitch = useMemo(
    () => chain === CHAINS_ENUM.ETH,
    [chain],
  );

  const switchPreferMEV = useMemoizedFn((bool: boolean) => {
    swapService.setSwapPreferMEVGuarded(bool);
    mutatePreferMEVGuarded(bool);
  });

  const { data: originPreferMEVGuarded, mutate: mutatePreferMEVGuarded } =
    useRequest(async () => {
      return swapService.getSwapPreferMEVGuarded();
    });

  const preferMEVGuarded = useMemo(
    () => (chain === CHAINS_ENUM.ETH ? originPreferMEVGuarded : false),
    [chain, originPreferMEVGuarded],
  );
  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        typeof RootNames.SwapBridge | typeof RootNames.MultiSwapBridge
      >
    >();
  const navState = route.params;

  useMount(() => {
    preferenceService.setReportActionTs(
      REPORT_TIMEOUT_ACTION_KEY.CLICK_GO_SWAP_SERVICE,
    );

    if (!navState?.chainEnum) {
      return;
    }

    const chainItem = findChainByEnum(navState?.chainEnum, { fallback: true });

    if (navState.swapAgain) {
      switchSwapAgain(
        chainItem?.enum || CHAINS_ENUM.ETH,
        navState?.swapTokenId?.[0]!,
        navState?.swapTokenId?.[1]!,
      );
      return;
    }
  });

  const navigation = useNavigation<SwapRouteProps['navigation']>();

  const {
    prefetch: prefetchMiniSigner,
    openDirect,
    close: closeMiniSigner,
    instance,
  } = useMiniSigner({
    account: currentAccount!,
    chainServerId,
    autoResetGasStoreOnChainChange: true,
  });

  const { ctx } = useSignatureStoreOf(instance);

  const miniSignGasFeeTooHigh = !!ctx?.gasFeeTooHigh;
  const canDirectSign = !ctx?.disabledProcess;

  const miniSignGa = useMemo(
    () => ({
      category: 'Swap',
      source: 'swap',
      swapUseSlider,
    }),
    [swapUseSlider],
  );

  useEffect(() => {
    const chainItem = findChainByEnum(navState?.chainEnum, { fallback: true });
    const isBuy = navState?.type === 'Buy';

    if (navState?.isFromSwap) {
      if (navState?.tokenId && chainItem?.enum === chain) {
        if (
          (payToken && payToken.chain !== chainItem.serverId) ||
          (receiveToken && receiveToken.chain !== chainItem.serverId)
        ) {
          switchChain(chainItem?.enum || CHAINS_ENUM.ETH, {
            payTokenId: navState?.tokenId,
            changeTo: isBuy,
          });
          return;
        }
        if (isBuy) {
          setReceiveToken({
            ...getChainDefaultToken(chainItem?.enum || CHAINS_ENUM.ETH),
            id: navState?.tokenId,
          });
        } else {
          setPayToken({
            ...getChainDefaultToken(chainItem?.enum || CHAINS_ENUM.ETH),
            id: navState?.tokenId,
          });
        }
        return;
      }
    } else {
      if (navState?.tokenId) {
        switchChain(chainItem?.enum || CHAINS_ENUM.ETH, {
          payTokenId: navState?.tokenId,
          changeTo: isBuy,
          payUseBaseToken: navState?.isFromCopyTrading,
        });
      }
    }
    navigation.setParams({
      ...navState,
      isSwapToTokenDetail: false,
      isFromSwap: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    navState?.chainEnum,
    navState?.isSwapToTokenDetail,
    navState?.tokenId,
    navState?.type,
  ]);

  const { safeOffBottom } = useSafeSizes();

  const currentIsCopyTrading = useMemo(() => {
    if (navState?.type === 'Sell') {
      return (
        navState?.isFromCopyTrading &&
        payToken?.id === navState?.tokenId &&
        chain === navState.chainEnum
      );
    }

    return (
      navState?.isFromCopyTrading &&
      receiveToken?.id === navState?.tokenId &&
      chain === navState.chainEnum
    );
  }, [navState, receiveToken?.id, chain, payToken?.id]);

  const gotoSwap = useMemoizedFn(async () => {
    if (!inSufficient && payToken && receiveToken && activeProvider?.quote) {
      try {
        setReloadTxRefreshPaused(true);
        const receive_token_amount = new BigNumber(
          activeProvider?.quote.toTokenAmount,
        )
          .div(
            10 **
              (activeProvider?.quote.toTokenDecimals || receiveToken.decimals),
          )
          .toNumber();
        const payTokenUsdValue =
          typeof payAmount === 'string' && payToken?.price
            ? (Number(payAmount || 0) * Number(payToken.price || 0)).toString()
            : '';
        const addSwapTxHistoryObj = {
          chainId: findChainByEnum(chain)?.id || 0,
          address: currentAccount?.address!,
          fromToken: payToken,
          toToken: receiveToken,
          slippage: new BigNumber(slippage).div(100).toNumber(),
          fromAmount: Number(payAmount),
          toAmount: receive_token_amount,
          dexId: activeProvider?.name || 'WrapToken',
          createdAt: Date.now(),
          status: 'pending' as SwapTxHistoryItem['status'],
          isFromCopyTrading: currentIsCopyTrading,
          copyTradingExtra: {
            type: navState?.type || 'Buy',
          },
        };
        await dexSwap(
          {
            swapPreferMEVGuarded: !!preferMEVGuarded,
            chain,
            quote: activeProvider?.quote,
            needApprove: activeProvider.shouldApproveToken,
            spender:
              activeProvider?.name === DEX_ENUM.WRAPTOKEN
                ? ''
                : DEX_SPENDER_WHITELIST[activeProvider.name][chain],
            pay_token_id: payToken.id,
            unlimited: unlimitedAllowance,
            shouldTwoStepApprove: activeProvider.shouldTwoStepApprove,
            gasPrice:
              payTokenIsNativeToken && passGasPrice
                ? gasList?.find(e => e.level === 'normal')?.price
                : undefined,
            postSwapParams: {
              quote: {
                pay_token_id: payToken.id,
                pay_token_amount: Number(payAmount),
                receive_token_id: receiveToken!.id,
                receive_token_amount: receive_token_amount,
                slippage: new BigNumber(slippage).div(100).toNumber(),
              },
              dex_id: activeProvider?.name || 'WrapToken',
            },
            account: currentAccount!,
            from: navState?.from,
            payUsdValue: payTokenUsdValue || '',
            dexId: activeProvider?.name || '',
          },
          {
            ga: {
              category: 'Swap',
              source: 'swap',
              trigger: 'home',
              swapUseSlider,
            },
          },
          addSwapTxHistoryObj,
        );
        handleAmountChange('');
        runFetchLocalPendingTx();
        setTimeout(() => {
          runFetchSwapPendingCount();
        }, 500);
      } catch (error) {
        console.error(error);
      } finally {
        setReloadTxRefreshPaused(false);
        refresh(e => e + 1);
      }
    }
  });

  const buildSwapTxs = useMemoizedFn(async () => {
    if (!inSufficient && payToken && receiveToken && activeProvider?.quote) {
      try {
        return buildDexSwap(
          {
            swapPreferMEVGuarded: !!preferMEVGuarded,
            chain,
            quote: activeProvider?.quote,
            needApprove: activeProvider.shouldApproveToken,
            spender:
              activeProvider?.name === DEX_ENUM.WRAPTOKEN
                ? ''
                : DEX_SPENDER_WHITELIST[activeProvider.name][chain],
            pay_token_id: payToken.id,
            unlimited: unlimitedAllowance,
            shouldTwoStepApprove: activeProvider.shouldTwoStepApprove,
            gasPrice:
              payTokenIsNativeToken && passGasPrice
                ? gasList?.find(e => e.level === 'normal')?.price
                : undefined,
            postSwapParams: {
              quote: {
                pay_token_id: payToken.id,
                pay_token_amount: Number(payAmount),
                receive_token_id: receiveToken!.id,
                receive_token_amount: new BigNumber(
                  activeProvider?.quote.toTokenAmount,
                )
                  .div(
                    10 **
                      (activeProvider?.quote.toTokenDecimals ||
                        receiveToken.decimals),
                  )
                  .toNumber(),
                slippage: new BigNumber(slippage).div(100).toNumber(),
              },
              dex_id: activeProvider?.name || 'WrapToken',
            },
            account: currentAccount!,
          },
          {
            ga: {
              category: 'Swap',
              source: 'swap',
              trigger: 'home',
              swapUseSlider,
            },
          },
        );
      } catch (error) {
        console.error(error);
      }
    }
  });

  const {
    data: txs,
    runAsync: runBuildSwapTxs,
    mutate: mutateTxs,
  } = useRequest(buildSwapTxs, {
    manual: true,
  });

  const [_, setRecentSwapToToken] = useSwapRecentToTokens();

  const canShowDirectSubmit = useMemo(
    () =>
      isAccountSupportMiniApproval(currentAccount?.type || '') &&
      isSupportedChain &&
      !inSufficient,
    [currentAccount?.type, inSufficient, isSupportedChain],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsSubmitting(false);
  }, [payAmount, payToken?.id, receiveToken?.id, chain]);

  const checkGasFeeTooHighRef = useRef(true);

  const directSignBtnRef = useRef<DirectSignBtnMethods>(null);

  const onChangeCheckGasFeeTooHigh = useCallback((b: boolean) => {
    checkGasFeeTooHighRef.current = b;
  }, []);

  const buildFormSnapshot = useCallback(
    (): SwapFormSnapshot => ({
      amount: payAmount || '',
      amountMode: slider === 100 ? 'max' : 'exact',
    }),
    [payAmount, slider],
  );

  const handleSwap = useMemoizedFn(async (p?: { ignoreGasFee?: boolean }) => {
    if (storeApiExpSettingData.getShouldBlockSubmitIfFormChangedOnAuth()) {
      const snapshot = formValuesRef.current.getSnapshot();

      if (!snapshot) {
        toast.info(t('page.bridge.formChangedAmount'));
        return;
      }

      // Check if amount changed during authentication
      const comparison = formValuesRef.current.compare({
        amount: payAmount || '',
      });

      // If amount changed during authentication, close modal and alert user
      if (comparison.isChanged) {
        formValuesRef.current.clear();
        closeMiniSigner();
        Alert.alert(
          t('page.bridge.formChangedTitle') || 'Form Changed',
          t('page.bridge.formChangedAmount'),
          [{ text: t('global.ok') || 'OK' }],
        );
        refresh(e => e + 1);
        mutateTxs([]);
        return;
      }
    }

    // Clear snapshot after validation
    formValuesRef.current.clear();

    if (isSubmitting) {
      return;
    }
    if (receiveToken) {
      setRecentSwapToToken(receiveToken);
    }
    if (canShowDirectSubmit) {
      try {
        setIsSubmitting(true);
        setReloadTxRefreshPaused(true);

        if (!currentTxs?.length) {
          toast.info('please retry');
          throw new Error('no txs');
        }

        let txHash = '';

        clearExpiredTimer();
        setMiniSignLoading(true);

        const res = await openDirect({
          txs: currentTxs!,
          ga: miniSignGa,
          checkGasFeeTooHigh: checkGasFeeTooHighRef.current,
          ignoreGasFeeTooHigh: p?.ignoreGasFee || false,
        });
        txHash = last(res) || '';

        miniSignNextStep(txHash);

        if (!isApprove) {
          mutateTxs([]);
          const createdAt = Date.now();
          transactionHistoryService.addSwapTxHistory({
            hash: txHash,
            chainId: findChainByEnum(chain)?.id || 0,
            address: currentAccount?.address!,
            fromToken: payToken!,
            toToken: receiveToken!,
            slippage: new BigNumber(slippage).div(100).toNumber(),
            fromAmount: Number(payAmount),
            toAmount: new BigNumber(activeProvider?.quote?.toTokenAmount!)
              .div(
                10 **
                  (activeProvider?.quote?.toTokenDecimals ||
                    receiveToken!.decimals),
              )
              .toNumber(),
            dexId: activeProvider?.name || 'WrapToken',
            createdAt,
            status: 'pending',
            isFromCopyTrading: currentIsCopyTrading,
            copyTradingExtra: {
              type: navState?.type || 'Buy',
            },
          });
          handleAmountChange('');
          setTimeout(() => {
            runFetchSwapPendingCount();
          }, 1000);
          runFetchLocalPendingTx();
          const marketTab = navState?.from?.scene
            ? getMarketTabActionPrefix(navState.from.scene)
            : null;
          const createSwapTxAction = navState?.from?.scene
            ? getMarketTabCreateSwapTxAction(navState.from.scene)
            : null;

          if (marketTab && createSwapTxAction) {
            const payTokenUsdValue =
              typeof payAmount === 'string' && payToken?.price
                ? (
                    Number(payAmount || 0) * Number(payToken.price || 0)
                  ).toString()
                : '';
            stats.report('memecoinSwapTx', {
              chain: chainServerId,
              tx_id: txHash,
              dex_id: activeProvider?.name || '',
              market_tab: marketTab,
              meme_chain: navState?.from?.chain || '',
              meme_ca: navState?.from?.id || '',
              meme_symbol: navState?.from?.symbol || '',
              user_addr: currentAccount?.address || '',
              pay_token_usd_value: payTokenUsdValue,
              create_at: createdAt,
              address_type: currentAccount?.type || '',
              app_version: APP_VERSIONS.fromNative || '0',
            });
            matomoRequestEvent({
              category: 'Rabby Market',
              action: createSwapTxAction,
            });
          }
          preferenceService.setReportActionTs(
            REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_TO_CONFIRM,
            {
              chain: chainServerId,
            },
          );
          if (currentIsCopyTrading) {
            matomoRequestEvent({
              category: 'CopyTrading',
              action:
                navState?.type === 'Sell'
                  ? 'CopyTrading_SellCreateSwap'
                  : 'CopyTrading_BuyCreateSwap',
            });
          }
        }
      } catch (error: any) {
        console.log('swap mini sign error', error);
        if (error === MINI_SIGN_ERROR.USER_CANCELLED) {
          refresh(e => e + 1);
          mutateTxs([]);
        } else if (
          [
            MINI_SIGN_ERROR.GAS_FEE_TOO_HIGH,
            MINI_SIGN_ERROR.CANT_PROCESS,
          ].includes(error)
        ) {
        } else {
          await gotoSwap();
        }
      } finally {
        setReloadTxRefreshPaused(false);
        setIsSubmitting(false);
        setMiniSignLoading(false);
      }
    } else {
      gotoSwap();
    }
    preferenceService.setReportActionTs(
      REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_OR_APPROVE_BTN,
      {
        chain: chainServerId,
      },
    );
  });

  const amountAvailable = useMemo(
    () => new BigNumber(payToken?.raw_amount_hex_str || 0, 16).gt(0),
    [payToken],
  );

  const lowCreditInit = useRef(false);

  const isFocused = useIsFocused();

  const swapBtnDisabled =
    quoteLoading ||
    !payToken ||
    !receiveToken ||
    !amountAvailable ||
    inSufficient ||
    !activeProvider ||
    isSubmitting;

  const isShowMoreVisible = useMemo(() => {
    return (
      showMoreVisible &&
      Number(payAmount) > 0 &&
      inSufficientCanGetQuote &&
      !!payToken &&
      activeProvider?.quote &&
      !!receiveToken
    );
  }, [
    payAmount,
    inSufficientCanGetQuote,
    showMoreVisible,
    payToken,
    receiveToken,
    activeProvider?.quote,
  ]);

  const [showMoreOpen, setShowMoreOpen] = useState(false);

  const [sourceName, sourceLogo] = useMemo(() => {
    if (activeProvider?.name) {
      if (isWrapToken) {
        return [t('page.swap.wrap-contract'), receiveToken?.logo_url];
      }
      const currentDex = DEX_WITH_WRAP[activeProvider.name];
      return [currentDex.name, currentDex.logo];
    }
    return ['', ''];
  }, [activeProvider?.name, isWrapToken, t, receiveToken?.logo_url]);

  const noQuoteOrigin = useMemo(
    () =>
      Number(payAmount) > 0 &&
      inSufficientCanGetQuote &&
      !quoteBlockedByClosedMarket &&
      amountAvailable &&
      !quoteLoading &&
      !!payToken &&
      !!receiveToken &&
      !activeProvider,
    [
      payAmount,
      inSufficientCanGetQuote,
      quoteBlockedByClosedMarket,
      amountAvailable,
      quoteLoading,
      payToken,
      receiveToken,
      activeProvider,
    ],
  );

  const noQuote = useDebouncedValue(noQuoteOrigin, 10);
  const showClosedMarketTip = useMemo(
    () => (!!payToken || !!receiveToken) && quoteBlockedByClosedMarket,
    [payToken, receiveToken, quoteBlockedByClosedMarket],
  );

  const lowCreditToken = useMemo(() => {
    if (!navState) {
      return _lowCreditToken;
    }
    const isCopyTrading =
      navState?.isFromCopyTrading &&
      _lowCreditToken?.id === navState?.tokenId &&
      _lowCreditToken?.chain === findChainByEnum(navState.chainEnum)?.serverId;
    if (isCopyTrading) {
      return undefined;
    }
    return _lowCreditToken;
  }, [_lowCreditToken, navState]);

  const openFeePopup = useCallback(() => {
    if (isWrapToken) {
      return;
    }
    setIsShowRabbyFeePopup({
      visible: true,
      dexName: activeProvider?.name || undefined,
      dexFeeDesc: activeProvider?.quote?.dexFeeDesc || undefined,
    });
  }, [
    activeProvider?.name,
    activeProvider?.quote?.dexFeeDesc,
    isWrapToken,
    setIsShowRabbyFeePopup,
  ]);

  const [miniSignLoading, setMiniSignLoading] = useState(false);

  const {
    shouldTwoStep: shouldTwoStepSwap,
    currentTxs,
    next,
    isApprove,
    approvePending: approveTxPending,
    setApprovePending,
    approveHash,
  } = useTwoStepSwap({
    txs,
    chain,
    enable:
      !!currentAccount?.type &&
      isAccountSupportMiniApproval(currentAccount?.type),
    type: 'approveSwap',
    // onApprovePending,
  });

  const miniSignNextStep = (hash: string) => {
    if (isApprove) {
      transactionHistoryService.addApproveSwapTokenTxHistory({
        address: currentAccount?.address!,
        chainId: currentTxs![0]!.chainId,
        amount: Number(payAmount),
        token: payToken!,
        status: 'pending',
        createdAt: Date.now(),
        hash,
      });
      setApprovePending(true);
    }
    next(hash);
    setMiniSignLoading(false);
  };

  const showLoss = useDetectLoss({
    payToken,
    receiveToken,
    receiveRawAmount: activeProvider?.actualReceiveAmount || 0,
    payAmount,
  });

  const showRiskTips =
    isSlippageLow || isSlippageHigh || showLoss || miniSignGasFeeTooHigh;
  const shouldPauseMiniSignerEffects =
    useMiniSignerEffectPause(miniSignLoading);

  useEffect(() => {
    if (!isFocused) {
      closeMiniSigner();
      return;
    }
    if (shouldPauseMiniSignerEffects()) {
      return;
    }
    if (!canShowDirectSubmit || !currentAccount?.address) {
      closeMiniSigner();
      return;
    }
    if (!currentTxs?.length) {
      closeMiniSigner({ preserveManualGasMethod: true });
      return;
    }
    onChangeCheckGasFeeTooHigh(true);
    prefetchMiniSigner({
      txs: currentTxs,
      ga: miniSignGa,
      checkGasFeeTooHigh: true,
      synGasHeaderInfo: true,
    }).catch(error => {
      console.error('swap mini signer prefetch failed', error);
    });
  }, [
    onChangeCheckGasFeeTooHigh,
    isFocused,
    canShowDirectSubmit,
    currentAccount?.address,
    currentTxs,
    prefetchMiniSigner,
    closeMiniSigner,
    miniSignGa,
    shouldPauseMiniSignerEffects,
  ]);

  useEffect(() => {
    if (shouldPauseMiniSignerEffects()) {
      return;
    }
    if (!activeProvider) {
      mutateTxs([]);
    }
  }, [activeProvider, mutateTxs, shouldPauseMiniSignerEffects]);

  useEffect(() => {
    if (shouldPauseMiniSignerEffects()) {
      return;
    }
    if (activeProvider && canShowDirectSubmit) {
      mutateTxs([]);
      runBuildSwapTxs();
    }
  }, [
    activeProvider,
    canShowDirectSubmit,
    currentAccount?.address,
    mutateTxs,
    runBuildSwapTxs,
    shouldPauseMiniSignerEffects,
    swapUseSlider,
  ]);

  useEffect(
    () => () => {
      closeMiniSigner();
    },
    [closeMiniSigner],
  );

  useEffect(() => {
    if (isFocused) {
      refresh(e => e + 1);
    }
  }, [isFocused, refresh]);

  useEffect(() => {
    if (!isFocused) {
      lowCreditInit.current = false;
    } else if (
      receiveToken &&
      receiveToken?.low_credit_score &&
      !lowCreditInit.current &&
      navState?.type !== 'Sell'
    ) {
      if (navState?.type === 'Buy' && navState?.tokenId !== receiveToken.id) {
        return;
      }
      setLowCreditToken(receiveToken);
      setLowCreditVisible(true);
      lowCreditInit.current = true;
    }
  }, [
    isFocused,
    receiveToken,
    setLowCreditToken,
    setLowCreditVisible,
    navState,
  ]);

  const originBtnText = useMemo(() => {
    if (!isSupportedChain) {
      return t('component.externalSwapBrideDappPopup.swapOnDapp');
    }

    if (shouldTwoStepSwap) {
      if (!isApprove && !approveTxPending) {
        return t('page.swap.title');
      }
      return t('page.swap.approve');
    }

    if (canShowDirectSubmit) {
      return t('global.Confirm');
    }

    if (activeProvider?.shouldApproveToken) {
      return t('page.swap.approve-swap');
    }

    if (quoteLoading) {
      return t('page.swap.title');
    }

    return t('page.swap.title');
  }, [
    activeProvider?.shouldApproveToken,
    approveTxPending,
    canShowDirectSubmit,
    isApprove,
    isSupportedChain,
    quoteLoading,
    shouldTwoStepSwap,
    t,
  ]);

  const [latestQuoteBtnText, setLatestQuoteBtnText] = useState('');

  const btnText = latestQuoteBtnText || originBtnText;

  useDebounce(
    () => {
      if (originBtnText && activeProvider && !quoteLoading) {
        setLatestQuoteBtnText(originBtnText);
      }
    },
    300,
    [originBtnText, activeProvider, quoteLoading],
  );

  useDebounce(
    () => {
      setLatestQuoteBtnText(originBtnText);
    },
    300,
    [chain, payToken?.id, receiveToken?.id],
  );

  return (
    <SignatureInstanceProvider instance={instance}>
      <NormalScreenContainer2024 type="bg1">
        {isForMultipleAddress && !disableAccountSwitcherModal && (
          <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
        )}
        <KeyboardAwareScrollView
          style={[
            styles.container,

            {
              marginBottom:
                112 +
                (isAndroid ? 20 + safeOffBottom : 0) +
                (showRiskTips ? 26 : 0),
            },
          ]}
          ref={keyboardAwareRef}
          // contentContainerStyle={styles.container}
          enableOnAndroid
          extraHeight={200}
          keyboardOpeningTime={0}>
          <View style={styles.content}>
            <Text style={[styles.label, { marginBottom: 12 }]}>
              {t('page.swap.chain')}
            </Text>
            <ChainInfo2024
              chainEnum={chain}
              onChange={switchChain}
              // supportChains={SWAP_SUPPORT_CHAINS}
              hideTestnetTab
              account={currentAccount!}
              rightArrowIcon={
                <ArrowDownSVG color={colors2024['neutral-line']} />
              }
            />
            <View style={styles.swapContainer}>
              <View style={styles.flex1}>
                <Text style={styles.label}>{t('page.swap.token')}</Text>
              </View>
            </View>
            <View style={styles.swapTokenContainer}>
              <View style={styles.swapTokenCard}>
                <SwapTokenItem
                  disabled={!isSupportedChain}
                  inSufficient={inSufficient}
                  slider={slider}
                  onChangeSlider={onChangeSlider}
                  value={payAmount}
                  onValueChange={value => {
                    if (directSignBtnRef.current?.isAuthInProgress()) {
                      return;
                    }
                    handleAmountChange(value);
                  }}
                  token={payToken}
                  onTokenChange={token => {
                    const chainItem = findChainByServerID(token.chain);
                    const normalSetChainToken = () => {
                      if (chainItem?.enum !== chain) {
                        switchChain(chainItem?.enum || CHAINS_ENUM.ETH);
                        setReceiveToken(undefined);
                      }
                      setPayToken(token);
                    };

                    if (!isForMultipleAddress) {
                      normalSetChainToken();
                    } else {
                      switchAccountOnSelectedToken({
                        token,
                        currentAccount,
                      });
                      normalSetChainToken();
                    }
                  }}
                  account={currentAccount}
                  chainId={chainServerId}
                  type={'from'}
                  excludeTokens={
                    receiveToken?.id ? [receiveToken?.id] : undefined
                  }
                />
              </View>

              <View style={styles.swapTokenCard}>
                <SwapTokenItem
                  valueLoading={quoteLoading}
                  token={receiveToken}
                  onTokenChange={token => {
                    const chainItem = findChainByServerID(token.chain);
                    if (chainItem?.enum !== chain) {
                      switchChain(chainItem?.enum || CHAINS_ENUM.ETH);
                      setPayToken(undefined);
                    }
                    setReceiveToken(token);

                    if (token?.low_credit_score) {
                      setLowCreditToken(token);
                      setLowCreditVisible(true);
                    }
                  }}
                  value={
                    !activeProvider
                      ? ''
                      : activeProvider?.actualReceiveAmount
                      ? activeProvider?.actualReceiveAmount + ''
                      : isWrapToken
                      ? payAmount
                      : '0'
                  }
                  account={currentAccount}
                  chainId={chainServerId}
                  type={'to'}
                  currentQuote={activeProvider}
                  // placeholder={t('page.swap.search-by-name-address')}
                  excludeTokens={payToken?.id ? [payToken?.id] : undefined}
                  finishedQuotes={finishedQuotes}
                />
              </View>
              <BridgeSwitchBtn
                onPress={exchangeToken}
                style={styles.arrowWrapper}
                loading={quoteLoading}
              />
            </View>

            {showClosedMarketTip ? (
              <MarketClosedTip />
            ) : noQuote ? (
              <>
                <Text style={styles.errorTip}>
                  {t('page.swap.no-quote-found')}
                </Text>
                <View>
                  <BridgeSlippage
                    value={slippage}
                    displaySlippage={slippage}
                    onChange={setSlippage}
                    autoSlippage={autoSlippage}
                    isCustomSlippage={isCustomSlippage}
                    setAutoSlippage={setAutoSlippage}
                    setIsCustomSlippage={setIsCustomSlippage}
                    type="swap"
                    loading={quoteLoading}
                    autoSuggestSlippage={autoSuggestSlippage}
                    onOptionsOpenChange={setSlippageOptionsQuoteRefreshPaused}
                  />
                </View>
              </>
            ) : null}

            {isShowMoreVisible &&
              (!shouldTwoStepSwap ||
                (shouldTwoStepSwap && !approveHash) ||
                showRiskTips) && (
                <View
                  style={{
                    marginHorizontal: -24,
                  }}>
                  <BridgeShowMore
                    insufficient={inSufficient}
                    autoSuggestSlippage={autoSuggestSlippage}
                    supportDirectSign={canShowDirectSubmit}
                    openFeePopup={openFeePopup}
                    open={showMoreOpen}
                    setOpen={setShowMoreOpen}
                    sourceName={sourceName}
                    sourceLogo={sourceLogo}
                    slippage={slippageState}
                    displaySlippage={slippage}
                    onSlippageChange={setSlippage}
                    fromToken={payToken}
                    toToken={receiveToken}
                    amount={payAmount}
                    toAmount={
                      isWrapToken
                        ? payAmount
                        : activeProvider?.actualReceiveAmount || 0
                    }
                    openQuotesList={openQuotesList}
                    quoteLoading={quoteLoading}
                    slippageError={isSlippageHigh || isSlippageLow}
                    autoSlippage={!!autoSlippage}
                    isCustomSlippage={isCustomSlippage}
                    setAutoSlippage={setAutoSlippage}
                    setIsCustomSlippage={setIsCustomSlippage}
                    type="swap"
                    isWrapToken={isWrapToken}
                    isBestQuote={
                      !!activeProvider &&
                      !!bestQuoteDex &&
                      bestQuoteDex === activeProvider?.name
                    }
                    showMEVGuardedSwitch={showMEVGuardedSwitch}
                    originPreferMEVGuarded={originPreferMEVGuarded}
                    switchPreferMEV={switchPreferMEV}
                    recommendValue={
                      slippageValidInfo?.is_valid
                        ? undefined
                        : slippageValidInfo?.suggest_slippage
                    }
                    onDepositPopupVisibleChange={setDepositQuoteRefreshPaused}
                    onSlippageOptionsOpenChange={
                      setSlippageOptionsQuoteRefreshPaused
                    }
                    onGasSettingsOpenChange={setGasSettingsQuoteRefreshPaused}
                  />
                </View>
              )}

            {!approveHash &&
              Boolean(!isShowMoreVisible && localPendingTxData) && (
                <PendingTxItem
                  type="swap"
                  isForMultipleAddress={isForMultipleAddress}
                  data={localPendingTxData!}
                  clearLocalPendingTxData={clearLocalPendingTxData}
                />
              )}

            {!showRiskTips &&
            shouldTwoStepSwap &&
            !!currentAccount?.address &&
            approveHash &&
            currentTxs?.[0]?.chainId ? (
              <ApprovePendingTxItem
                type="approveSwap"
                isForMultipleAddress={isForMultipleAddress}
                address={currentAccount?.address}
                hash={approveHash}
                chainId={currentTxs[0]?.chainId}
              />
            ) : null}

            {!isSupportedChain ? (
              <>
                <ExternalSwapBridgeDappTips
                  dappsAvailable={externalDapps.length > 0}
                />
                <SwapBridgeDappPopup
                  visible={swapDappOpen}
                  onClose={() => {
                    setSwapDappOpen(false);
                  }}
                  dappList={externalDapps}
                  openTab={openTab}
                />
              </>
            ) : null}
          </View>
        </KeyboardAwareScrollView>
        <View
          style={[
            styles.buttonContainer,
            {
              paddingBottom:
                BOTTOM_BUTTON_BOTTOM_OFFSET + (isAndroid ? safeOffBottom : 0),
            },
          ]}>
          <Tip
            content={
              !isSupportedChain && externalDapps.length < 1
                ? t('component.externalSwapBrideDappPopup.noDapps')
                : undefined
            }>
            <View>
              {canShowDirectSubmit ? (
                <DirectSignBtn
                  ref={directSignBtnRef}
                  // refresh  risk check
                  key={`${refreshId}-${chain}-${payToken?.id}-${receiveToken?.id}-${payAmount}-${activeProvider?.quote?.tx?.data}-${isApprove}`}
                  height={BOTTOM_BUTTON_HEIGHT}
                  titleStyle={styles.bottomButtonTitle}
                  loading={miniSignLoading}
                  loadingType="circle"
                  showTextOnLoading
                  authTitle={t('page.whitelist.confirmPassword')}
                  title={btnText}
                  onFinished={handleSwap}
                  disabled={
                    swapBtnDisabled ||
                    !canDirectSign ||
                    miniSignLoading ||
                    approveTxPending
                  }
                  type={'primary'}
                  syncUnlockTime
                  onBeforeAuth={() => {
                    clearExpiredTimer();
                    formValuesRef.current.save(buildFormSnapshot());
                  }}
                  onCancel={() => {
                    formValuesRef.current.clear();
                    refresh(e => e + 1);
                  }}
                  onAuthModalDismiss={() => {
                    formValuesRef.current.clear();
                  }}
                  account={currentAccount}
                  showHardWalletProcess
                  showRiskTips={showRiskTips && !swapBtnDisabled}
                />
              ) : (
                <Button
                  height={BOTTOM_BUTTON_HEIGHT}
                  titleStyle={styles.bottomButtonTitle}
                  onPress={() => {
                    if (!isSupportedChain && !externalDapps.length) {
                      return;
                    }
                    if (!isSupportedChain && externalDapps.length > 0) {
                      setSwapDappOpen(true);
                      return;
                    }
                    if (!activeProvider || slippageChanged) {
                      refresh(e => e + 1);

                      return;
                    }
                    if (activeProvider?.shouldTwoStepApprove) {
                      setTwoStepApproveModalVisible(true);
                      return;
                    }
                    // gotoSwap();
                    handleSwap();
                  }}
                  title={btnText}
                  disabled={
                    isSupportedChain
                      ? swapBtnDisabled
                      : externalDapps.length > 0
                      ? false
                      : true
                  }
                />
              )}
            </View>
          </Tip>
        </View>
        <TwpStepApproveModal
          open={twoStepApproveModalVisible}
          onCancel={() => {
            setTwoStepApproveModalVisible(false);
          }}
          onConfirm={handleSwap}
        />

        {userAddress && payToken && receiveToken && chain ? (
          <QuoteList
            list={quoteList}
            loading={quoteLoading}
            visible={quotesListVisible}
            onClose={closeQuotesList}
            userAddress={userAddress}
            chain={chain}
            slippage={slippage}
            payToken={payToken}
            payAmount={payAmount}
            receiveToken={receiveToken}
            fee={feeRate}
            inSufficient={inSufficient}
            setActiveProvider={setActiveProvider}
            sortIncludeGasFee
          />
        ) : null}
        <RabbyFeePopup
          type="swap"
          visible={isShowRabbyFeePopup}
          dexName={dexName}
          dexFeeDesc={dexFeeDesc}
          onClose={() => setIsShowRabbyFeePopup({ visible: false })}
        />

        <LowCreditModal
          token={lowCreditToken}
          visible={lowCreditVisible}
          onCancel={() => setLowCreditVisible(false)}
        />

        <TokenInfoPopup />
      </NormalScreenContainer2024>
    </SignatureInstanceProvider>
  );
};

Swap.SwapHeader = SwapHeader;

const ForMultipleAddress = (
  props: Omit<
    React.ComponentProps<typeof Swap>,
    keyof PropsForAccountSwitchScreen
  >,
) => {
  const { sceneCurrentAccountDepKey } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  return (
    <ScreenSceneAccountProvider
      value={{
        forScene: 'MakeTransactionAbout',
        ofScreen: 'MultiSwapBridge',
        sceneScreenRenderId: `${sceneCurrentAccountDepKey}-MultiSwapBridge`,
      }}>
      <Swap {...props} isForMultipleAddress />
    </ScreenSceneAccountProvider>
  );
};

Swap.ForMultipleAddress = ForMultipleAddress;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
  },
  content: {
    minHeight: 300,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    paddingBottom: 30,
  },
  label: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  balanceText: {
    color: colors2024['neutral-foot'],
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
  },
  errorTip: {
    marginTop: 16,
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
  },
  rowView: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  swapContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 16,
    marginBottom: 12,
  },
  flex1: {
    width: 128,
  },
  swapTokenContainer: {
    position: 'relative',
    gap: 10,
  },
  swapTokenCard: {
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-2'],
    overflow: 'hidden',
  },
  arrowWrapper: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    zIndex: 1,
    transform: [{ translateX: -18 }, { translateY: -18 }],
  },
  amountInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
    marginBottom: 8,
    justifyContent: 'space-between',
  },

  inputContainer: {
    flexDirection: 'column',
    height: 98,
    paddingLeft: 13,
    paddingTop: 4,
    paddingBottom: 16,
    borderRadius: 30,
    justifyContent: 'space-between',
    backgroundColor: colors2024['neutral-bg-2'],
  },
  inputWrapper: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 0,
  },
  input: {
    flex: 1,
    fontSize: 28,
    lineHeight: 36,
    paddingVertical: 0,
    paddingBottom: 0,
    textAlignVertical: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  inputUsdValue: {
    fontSize: 14,
    lineHeight: 18,
    height: 18,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-info'],
  },
  loadingQuoteContainer: {
    borderWidth: 1,
    paddingBottom: 16,
    borderColor: colors2024['neutral-line'],
    borderRadius: 24,
    marginTop: 24,
    backgroundColor: colors2024['neutral-bg-1'],
  },

  afterWrapper: {
    marginTop: 20,
    gap: 20,
  },
  afterLabel: {
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  afterValue: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  inSufficient: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 26,
    marginHorizontal: 20,
  },
  inSufficientText: {
    color: colors2024['red-default'],
    fontSize: 15,
    fontWeight: '500',
  },

  buttonContainer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    paddingHorizontal: BOTTOM_BUTTON_HORIZONTAL_PADDING,
    backgroundColor: colors2024['neutral-bg-1'],
    width: '100%',
  },
  bottomButtonTitle: {
    fontSize: BOTTOM_BUTTON_TITLE_FONT_SIZE,
  },
  approveContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  approveSwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unlimitedText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  maxBtn: {
    marginLeft: 12,
    padding: 4,
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 8,
  },
  maxButtonText: {
    color: colors2024['brand-default'],
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
  },
}));

export default Swap;
