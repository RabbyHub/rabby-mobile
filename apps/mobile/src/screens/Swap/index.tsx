import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createGetStyles } from '@/utils/styles';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { useNavigationState } from '@react-navigation/native';
import { SwapHeader } from './components/Header';
import { useThemeStyles } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { ChainInfo } from '../Send/components/ChainInfo';
import { RcIconSwapArrow } from '@/assets/icons/swap';
import { useSwapUnlimitedAllowance, useTokenPair } from './hooks';
import { useCurrentAccount } from '@/hooks/account';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import { CHAINS, CHAINS_ENUM } from '@debank/common';
import TokenSelect from './components/TokenSelect';
import { getTokenSymbol } from '@/utils/token';
import { formatAmount, formatUsdValue } from '@/utils/number';
import TouchableItem from '@/components/Touchable/TouchableItem';
import RcDangerIcon from '@/assets/icons/swap/info-error.svg';
import { Button } from '@/components';
import { DEX, SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { TwpStepApproveModal } from './components/TwoStepApproveModal';
import BigNumber from 'bignumber.js';
import { useQuoteVisible } from './hooks/atom';
import { ReceiveDetails } from './components/ReceiveDetail';
import { QuoteList } from './components/Quotes';
import { Slippage } from './components/Slippage';
import { DEX_ENUM, DEX_SPENDER_WHITELIST } from '@rabby-wallet/rabby-swap';
import { dexSwap } from './hooks/swap';
import { colord } from 'colord';
import { RootNames } from '@/constant/layout';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import useMount from 'react-use/lib/useMount';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';

const Swap = () => {
  const { t } = useTranslation();
  const { colors, styles } = useThemeStyles(getStyles);

  const { setNavigationOptions } = useSafeSetNavigationOptions();
  useEffect(() => {
    setNavigationOptions({
      headerRight: () => <SwapHeader />,
    });
  }, [setNavigationOptions]);

  const [twoStepApproveModalVisible, setTwoStepApproveModalVisible] =
    useState(false);

  const { currentAccount } = useCurrentAccount();

  const [visible, setVisible] = useQuoteVisible();

  const [unlimitedAllowance] = useSwapUnlimitedAllowance();

  const userAddress = currentAccount?.address;

  const {
    chain,
    switchChain,

    payToken,
    setPayToken,
    receiveToken,
    setReceiveToken,
    exchangeToken,

    handleAmountChange,
    handleBalance,
    payAmount,
    isWrapToken,
    inSufficient,
    slippageChanged,
    setSlippageChanged,
    slippageState,
    slippage,
    setSlippage,

    feeRate,

    quoteLoading,
    quoteList,

    currentProvider: activeProvider,
    setActiveProvider,
    slippageValidInfo,
    expired,
  } = useTokenPair(currentAccount!.address);

  const navState = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.Swap)?.params,
  ) as
    | { chainEnum?: CHAINS_ENUM | undefined; tokenId?: TokenItem['id'] }
    | undefined;

  useMount(() => {
    if (!navState?.chainEnum) {
      return;
    }

    const chainItem = findChainByEnum(navState?.chainEnum, { fallback: true });
    switchChain(chainItem?.enum || CHAINS_ENUM.ETH, {
      payTokenId: navState?.tokenId,
    });
  });

  const miniReceivedAmount = useMemo(() => {
    if (activeProvider?.quote?.toTokenAmount) {
      const receivedTokeAmountBn = new BigNumber(
        activeProvider?.quote?.toTokenAmount,
      ).div(
        10 **
          (activeProvider?.quote?.toTokenDecimals ||
            receiveToken?.decimals ||
            1),
      );
      return formatAmount(
        receivedTokeAmountBn
          .minus(receivedTokeAmountBn.times(slippage).div(100))
          .toString(10),
      );
    }
    return '';
  }, [
    activeProvider?.quote?.toTokenAmount,
    activeProvider?.quote?.toTokenDecimals,
    receiveToken?.decimals,
    slippage,
  ]);

  const DexDisplayName = useMemo(
    () => DEX?.[activeProvider?.name as keyof typeof DEX]?.name || '',
    [activeProvider?.name],
  );

  const btnText = useMemo(() => {
    if (slippageChanged) {
      return t('page.swap.slippage-adjusted-refresh-quote');
    }
    if (activeProvider && expired) {
      return t('page.swap.price-expired-refresh-quote');
    }
    if (activeProvider?.shouldApproveToken) {
      return t('page.swap.approve-and-swap', { name: DexDisplayName });
    }
    if (activeProvider?.name) {
      return t('page.swap.swap-via-x', {
        name: isWrapToken ? 'Wrap Contract' : DexDisplayName,
      });
    }

    return t('page.swap.get-quotes');
  }, [
    slippageChanged,
    activeProvider,
    expired,
    t,
    isWrapToken,
    DexDisplayName,
  ]);

  const { bottom } = useSafeAreaInsets();
  const gotoSwap = useCallback(async () => {
    if (!inSufficient && payToken && receiveToken && activeProvider?.quote) {
      try {
        dexSwap(
          {
            swapPreferMEVGuarded: false,
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
              dex_id: activeProvider?.name.replace('API', ''),
            },
          },
          {
            ga: {
              category: 'Swap',
              source: 'swap',
              trigger: 'home',
            },
          },
        );
      } catch (error) {
        console.error(error);
      }
    }
  }, [
    inSufficient,
    payToken,
    receiveToken,
    activeProvider?.quote,
    activeProvider?.shouldApproveToken,
    activeProvider?.name,
    activeProvider?.shouldTwoStepApprove,
    chain,
    unlimitedAllowance,
    payAmount,
    slippage,
  ]);

  return (
    <NormalScreenContainer>
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.container}
        enableOnAndroid
        extraHeight={200}
        keyboardOpeningTime={0}>
        <View style={styles.content}>
          <Text style={[styles.label, { marginBottom: 8 }]}>
            {t('page.swap.chain')}
          </Text>
          <ChainInfo
            chainEnum={chain}
            onChange={switchChain}
            supportChains={SWAP_SUPPORT_CHAINS}
          />
          <View style={styles.swapContainer}>
            <View style={styles.flex1}>
              <Text style={styles.label}>{t('page.swap.swap-from')}</Text>
            </View>
            <View style={styles.arrow} />

            <View style={styles.flex1}>
              <Text style={styles.label}>{t('page.swap.to')}</Text>
            </View>
          </View>
          <View style={styles.rowView}>
            <View style={styles.flex1}>
              <TokenSelect
                token={payToken}
                onTokenChange={token => {
                  const chainItem = findChainByServerID(token.chain);
                  if (chainItem?.enum !== chain) {
                    switchChain(chainItem?.enum || CHAINS_ENUM.ETH);
                    setReceiveToken(undefined);
                  }
                  setPayToken(token);
                }}
                chainId={CHAINS[chain].serverId}
                type={'swapFrom'}
                placeholder={t('page.swap.search-by-name-address')}
                excludeTokens={
                  receiveToken?.id ? [receiveToken?.id] : undefined
                }
              />
            </View>
            <TouchableItem onPress={exchangeToken}>
              <RcIconSwapArrow width={20} height={20} style={styles.arrow} />
            </TouchableItem>
            <View style={styles.flex1}>
              <TokenSelect
                token={receiveToken}
                onTokenChange={token => {
                  const chainItem = findChainByServerID(token.chain);
                  if (chainItem?.enum !== chain) {
                    switchChain(chainItem?.enum || CHAINS_ENUM.ETH);
                    setPayToken(undefined);
                  }
                  setReceiveToken(token);
                }}
                chainId={CHAINS[chain].serverId}
                type={'swapTo'}
                placeholder={t('page.swap.search-by-name-address')}
                excludeTokens={payToken?.id ? [payToken?.id] : undefined}
                useSwapTokenList
              />
            </View>
          </View>

          <View style={styles.amountInContainer}>
            <Text style={styles.label}>
              {t('page.swap.amount-in', {
                symbol: payToken ? getTokenSymbol(payToken) : '',
              })}
            </Text>
            <TouchableItem
              onPress={() => {
                // if (!payTokenIsNativeToken) {
                handleBalance();
                // }
              }}>
              <Text
                style={[
                  styles.label,
                  // !payTokenIsNativeToken &&
                  {
                    textDecorationLine: 'underline',
                  },
                ]}>
                {t('global.Balance')}: {formatAmount(payToken?.amount || 0)}
              </Text>
            </TouchableItem>
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

          {payAmount &&
            activeProvider &&
            activeProvider?.quote?.toTokenAmount &&
            payToken &&
            receiveToken && (
              <>
                <ReceiveDetails
                  activeProvider={activeProvider}
                  isWrapToken={isWrapToken}
                  payAmount={payAmount}
                  receiveRawAmount={activeProvider?.actualReceiveAmount}
                  payToken={payToken}
                  receiveToken={receiveToken}
                  quoteWarning={activeProvider?.quoteWarning}
                />

                {isWrapToken ? (
                  <View style={styles.afterWrapper}>
                    <View style={styles.flexRow}>
                      <Text style={styles.afterLabel}>
                        {t('page.swap.slippage-tolerance')}
                      </Text>
                      <Text style={styles.afterValue}>
                        {t('page.swap.no-slippage-for-wrap')}
                      </Text>
                    </View>
                    <View style={styles.flexRow}>
                      <Text style={styles.afterLabel}>
                        {t('page.swap.rabby-fee')}
                      </Text>
                      <Text style={styles.afterValue}>0%</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.afterWrapper}>
                    <Slippage
                      displaySlippage={slippage}
                      value={slippageState}
                      onChange={e => {
                        setSlippageChanged(true);
                        setSlippage(e);
                      }}
                      recommendValue={
                        slippageValidInfo?.is_valid
                          ? undefined
                          : slippageValidInfo?.suggest_slippage
                      }
                    />
                    <View style={styles.flexRow}>
                      <Text style={styles.afterLabel}>
                        {t('page.swap.minimum-received')}
                      </Text>
                      <Text style={styles.afterValue}>
                        {miniReceivedAmount}{' '}
                        {receiveToken ? getTokenSymbol(receiveToken) : ''}
                      </Text>
                    </View>
                    <View style={styles.flexRow}>
                      <Text style={styles.afterLabel}>
                        {t('page.swap.rabby-fee')}
                      </Text>
                      <Text style={styles.afterValue}>0.25%</Text>
                    </View>
                  </View>
                )}
              </>
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
            if (!activeProvider || expired || slippageChanged) {
              setVisible(true);
              return;
            }
            if (activeProvider?.shouldTwoStepApprove) {
              setTwoStepApproveModalVisible(true);
              return;
            }
            gotoSwap();
          }}
          title={btnText}
          titleStyle={styles.btnTitle}
          disabled={
            !payToken || !receiveToken || !payAmount || Number(payAmount) === 0
          }
        />
      </View>
      <TwpStepApproveModal
        open={twoStepApproveModalVisible}
        onCancel={() => {
          setTwoStepApproveModalVisible(false);
        }}
        onConfirm={gotoSwap}
      />
      {userAddress && payToken && receiveToken && chain ? (
        <QuoteList
          list={quoteList}
          loading={quoteLoading}
          visible={visible}
          onClose={() => {
            setVisible(false);
          }}
          userAddress={userAddress}
          chain={chain}
          slippage={slippage}
          payToken={payToken}
          payAmount={payAmount}
          receiveToken={receiveToken}
          fee={feeRate}
          inSufficient={inSufficient}
          setActiveProvider={setActiveProvider}
        />
      ) : null}
    </NormalScreenContainer>
  );
};

Swap.SwapHeader = SwapHeader;

const getStyles = createGetStyles(colors => ({
  container: {
    flex: 1,
  },
  content: {
    minHeight: 300,
    padding: 12,
    marginHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors['neutral-card-1'],
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    color: colors['neutral-body'],
  },
  rowView: {
    flexDirection: 'row',
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
    marginTop: 20,
    marginBottom: 8,
  },
  flex1: {
    flex: 1,
  },
  arrow: {
    marginHorizontal: 8,
    width: 20,
    height: 20,
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
    flexDirection: 'row',
    height: 52,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
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

  afterWrapper: {
    marginTop: 12,
    gap: 12,
    paddingHorizontal: 12,
  },
  afterLabel: {
    fontSize: 13,
    color: colors['neutral-body'],
  },
  afterValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },
  inSufficient: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 26,
    marginHorizontal: 20,
  },
  inSufficientText: {
    color: colors['red-default'],
    fontSize: 15,
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
  approveText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors['neutral-title-1'],
  },
  unlimitedText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors['neutral-foot'],
  },
  btnTitle: {
    color: colors['neutral-title-2'],
  },
}));

export default Swap;
