import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import {
  useAggregatorsList,
  useBridgeSupportedChains,
  useQuoteVisible,
  useSetQuoteVisible,
  useSetRefreshId,
  useTokenPair,
} from '../hooks';
import { useCurrentAccount } from '@/hooks/account';
import { useTranslation } from 'react-i18next';
import { ChainInfo } from '@/screens/Send/components/ChainInfo';
import { BridgeTokenPair } from './BridgeTokenPair';
import { TwpStepApproveModal } from '@/screens/Swap/components/TwoStepApproveModal';
import { getTokenSymbol } from '@/utils/token';
import { formatAmount } from '@/utils/math';
import { BestQuoteLoading } from './loading';
import RcArrowDown from '@/assets/icons/bridge/down.svg';
import { formatUsdValue } from '@/utils/number';
import BigNumber from 'bignumber.js';
import RcDangerIcon from '@/assets/icons/swap/info-error.svg';

import { BridgeReceiveDetails } from './BridgeReceiveDetail';
import { QuoteList } from './BridgeQuotes';
import { Button } from '@/components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { BridgeHeader } from './BridgeHeader';
import { openapi } from '@/core/request';
import pRetry from 'p-retry';
import { stats } from '@/utils/stats';
import { bridgeToken } from '../hooks/bridge';
import { toast } from '@/components/Toast';
import { RcIconMaxButton } from '@/assets/icons/swap';

const getStyles = createGetStyles(colors => ({
  container: {
    flex: 1,
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
    backgroundColor: colors['neutral-card-1'],
    borderRadius: 6,
    padding: 12,
    paddingTop: 0,
    marginHorizontal: 20,
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

  inSufficient: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginHorizontal: 20,
  },
  inSufficientText: {
    color: colors['red-default'],
    fontSize: 14,
    fontWeight: '500',
  },
  buttonContainer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors['neutral-bg-1'],
    width: '100%',
    padding: 20,
  },
  btnTitle: {
    color: colors['neutral-title-2'],
  },
}));

