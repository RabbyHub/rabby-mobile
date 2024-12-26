import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useQuoteVisible, useSetQuoteVisible, useSetRefreshId } from '../hooks';
import { useCurrentAccount } from '@/hooks/account';
import { useTranslation } from 'react-i18next';
import { TwpStepApproveModal } from '@/screens/Swap/components/TwoStepApproveModal';
import BigNumber from 'bignumber.js';
import { QuoteList } from './BridgeQuotes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { BridgeHeader } from './BridgeHeader';
import { openapi } from '@/core/request';
import pRetry from 'p-retry';
import { stats } from '@/utils/stats';
import { bridgeToken, buildBridgeToken } from '../hooks/bridge';
import { toast } from '@/components/Toast';
import { useMemoizedFn, useRequest } from 'ahooks';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { MiniApproval } from '@/components/Approval/components/MiniSignTx/MiniSignTx';
import { StackActions, useNavigation } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import BridgeToken from './BridgeToken';
import BridgeSwitchBtn from './BridgeSwitchBtn';
import { findChainByEnum } from '@/utils/chain';
import BridgeShowMore, { RecommendFromToken } from './BridgeShowMore';
import { useBridge } from '../hooks/token';
import { Button } from '@/components2024/Button';
import { ReserveGasPopup } from '@/components/ReserveGasPopup';
import { CHAINS_ENUM } from '@debank/common';

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  screen: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  container: {
    flex: 1,
    paddingTop: 16,
    paddingBottom: 20,
    // marginBottom: 12,
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
    // position: 'absolute',
    // left: 0,
    // bottom: 0,
    height: 140,
    backgroundColor: colors2024['neutral-bg-1'],
    width: '100%',
    padding: 20,
  },
  btnTitle: {
    color: colors['neutral-title-2'],
  },
}));

export const BridgeContent = ({ isForMultipleAdderss = false }) => {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const { colors2024, styles, colors } = useTheme2024({ getStyle });

  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const Header = useCallback(() => <BridgeHeader />, []);
  useEffect(() => {
    setNavigationOptions({
      headerRight: Header,
    });
  }, [Header, setNavigationOptions]);

  const [twoStepApproveModalVisible, setTwoStepApproveModalVisible] =
    useState(false);

  const { currentAccount } = useCurrentAccount();

  const quoteVisible = useQuoteVisible();

  const setQuoteVisible = useSetQuoteVisible();

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
    quoteLoading,
    quoteList,

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
  } = useBridge();
  const [showMoreOpen, setShowMoreOpen] = useState(false);
  const refresh = useSetRefreshId();

  const [fetchingBridgeQuote, setFetchingBridgeQuote] = useState(false);

  const [isShowSign, setIsShowSign] = useState(false);

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
        const { tx } = await pRetry(
          () =>
            openapi.getBridgeQuoteTxV2({
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
        bridgeToken(
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
                ? gasList?.find(e => e.level === gasLevel)?.price
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
            },
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
        console.error(error);
      } finally {
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
        setFetchingBridgeQuote(true);
        const { tx } = await pRetry(
          () =>
            openapi.getBridgeQuoteTxV2({
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
                ? gasList?.find(e => e.level === gasLevel)?.price
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
            },
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
        console.error(error);
      } finally {
        setFetchingBridgeQuote(false);
      }
    }
  };

  const {
    data: txs,
    runAsync: runBuildTxs,
    mutate: mutateTxs,
  } = useRequest(buildTxs, {
    manual: true,
  });

  const handleBridge = useMemoizedFn(async () => {
    if (
      !toToken?.low_credit_score &&
      [
        KEYRING_TYPE.SimpleKeyring,
        KEYRING_TYPE.HdKeyring,
        KEYRING_CLASS.HARDWARE.LEDGER,
      ].includes((currentAccount?.type || '') as any)
    ) {
      await runBuildTxs();
      setIsShowSign(true);
      clearExpiredTimer();
    } else {
      gotoBridge();
    }
  });

  const amountAvailable = useMemo(() => Number(amount) > 0, [amount]);

  const noQuote =
    !inSufficient &&
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

  const btnText = useMemo(() => {
    if (btnDisabled) {
      return t('page.bridge.title');
    }

    if (selectedBridgeQuote?.shouldApproveToken) {
      return t('page.bridge.approve-and-bridge');
    }
    return t('page.bridge.title');
  }, [t, selectedBridgeQuote?.shouldApproveToken, btnDisabled]);

  const navigation = useNavigation();

  const handleConfirm = () => {
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

  return (
    <NormalScreenContainer overwriteStyle={styles.screen}>
      {isForMultipleAdderss && (
        <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
      )}
      <KeyboardAwareScrollView
        style={styles.container}
        enableOnAndroid
        scrollEnabled
        extraHeight={52}
        keyboardOpeningTime={0}>
        <View style={styles.card}>
          <View style={styles.cardContainer}>
            <BridgeToken
              type="from"
              inSufficient={inSufficient}
              chain={fromChain}
              token={fromToken}
              isMaxRef={isMaxRef}
              clickMaxBtnCount={clickMaxBtnCount}
              handleMax={handleMax}
              onChangeToken={item => {
                handleAmountChange('');
                setFromToken(item);
              }}
              onChangeChain={switchFromChain}
              value={amount}
              onInputChange={handleAmountChange}
              excludeChains={toChain ? [toChain] : undefined}
            />
            <BridgeToken
              type="to"
              chain={toChain}
              token={toToken}
              onChangeToken={setToToken}
              onChangeChain={setToChain}
              fromChainId={
                fromToken?.chain || findChainByEnum(fromChain)?.serverId
              }
              fromTokenId={fromToken?.id}
              valueLoading={quoteLoading}
              value={selectedBridgeQuote?.to_token_amount}
              excludeChains={fromChain ? [fromChain] : undefined}
              noQuote={noQuote}
            />
            <BridgeSwitchBtn
              style={styles.switchButtonContainer}
              onPress={switchToken}
            />
          </View>
        </View>

        <View>
          {selectedBridgeQuote && (
            <BridgeShowMore
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
                <Text style={styles.noRecoomedTokenText}>
                  {t('page.bridge.no-quote-found')}
                </Text>
              )}
            </>
          )}
        </View>
      </KeyboardAwareScrollView>

      <View
        style={[
          styles.buttonContainer,
          {
            paddingBottom: Math.max(bottom, 50),
          },
        ]}>
        <Button
          onPress={handleConfirm}
          title={btnText}
          titleStyle={styles.btnTitle}
          loading={fetchingBridgeQuote}
          disabled={btnDisabled}
        />
      </View>

      <TwpStepApproveModal
        open={twoStepApproveModalVisible}
        onCancel={() => {
          setTwoStepApproveModalVisible(false);
        }}
        onConfirm={handleBridge}
      />

      <ReserveGasPopup
        selectedItem={gasLevel}
        chain={fromChain || CHAINS_ENUM.ETH}
        limit={gasLimit}
        onGasChange={changeGasPrice}
        gasList={gasList}
        visible={reserveGasOpen}
        onClose={closeReserveGasOpen}
        rawHexBalance={fromToken?.raw_amount_hex_str}
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
        />
      ) : null}

      <MiniApproval
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
      />
    </NormalScreenContainer>
  );
};
