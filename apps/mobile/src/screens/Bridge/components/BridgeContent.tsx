import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  usePollBridgePendingNumber,
  useQuoteVisible,
  useRefreshId,
  useSetQuoteVisible,
  useSetRefreshId,
  useSetSettingVisible,
} from '../hooks';
import { useTranslation } from 'react-i18next';
import { TwpStepApproveModal } from '@/screens/Swap/components/TwoStepApproveModal';
import BigNumber from 'bignumber.js';
import { QuoteList } from './BridgeQuotes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { BridgeHeader, BridgeHeaderRef } from './BridgeHeader';
import { openapi } from '@/core/request';
import pRetry from 'p-retry';
import { stats } from '@/utils/stats';
import { bridgeToken, buildBridgeToken } from '../hooks/bridge';
import { toast } from '@/components/Toast';
import { useMemoizedFn, useRequest } from 'ahooks';
import { useIsFocused } from '@react-navigation/native';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import BridgeToken from './BridgeToken';
import BridgeSwitchBtn from './BridgeSwitchBtn';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import BridgeShowMore, { RecommendFromToken } from './BridgeShowMore';
import { tokenPriceImpact, useBridge } from '../hooks/token';
import { Button } from '@/components2024/Button';

import { useSwitchSceneAccountOnSelectedTokenWithOwner } from '@/databases/hooks/token';
import { CHAINS_ENUM } from '@debank/common';
import { useExternalSwapBridgeDapps } from '@/components/ExternalSwapBridgeDappPopup/hook';
import {
  ExternalSwapBridgeDappTips,
  SwapBridgeDappPopup,
} from '@/components/ExternalSwapBridgeDappPopup';
import { Tip } from '@/components';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { BridgePendingTxItem } from './PendingTxItem';
import { last } from 'lodash';
import { transactionHistoryService } from '@/core/services/shared';
import { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { matomoRequestEvent } from '@/utils/analytics';
import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import { useMiniSigner } from '@/hooks/useSigner';
import {
  MINI_SIGN_ERROR,
  useSignatureStore,
} from '@/components2024/MiniSignV2/state/SignatureManager';
import { BridgeSlippage } from './BridgeSlippage';

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  screen: {
    backgroundColor: colors2024['neutral-bg-1'],
    overflow: 'visible',
  },
  container: {
    flex: 1,
    paddingTop: 16,
    overflow: 'visible',
  },
  noRecoomedTokenText: {
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['red-default'],
    fontWeight: '500',
    marginHorizontal: 24,
  },
  cardContainer: {
    position: 'relative',
    flexDirection: 'column',
    // marginHorizontal: 20,
    gap: 8,
    marginBottom: -8,
    // width: '100%',
    // flex: 1,
  },
  switchButtonContainer: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -30 }, { translateY: -30 }],
  },
  switchButton: {
    padding: 10,
    backgroundColor: '#007bff',
    borderRadius: 5,
    alignItems: 'center',
  },
  innerContainer: {
    flex: 1,
  },
  pb130: {
    paddingBottom: 130,
  },
  pb110: {
    paddingBottom: 110,
  },
  card: {
    // backgroundColor: colors['neutral-card-1'],
    borderRadius: 6,
    padding: 12,
    paddingTop: 0,
    marginHorizontal: 10,
  },
  subTitle: {
    fontSize: 14,
    color: colors['neutral-body'],
    marginTop: 16,
    marginBottom: 8,
  },
  chainSelector: {
    height: 52,
    fontSize: 16,
    fontWeight: '500',
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipsContainer: {
    justifyContent: 'space-between',
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hidden: {
    display: 'none',
  },
  maxBtn: {
    marginLeft: 6,
    marginTop: 16,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors['neutral-line'],
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  input: {
    paddingRight: 10,
    fontSize: 20,
    fontWeight: '600',
    position: 'relative',
    flex: 1,
    color: colors['neutral-title-1'],
    backgroundColor: 'transparent',
  },
  inputUsdValue: {
    fontSize: 12,
    fontWeight: '400',
    color: colors['neutral-foot'],
  },
  buttonContainer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    // height: 140,
    backgroundColor: colors2024['neutral-bg-1'],
    width: '100%',
    padding: 20,
  },
  btnTitle: {
    color: colors['neutral-title-2'],
  },
}));