export const BridgeContent = () => {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();

  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

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
  const bridgeSupportedChains = useBridgeSupportedChains();
  const aggregators = useAggregatorsList();

  const aggregatorIds = useMemo(
    () => aggregators.map(e => e.id),
    [aggregators],
  );

  const quoteVisible = useQuoteVisible();

  const setQuoteVisible = useSetQuoteVisible();

  const {
    chain,
    switchChain,

    payToken,
    setPayToken,
    receiveToken,
    setReceiveToken,

    handleAmountChange,
    handleBalance,
    payAmount,
    inSufficient,

    openQuotesList,
    quoteLoading,
    quoteList,

    noBestQuote,

    bestQuoteId,
    selectedBridgeQuote,

    setSelectedBridgeQuote,
    expired,
  } = useTokenPair(currentAccount?.address || '');
  const refresh = useSetRefreshId();

  const [fetchingBridgeQuote, setFetchingBridgeQuote] = useState(false);

  const btnText = useMemo(() => {
    if (selectedBridgeQuote && expired) {
      return t('page.bridge.price-expired-refresh-route');
    }
    if (selectedBridgeQuote?.shouldApproveToken) {
      return t('page.bridge.approve-and-bridge', {
        name: selectedBridgeQuote?.aggregator.name || '',
      });
    }
    if (selectedBridgeQuote?.aggregator.name) {
      return t('page.bridge.bridge-via-x', {
        name: selectedBridgeQuote?.aggregator.name,
      });
    }

    return t('page.bridge.title');
  }, [selectedBridgeQuote, expired, t]);

  const gotoBridge = async () => {
    if (
      !inSufficient &&
      payToken &&
      receiveToken &&
      selectedBridgeQuote?.bridge_id &&
      currentAccount?.address
    ) {
      try {
        setFetchingBridgeQuote(true);
        const { tx } = await pRetry(
          () =>
            openapi.getBridgeQuote({
              aggregator_id: selectedBridgeQuote.aggregator.id,
              bridge_id: selectedBridgeQuote.bridge_id,
              from_token_id: payToken.id,
              user_addr: currentAccount?.address,
              from_chain_id: payToken.chain,
              from_token_raw_amount: new BigNumber(payAmount)
                .times(10 ** payToken.decimals)
                .toFixed(0, 1)
                .toString(),
              to_chain_id: receiveToken.chain,
              to_token_id: receiveToken.id,
            }),
          { retries: 1 },
        );
        stats.report('bridgeQuoteResult', {
          aggregatorIds: selectedBridgeQuote.aggregator.id,
          bridgeId: selectedBridgeQuote.bridge_id,
          fromChainId: payToken.chain,
          fromTokenId: payToken.id,
          toTokenId: receiveToken.id,
          toChainId: receiveToken.chain,
          status: tx ? 'success' : 'fail',
          payAmount: payAmount,
        });
        bridgeToken(
          {
            to: tx.to,
            value: tx.value,
            data: tx.data,
            payTokenRawAmount: new BigNumber(payAmount)
              .times(10 ** payToken.decimals)
              .toFixed(0, 1)
              .toString(),
            chainId: tx.chainId,
            shouldApprove: !!selectedBridgeQuote.shouldApproveToken,
            shouldTwoStepApprove: !!selectedBridgeQuote.shouldTwoStepApprove,
            payTokenId: payToken.id,
            payTokenChainServerId: payToken.chain,
            info: {
              aggregator_id: selectedBridgeQuote.aggregator.id,
              bridge_id: selectedBridgeQuote.bridge_id,
              from_chain_id: payToken.chain,
              from_token_id: payToken.id,
              from_token_amount: payAmount,
              to_chain_id: receiveToken.chain,
              to_token_id: receiveToken.id,
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
          fromChainId: payToken.chain,
          fromTokenId: payToken.id,
          toTokenId: receiveToken.id,
          toChainId: receiveToken.chain,
          status: 'fail',
          payAmount: payAmount,
        });
        console.error(error);
      } finally {
        setFetchingBridgeQuote(false);
      }
    }
  };

  return (
    <NormalScreenContainer>
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.container}
        enableOnAndroid
        extraHeight={200}
        keyboardOpeningTime={0}>
        <View style={styles.card}>
          <Text style={styles.subTitle}>{t('page.bridge.bridgeTo')}</Text>
          <ChainInfo
            chainEnum={chain}
            onChange={switchChain}
            supportChains={bridgeSupportedChains}
            style={{
              height: 60,
            }}
            titleStyle={{
              fontSize: 18,
            }}
            rightArrowIcon={<RcArrowDown width={24} height={24} />}
          />

          <Text style={styles.subTitle}>
            {t('page.bridge.BridgeTokenPair')}
          </Text>

          <View style={styles.flexRow}>
            <BridgeTokenPair
              onChange={value => {
                setPayToken(value.from);
                setReceiveToken(value.to);
              }}
              value={useMemo(
                () =>
                  payToken && receiveToken
                    ? {
                        from: payToken,
                        to: receiveToken,
                      }
                    : undefined,
                [payToken, receiveToken],
              )}
              aggregatorIds={aggregatorIds}
              chain={chain}
            />
          </View>

          <View style={[styles.flexRow, styles.tipsContainer]}>
            <Text style={styles.subTitle}>
              {t('page.bridge.Amount', {
                symbol: payToken ? getTokenSymbol(payToken) : '',
              })}
            </Text>
            <View style={payToken ? styles.balanceContainer : styles.hidden}>
              <Text style={styles.subTitle}>
                {t('global.Balance')}: {formatAmount(payToken?.amount || 0)}
              </Text>
              <TouchableOpacity
                style={[styles.subTitle, styles.maxBtn]}
                onPress={handleBalance}>
                <RcIconMaxButton />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              value={payAmount}
              onChangeText={handleAmountChange}
              keyboardType="numeric"
              inputMode="decimal"
              placeholder="0"
              numberOfLines={1}
              style={styles.input}
              placeholderTextColor={colors['neutral-foot']}
            />
            <Text style={styles.inputUsdValue}>
              {payAmount
                ? `≈ ${formatUsdValue(
                    new BigNumber(payAmount)
                      .times(payToken?.price || 0)
                      .toString(10),
                  )}`
                : ''}
            </Text>
          </View>

          {quoteLoading &&
            Number(payAmount) > 0 &&
            !inSufficient &&
            !selectedBridgeQuote?.manualClick && <BestQuoteLoading />}

          {payToken &&
            !inSufficient &&
            receiveToken &&
            Number(payAmount) > 0 &&
            (!quoteLoading || selectedBridgeQuote?.manualClick) && (
              <BridgeReceiveDetails
                openQuotesList={openQuotesList}
                activeProvider={selectedBridgeQuote}
                payAmount={payAmount}
                payToken={payToken}
                receiveToken={receiveToken}
                bestQuoteId={bestQuoteId}
                noBestQuote={noBestQuote}
              />
            )}
        </View>

        {inSufficient ? (
          <View style={styles.inSufficient}>
            <RcDangerIcon width={16} height={16} style={{ marginRight: 2 }} />

            <Text style={styles.inSufficientText}>
              {t('page.swap.insufficient-balance')}
            </Text>
          </View>
        ) : null}
      </KeyboardAwareScrollView>

      <View
        style={[
          styles.buttonContainer,
          {
            paddingBottom: Math.max(bottom, 20),
          },
        ]}>
        <Button
          onPress={() => {
            if (fetchingBridgeQuote) {
              return;
            }
            if (!selectedBridgeQuote || expired) {
              refresh(e => e + 1);

              return;
            }
            if (selectedBridgeQuote?.shouldTwoStepApprove) {
              setTwoStepApproveModalVisible(true);
              return;
            }
            gotoBridge();
          }}
          title={btnText}
          titleStyle={styles.btnTitle}
          loading={fetchingBridgeQuote}
          disabled={
            !payToken ||
            !receiveToken ||
            !Number(payAmount) ||
            inSufficient ||
            !selectedBridgeQuote
          }
        />
      </View>

      <TwpStepApproveModal
        open={twoStepApproveModalVisible}
        onCancel={() => {
          setTwoStepApproveModalVisible(false);
        }}
        onConfirm={gotoBridge}
      />

      {payToken && receiveToken && Number(payAmount) > 0 && chain ? (
        <QuoteList
          list={quoteList}
          loading={quoteLoading}
          visible={quoteVisible}
          onClose={() => {
            setQuoteVisible(false);
          }}
          userAddress={currentAccount?.address || ''}
          chain={chain}
          payToken={payToken}
          payAmount={payAmount}
          receiveToken={receiveToken}
          inSufficient={inSufficient}
          setSelectedBridgeQuote={setSelectedBridgeQuote}
        />
      ) : null}
    </NormalScreenContainer>
  );
};