export const BridgeContent = ({ isForMultipleAddress = false }) => {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const { styles } = useTheme2024({ getStyle });
  const headerRef = useRef<BridgeHeaderRef>(null);
  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const [twoStepApproveModalVisible, setTwoStepApproveModalVisible] =
    useState(false);

  const {
    runAsync: runFetchBridgePendingCount,
    localPendingTxData,
    runFetchLocalPendingTx,
    clearLocalPendingTxData,
    clearBridgeHistoryRedDot,
  } = usePollBridgePendingNumber();

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  const quoteVisible = useQuoteVisible();

  const setQuoteVisible = useSetQuoteVisible();

  const openHistory = useMemoizedFn(() => {
    headerRef.current?.openHistory();
  });

  const Header = useCallback(
    () => (
      <BridgeHeader
        ref={headerRef}
        clearBridgeHistoryRedDot={clearBridgeHistoryRedDot}
      />
    ),
    [clearBridgeHistoryRedDot],
  );
  useEffect(() => {
    setNavigationOptions({
      headerRight: Header,
    });
  }, [Header, setNavigationOptions]);

  const {
    fromChain,
    fromToken,
    setFromToken,
    switchFromChain,
    toChain,
    toToken,
    setToToken,
    switchToChain: setToChain,
    switchToken,
    amount,
    handleAmountChange,

    recommendFromToken,
    fillRecommendFromToken,

    inSufficient,

    openQuotesList,
    quoteLoading: originQuoteLoading,
    quoteList,
    setQuotesList,

    bestQuoteId,
    selectedBridgeQuote,

    setSelectedBridgeQuote,

    slippage,
    slippageState,
    setSlippage,
    setSlippageChanged,
    isSlippageHigh,
    isSlippageLow,

    autoSlippage,
    isCustomSlippage,
    setAutoSlippage,
    setIsCustomSlippage,

    clearExpiredTimer,

    gasList,
    passGasPrice,
    handleMax,
    clickMaxBtnCount,
    isMaxRef,
    payTokenIsNativeToken,
    inSufficientCanGetQuote,
    slider,
    onChangeSlider,
  } = useBridge(isForMultipleAddress);

  const chains = useMemo(
    () => [toChain, fromChain].filter(e => !!e) as CHAINS_ENUM[],
    [toChain, fromChain],
  );

  const {
    isSupportedChain,
    data: externalDapps,
    loading: externalDappsLoading,
    openTab: _openTab,
  } = useExternalSwapBridgeDapps(chains, 'bridge');
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
  const [externalDappOpen, setExternalDappOpen] = useState(false);

  const showExternalDappTips = useMemo(
    () => !isSupportedChain && !!fromChain && !!toChain,
    [isSupportedChain, fromChain, toChain],
  );

  const [showMoreOpen, setShowMoreOpen] = useState(false);
  const refresh = useSetRefreshId();
  const refreshId = useRefreshId();

  const [fetchingBridgeQuote, setFetchingBridgeQuote] = useState(false);

  const gotoBridge = useMemoizedFn(async () => {
    if (
      !inSufficient &&
      fromToken &&
      toToken &&
      selectedBridgeQuote?.bridge_id &&
      currentAccount?.address
    ) {
      try {
        setFetchingBridgeQuote(true);
        const tx = await pRetry(
          () =>
            openapi.buildBridgeTx({
              aggregator_id: selectedBridgeQuote.aggregator.id,
              bridge_id: selectedBridgeQuote.bridge_id,
              from_token_id: fromToken.id,
              user_addr: currentAccount?.address,
              from_chain_id: fromToken.chain,
              from_token_raw_amount: new BigNumber(amount)
                .times(10 ** fromToken.decimals)
                .toFixed(0, 1)
                .toString(),
              to_chain_id: toToken.chain,
              to_token_id: toToken.id,
              slippage: new BigNumber(slippageState).div(100).toString(10),
              quote_key: JSON.stringify(selectedBridgeQuote.quote_key || {}),
            }),
          { retries: 1 },
        );
        stats.report('bridgeQuoteResult', {
          aggregatorIds: selectedBridgeQuote.aggregator.id,
          bridgeId: selectedBridgeQuote.bridge_id,
          fromChainId: fromToken.chain,
          fromTokenId: fromToken.id,
          toTokenId: toToken.id,
          toChainId: toToken.chain,
          status: tx ? 'success' : 'fail',
          payAmount: amount,
        });
        const addBridgeTxHistoryObj = {
          address: currentAccount?.address!,
          fromChainId: findChainByServerID(fromToken?.chain || '')?.id || 0,
          toChainId: findChainByServerID(toToken?.chain || '')?.id || 0,
          fromToken: fromToken!,
          toToken: toToken!,
          slippage: new BigNumber(slippage).div(100).toNumber(),
          fromAmount: Number(amount),
          toAmount: Number(selectedBridgeQuote?.to_token_amount || 0),
          dexId: selectedBridgeQuote?.aggregator.id!,
          createdAt: Date.now(),
          status: 'pending' as BridgeTxHistoryItem['status'],
          estimatedDuration: selectedBridgeQuote.duration,
        };
        await bridgeToken(
          {
            to: tx.to,
            value: tx.value,
            data: tx.data,
            payTokenRawAmount: new BigNumber(amount)
              .times(10 ** fromToken.decimals)
              .toFixed(0, 1)
              .toString(),
            chainId: tx.chainId,
            shouldApprove: !!selectedBridgeQuote.shouldApproveToken,
            shouldTwoStepApprove: !!selectedBridgeQuote.shouldTwoStepApprove,
            gasPrice:
              payTokenIsNativeToken && passGasPrice
                ? gasList?.find(e => e.level === 'normal')?.price
                : undefined,
            payTokenId: fromToken.id,
            payTokenChainServerId: fromToken.chain,
            info: {
              aggregator_id: selectedBridgeQuote.aggregator.id,
              bridge_id: selectedBridgeQuote.bridge_id,
              from_chain_id: fromToken.chain,
              from_token_id: fromToken.id,
              from_token_amount: amount,
              to_chain_id: toToken.chain,
              to_token_id: toToken.id,
              to_token_amount: selectedBridgeQuote.to_token_amount,
              tx: tx,
              rabby_fee: selectedBridgeQuote.rabby_fee.usd_value,
              slippage: new BigNumber(slippage).div(100).toNumber(),
            },
            account: currentAccount,
          },
          {
            ga: {
              category: 'Bridge',
              source: 'bridge',
              trigger: 'bridge',
            },
          },
          addBridgeTxHistoryObj,
        );
        runFetchLocalPendingTx();
        handleAmountChange('');
        setTimeout(() => {
          runFetchBridgePendingCount();
        }, 500);
      } catch (error) {
        toast.info((error as any)?.message || String(error));
        setQuotesList(pre =>
          pre?.filter(
            item =>
              !(
                item?.aggregator?.id === selectedBridgeQuote?.aggregator?.id &&
                item?.bridge_id === selectedBridgeQuote?.bridge_id
              ),
          ),
        );
        stats.report('bridgeQuoteResult', {
          aggregatorIds: selectedBridgeQuote.aggregator.id,
          bridgeId: selectedBridgeQuote.bridge_id,
          fromChainId: fromToken.chain,
          fromTokenId: fromToken.id,
          toTokenId: toToken.id,
          toChainId: toToken.chain,
          status: 'fail',
          payAmount: amount,
        });
        console.log(error);
      } finally {
        refresh(e => e + 1);
        setFetchingBridgeQuote(false);
      }
    }
  });

  const buildTxs = async () => {
    if (
      !inSufficient &&
      fromToken &&
      toToken &&
      selectedBridgeQuote?.bridge_id &&
      currentAccount?.address
    ) {
      try {
        const tx = await openapi.buildBridgeTx({
          aggregator_id: selectedBridgeQuote.aggregator.id,
          bridge_id: selectedBridgeQuote.bridge_id,
          from_token_id: fromToken.id,
          user_addr: currentAccount?.address,
          from_chain_id: fromToken.chain,
          from_token_raw_amount: new BigNumber(amount)
            .times(10 ** fromToken.decimals)
            .toFixed(0, 1)
            .toString(),
          to_chain_id: toToken.chain,
          to_token_id: toToken.id,
          slippage: new BigNumber(slippageState).div(100).toString(10),
          quote_key: JSON.stringify(selectedBridgeQuote.quote_key || {}),
        });
        stats.report('bridgeQuoteResult', {
          aggregatorIds: selectedBridgeQuote.aggregator.id,
          bridgeId: selectedBridgeQuote.bridge_id,
          fromChainId: fromToken.chain,
          fromTokenId: fromToken.id,
          toTokenId: toToken.id,
          toChainId: toToken.chain,
          status: tx ? 'success' : 'fail',
          payAmount: amount,
        });

        return buildBridgeToken(
          {
            to: tx.to,
            value: tx.value,
            data: tx.data,
            payTokenRawAmount: new BigNumber(amount)
              .times(10 ** fromToken.decimals)
              .toFixed(0, 1)
              .toString(),
            chainId: tx.chainId,
            shouldApprove: !!selectedBridgeQuote.shouldApproveToken,
            shouldTwoStepApprove: !!selectedBridgeQuote.shouldTwoStepApprove,
            gasPrice:
              payTokenIsNativeToken && passGasPrice
                ? gasList?.find(e => e.level === 'normal')?.price
                : undefined,
            payTokenId: fromToken.id,
            payTokenChainServerId: fromToken.chain,
            info: {
              aggregator_id: selectedBridgeQuote.aggregator.id,
              bridge_id: selectedBridgeQuote.bridge_id,
              from_chain_id: fromToken.chain,
              from_token_id: fromToken.id,
              from_token_amount: amount,
              to_chain_id: toToken.chain,
              to_token_id: toToken.id,
              to_token_amount: selectedBridgeQuote.to_token_amount,
              tx: tx,
              rabby_fee: selectedBridgeQuote.rabby_fee.usd_value,
              slippage: new BigNumber(slippageState).div(100).toNumber(),
            },
            account: currentAccount,
          },
          {
            ga: {
              category: 'Bridge',
              source: 'bridge',
              trigger: 'bridge',
            },
          },
        );
      } catch (error) {
        toast.info((error as any)?.message || String(error));
        setQuotesList(pre =>
          pre?.filter(
            item =>
              !(
                item?.aggregator?.id === selectedBridgeQuote?.aggregator?.id &&
                item?.bridge_id === selectedBridgeQuote?.bridge_id
              ),
          ),
        );
        stats.report('bridgeQuoteResult', {
          aggregatorIds: selectedBridgeQuote.aggregator.id,
          bridgeId: selectedBridgeQuote.bridge_id,
          fromChainId: fromToken.chain,
          fromTokenId: fromToken.id,
          toTokenId: toToken.id,
          toChainId: toToken.chain,
          status: 'fail',
          payAmount: amount,
        });
        console.debug(error);
      }
    }
  };

  const {
    data: txs,
    runAsync: runBuildTxs,
    mutate: mutateTxs,
    loading: buildingTxsLoading,
  } = useRequest(buildTxs, {
    manual: true,
  });

  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      refresh(e => e + 1);
    }
  }, [isFocused, refresh]);

  const runBuildBridgeTxsRef = useRef<ReturnType<typeof runBuildTxs>>();

  const canUseMiniTx = isAccountSupportMiniApproval(currentAccount?.type);

  const quoteLoading =
    originQuoteLoading ||
    buildingTxsLoading ||
    (!!selectedBridgeQuote &&
      (canUseMiniTx ? !txs?.length : false) &&
      !inSufficient);

  const canShowDirectSubmit = useMemo(
    () =>
      isAccountSupportMiniApproval(currentAccount?.type) &&
      isSupportedChain &&
      !inSufficient,
    [currentAccount?.type, inSufficient, isSupportedChain],
  );

  const bridgeChainServerId = useMemo(
    () =>
      fromToken?.chain ||
      (fromChain ? findChainByEnum(fromChain)?.serverId : undefined),
    [fromChain, fromToken?.chain],
  );

  const miniSignGa = useMemo(
    () => ({
      category: 'Bridge',
      source: 'bridge',
    }),
    [],
  );

  const { ctx } = useSignatureStore();

  const miniSignGasFeeTooHigh = !!ctx?.gasFeeTooHigh;
  const canDirectSign = !ctx?.disabledProcess;

  const {
    prefetch: prefetchMiniSigner,
    openDirect,
    close: closeMiniSigner,
  } = useMiniSigner({
    account: currentAccount!,
    chainServerId: bridgeChainServerId,
    autoResetGasStoreOnChainChange: true,
  });

  const [miniSignLoading, setMiniSignLoading] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      closeMiniSigner();
      return;
    }
    if (!canShowDirectSubmit || !currentAccount || !txs?.length) {
      closeMiniSigner();
      return;
    }
    prefetchMiniSigner({
      txs,
      ga: miniSignGa,
      checkGasFeeTooHigh: true,
      synGasHeaderInfo: true,
    }).catch(error => {
      console.error('bridge mini signer prefetch failed', error);
    });
  }, [
    canShowDirectSubmit,
    closeMiniSigner,
    currentAccount,
    isFocused,
    miniSignGa,
    prefetchMiniSigner,
    txs,
  ]);

  useEffect(
    () => () => {
      closeMiniSigner();
    },
    [closeMiniSigner],
  );

  const handleBridge = useMemoizedFn(async (p?: { ignoreGasFee?: boolean }) => {
    if (canUseMiniTx && canShowDirectSubmit) {
      try {
        if (miniSignLoading) {
          return;
        }
        setMiniSignLoading(true);
        setFetchingBridgeQuote(true);

        clearExpiredTimer();

        let currentTxs = txs;
        if (!currentTxs?.length && runBuildBridgeTxsRef.current) {
          currentTxs = await runBuildBridgeTxsRef.current;
        }
        if (!currentTxs?.length) {
          const res = await runBuildTxs();
          if (res?.length) {
            runBuildBridgeTxsRef.current = Promise.resolve(res);
          } else {
            runBuildBridgeTxsRef.current = undefined;
          }
          currentTxs = res;
        }

        if (!currentTxs?.length) {
          toast.info('please retry');
          throw new Error('no txs');
        }

        const res = await openDirect({
          txs: currentTxs,
          ga: miniSignGa,
          checkGasFeeTooHigh: true,
          ignoreGasFeeTooHigh: p?.ignoreGasFee || false,
        });
        const txHash = last(res) || '';

        if (txHash) {
          transactionHistoryService.addBridgeTxHistory({
            address: currentAccount?.address!,
            fromChainId: findChainByServerID(fromToken?.chain || '')?.id || 0,
            toChainId: findChainByServerID(toToken?.chain || '')?.id || 0,
            fromToken: fromToken!,
            toToken: toToken!,
            slippage: new BigNumber(slippageState).div(100).toNumber(),
            fromAmount: Number(amount),
            dexId: selectedBridgeQuote?.aggregator.id!,
            toAmount: Number(selectedBridgeQuote?.to_token_amount || 0),
            status: 'pending',
            hash: txHash,
            createdAt: Date.now(),
            estimatedDuration: selectedBridgeQuote?.duration || 0,
          });
        }

        mutateTxs([]);
        runFetchLocalPendingTx();
        handleAmountChange('');
        setTimeout(() => {
          runFetchBridgePendingCount();
        }, 500);
      } catch (error: any) {
        console.log('bridge mini sign error', error);
        if (error === MINI_SIGN_ERROR.USER_CANCELLED) {
          refresh(e => e + 1);
          mutateTxs([]);
        } else if (
          [
            MINI_SIGN_ERROR.GAS_FEE_TOO_HIGH,
            MINI_SIGN_ERROR.CANT_PROCESS,
          ].includes(error)
        ) {
          setTimeout(() => {
            refresh(e => e + 1);
          }, 10 * 1000);
        } else {
          gotoBridge();
        }
      } finally {
        setMiniSignLoading(false);
        setFetchingBridgeQuote(false);
      }
      return;
    }

    gotoBridge();
  });

  const amountAvailable = useMemo(() => Number(amount) > 0, [amount]);

  const noQuote =
    inSufficientCanGetQuote &&
    !!fromToken &&
    !!toToken &&
    Number(amount) > 0 &&
    !quoteLoading &&
    !quoteList?.length;

  const btnDisabled =
    inSufficient ||
    !fromToken ||
    !toToken ||
    !amountAvailable ||
    !selectedBridgeQuote ||
    quoteLoading ||
    !quoteList?.length;

  useEffect(() => {
    if (selectedBridgeQuote && canUseMiniTx) {
      mutateTxs([]);
      runBuildBridgeTxsRef.current = runBuildTxs();
    }
  }, [runBuildTxs, canUseMiniTx, selectedBridgeQuote, mutateTxs]);

  const btnText = useMemo(() => {
    if (showExternalDappTips) {
      return t('component.externalSwapBrideDappPopup.bridgeOnDapp');
    }
    if (btnDisabled) {
      return t('page.bridge.title');
    }

    if (selectedBridgeQuote?.shouldApproveToken) {
      return t('page.bridge.approve-and-bridge');
    }
    return t('page.bridge.title');
  }, [
    showExternalDappTips,
    btnDisabled,
    selectedBridgeQuote?.shouldApproveToken,
    t,
  ]);

  const handleConfirm = () => {
    if (showExternalDappTips && externalDapps.length > 0) {
      setExternalDappOpen(true);
      return;
    }

    if (fetchingBridgeQuote) {
      return;
    }
    if (!selectedBridgeQuote) {
      refresh(e => e + 1);

      return;
    }
    if (selectedBridgeQuote?.shouldTwoStepApprove) {
      setTwoStepApproveModalVisible(true);
      return;
    }
    handleBridge();
  };

  const switchFeePopup = useSetSettingVisible();

  const openFeePopup = useCallback(() => {
    switchFeePopup(true);
  }, [switchFeePopup]);

  const { switchAccountOnSelectedToken } =
    useSwitchSceneAccountOnSelectedTokenWithOwner('MakeTransactionAbout');

  const showLoss = useMemo(() => {
    const impact = tokenPriceImpact(
      fromToken,
      toToken,
      amount,
      selectedBridgeQuote?.to_token_amount,
    );
    return !!impact?.showLoss;
  }, [fromToken, amount, selectedBridgeQuote?.to_token_amount, toToken]);

  const showRiskTips =
    isSlippageHigh || isSlippageLow || showLoss || miniSignGasFeeTooHigh;

  const [scrollEnabled, setScrollEnabled] = useState(true);

  return (
    <NormalScreenContainer overwriteStyle={styles.screen}>
      {isForMultipleAddress && (
        <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
      )}
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingBottom: 150 + bottom + (showRiskTips ? 26 : 0),
        }}
        enableOnAndroid
        scrollEnabled={scrollEnabled}
        extraHeight={200}
        keyboardOpeningTime={0}>
        <View style={styles.card}>
          <View style={styles.cardContainer}>
            <BridgeToken
              type="from"
              slider={slider}
              onChangeSlider={onChangeSlider}
              disabled={!isSupportedChain}
              account={currentAccount}
              inSufficient={inSufficient}
              chain={fromChain}
              token={fromToken}
              isMaxRef={isMaxRef}
              clickMaxBtnCount={clickMaxBtnCount}
              handleMax={handleMax}
              onSliderScrollEnabledChange={setScrollEnabled}
              onChangeToken={token => {
                const chainItem = findChainByServerID(token.chain);
                const normalSetChainToken = () => {
                  if (chainItem?.enum !== fromChain) {
                    switchFromChain(chainItem?.enum || CHAINS_ENUM.ETH);
                  }
                  handleAmountChange('');
                  setFromToken(token);
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
              onChangeChain={switchFromChain}
              value={amount}
              onInputChange={handleAmountChange}
              excludeChains={toChain ? [toChain] : undefined}
            />
            <BridgeToken
              type="to"
              account={currentAccount}
              chain={toChain}
              token={toToken}
              onChangeToken={setToToken}
              onChangeChain={setToChain}
              fromChainId={
                fromToken?.chain || findChainByEnum(fromChain)?.serverId
              }
              fromTokenId={fromToken?.id}
              valueLoading={quoteLoading}
              value={
                quoteLoading ? undefined : selectedBridgeQuote?.to_token_amount
              }
              excludeChains={fromChain ? [fromChain] : undefined}
              noQuote={noQuote}
            />
            <BridgeSwitchBtn
              style={styles.switchButtonContainer}
              onPress={switchToken}
              loading={quoteLoading}
            />
          </View>
        </View>

        {!isSupportedChain && fromChain && toChain ? (
          <View style={{ marginHorizontal: 22 }}>
            <ExternalSwapBridgeDappTips
              dappsAvailable={externalDapps?.length > 0}
            />
            <SwapBridgeDappPopup
              visible={externalDappOpen}
              onClose={() => {
                setExternalDappOpen(false);
              }}
              dappList={externalDapps}
              openTab={openTab}
            />
          </View>
        ) : null}

        <View>
          {selectedBridgeQuote && !quoteLoading && inSufficientCanGetQuote && (
            <BridgeShowMore
              insufficient={inSufficient}
              sourceAlwaysShow
              duration={selectedBridgeQuote?.duration}
              supportDirectSign={canShowDirectSubmit}
              openFeePopup={openFeePopup}
              open={showMoreOpen}
              setOpen={setShowMoreOpen}
              sourceName={selectedBridgeQuote?.aggregator.name || ''}
              sourceLogo={selectedBridgeQuote?.aggregator.logo_url || ''}
              slippage={slippageState}
              displaySlippage={slippage}
              onSlippageChange={e => {
                setSlippageChanged(true);
                setSlippage(e);
              }}
              fromToken={fromToken}
              toToken={toToken}
              amount={amount || 0}
              toAmount={selectedBridgeQuote?.to_token_amount}
              openQuotesList={openQuotesList}
              quoteLoading={quoteLoading}
              slippageError={isSlippageHigh || isSlippageLow}
              autoSlippage={autoSlippage}
              isCustomSlippage={isCustomSlippage}
              setAutoSlippage={setAutoSlippage}
              setIsCustomSlippage={setIsCustomSlippage}
              type="bridge"
              isBestQuote={
                !!bestQuoteId &&
                !!selectedBridgeQuote &&
                bestQuoteId?.aggregatorId ===
                  selectedBridgeQuote.aggregator.id &&
                bestQuoteId?.bridgeId === selectedBridgeQuote.bridge_id
              }
            />
          )}
          {noQuote && (
            <>
              {recommendFromToken ? (
                <RecommendFromToken
                  token={recommendFromToken}
                  onOk={fillRecommendFromToken}
                />
              ) : (
                <>
                  <Text style={styles.noRecoomedTokenText}>
                    {t('page.bridge.no-quote-found')}
                  </Text>
                  <View style={{ marginHorizontal: 24, marginTop: 12 }}>
                    <BridgeSlippage
                      value={slippage}
                      displaySlippage={slippage}
                      onChange={e => {
                        setSlippageChanged(true);
                        setSlippage(e);
                      }}
                      autoSlippage={autoSlippage}
                      isCustomSlippage={isCustomSlippage}
                      setAutoSlippage={setAutoSlippage}
                      setIsCustomSlippage={setIsCustomSlippage}
                      type="bridge"
                      loading={quoteLoading}
                    />
                  </View>
                </>
              )}
            </>
          )}
        </View>
        {Boolean(
          !(selectedBridgeQuote && inSufficientCanGetQuote) &&
            !recommendFromToken,
        ) &&
          currentAccount?.address && (
            <BridgePendingTxItem userAddress={currentAccount?.address} />
          )}
      </KeyboardAwareScrollView>

      <View
        style={[
          styles.buttonContainer,
          {
            paddingBottom: Math.max(bottom, 50),
          },
        ]}>
        <Tip
          content={
            !isSupportedChain && externalDapps.length < 1
              ? t('component.externalSwapBrideDappPopup.noDapps')
              : undefined
          }>
          {canShowDirectSubmit ? (
            <DirectSignBtn
              key={`${selectedBridgeQuote?.aggregator.id}-${selectedBridgeQuote?.bridge?.id}-${refreshId}`}
              authTitle={t('page.whitelist.confirmPassword')}
              title={t('global.confirm')}
              loadingType="circle"
              onFinished={handleBridge}
              disabled={btnDisabled || !canDirectSign || miniSignLoading}
              type={'primary'}
              syncUnlockTime
              onBeforeAuth={() => {
                clearExpiredTimer();
              }}
              onCancel={() => {
                refresh(e => e + 1);
              }}
              account={currentAccount}
              showHardWalletProcess
              showRiskTips={showRiskTips && !btnDisabled && !miniSignLoading}
              loading={miniSignLoading}
              showTextOnLoading
            />
          ) : (
            <Button
              onPress={handleConfirm}
              title={btnText}
              titleStyle={styles.btnTitle}
              loading={fetchingBridgeQuote}
              disabled={
                !isSupportedChain && externalDapps.length > 0
                  ? false
                  : btnDisabled
              }
            />
          )}
        </Tip>
      </View>

      <TwpStepApproveModal
        open={twoStepApproveModalVisible}
        onCancel={() => {
          setTwoStepApproveModalVisible(false);
        }}
        onConfirm={handleBridge}
      />

      {fromToken && toToken && Number(amount) > 0 ? (
        <QuoteList
          list={quoteList}
          loading={quoteLoading}
          visible={quoteVisible}
          onClose={() => {
            setQuoteVisible(false);
          }}
          userAddress={currentAccount?.address || ''}
          // chain={chain}
          payToken={fromToken}
          payAmount={amount}
          receiveToken={toToken}
          inSufficient={inSufficient}
          setSelectedBridgeQuote={setSelectedBridgeQuote}
          currentSelectedQuote={selectedBridgeQuote}
        />
      ) : null}

      {/* <MiniApproval
        visible={isShowSign}
        txs={txs}
        ga={{
          category: 'Bridge',
          source: 'bridge',
          // trigger: rbiSource,
        }}
        onReject={() => {
          setIsShowSign(false);
          refresh(e => e + 1);
          mutateTxs([]);
        }}
        onResolve={() => {
          setTimeout(() => {
            setIsShowSign(false);
            mutateTxs([]);

            navigation.dispatch(
              StackActions.replace(RootNames.StackRoot, {
                screen: RootNames.Home,
              }),
            );
          }, 500);
        }}
      /> */}
    </NormalScreenContainer>
  );
};
