import { RcIconMaxButton, RcIconSwapArrow } from '@/assets/icons/swap';
import RcDangerIcon from '@/assets/icons/swap/info-error.svg';
import { AppSwitch, Button, Tip } from '@/components';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RabbyFeePopup } from '@/components/RabbyFeePopup';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { RootNames } from '@/constant/layout';
import { DEX, SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { swapService } from '@/core/services';
import { useCurrentAccount } from '@/hooks/account';
import { useThemeStyles } from '@/hooks/theme';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { DEX_ENUM, DEX_SPENDER_WHITELIST } from '@rabby-wallet/rabby-swap';
import { useNavigationState } from '@react-navigation/native';
import { useMemoizedFn, useRequest } from 'ahooks';
import BigNumber from 'bignumber.js';
import { useSetAtom } from 'jotai';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useMount from 'react-use/lib/useMount';
import { BestQuoteLoading } from '../Bridge/components/loading';
import { ChainInfo } from '../Send/components/ChainInfo';
import { SwapHeader } from './components/Header';
import { QuoteList } from './components/Quotes';
import { ReceiveDetails } from './components/ReceiveDetail';
import { Slippage } from './components/Slippage';
import TokenSelect from './components/TokenSelect';
import { TwpStepApproveModal } from './components/TwoStepApproveModal';
import { useSwapUnlimitedAllowance, useTokenPair } from './hooks';
import {
  refreshIdAtom,
  useQuoteVisible,
  useRabbyFeeVisible,
} from './hooks/atom';
import { dexSwap } from './hooks/swap';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { ReserveGasPopup } from '@/components/ReserveGasPopup';

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
    bestQuoteDex,
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
    payTokenIsNativeToken,

    feeRate,

    openQuotesList,
    quoteLoading,
    quoteList,

    currentProvider: activeProvider,
    setActiveProvider,
    slippageValidInfo,
    expired,

    gasLevel,
    gasLimit,
    changeGasPrice,
    gasList,
    reserveGasOpen,
    closeReserveGasOpen,
  } = useTokenPair(currentAccount!.address);

  const refresh = useSetAtom(refreshIdAtom);
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
    if (quoteLoading) {
      return t('page.swap.title');
    }

    return t('page.swap.title');
  }, [
    slippageChanged,
    activeProvider,
    expired,
    quoteLoading,
    t,
    DexDisplayName,
    isWrapToken,
  ]);

  const { bottom } = useSafeAreaInsets();
  const gotoSwap = useMemoizedFn(async () => {
    if (!inSufficient && payToken && receiveToken && activeProvider?.quote) {
      try {
        dexSwap(
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
            gasPrice: payTokenIsNativeToken
              ? gasList?.find(e => e.level === gasLevel)?.price
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
              dex_id: activeProvider?.name.replace('API', '') || 'WrapToken',
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
  });

  const chainServerId = useMemo(() => {
    return findChainByEnum(chain)?.serverId || CHAINS[chain].serverId;
  }, [chain]);

  const FeeAndMEVGuarded = (
    <>
      {showMEVGuardedSwitch && (
        <View style={styles.flexRow}>
          <Tip content={t('page.swap.preferMEVTip')}>
            <Text style={styles.afterLabel}>{t('page.swap.preferMEV')}</Text>
          </Tip>
          <Tip content={t('page.swap.preferMEVTip')}>
            <AppSwitch
              value={originPreferMEVGuarded}
              onValueChange={switchPreferMEV}
            />
          </Tip>
        </View>
      )}
    </>
  );

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
                chainId={chainServerId}
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
                chainId={chainServerId}
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
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center' }}
              onPress={handleBalance}>
              <Text style={[styles.label]}>
                {t('global.Balance')}: {formatAmount(payToken?.amount || 0)}
              </Text>
              <TouchableOpacity style={[styles.maxBtn]} onPress={handleBalance}>
                <RcIconMaxButton width={34} height={16} />
              </TouchableOpacity>
            </TouchableOpacity>
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
          payToken &&
          receiveToken &&
          Number(payAmount) > 0 &&
          !inSufficient &&
          !activeProvider?.manualClick ? (
            <BestQuoteLoading />
          ) : null}
          {Number(payAmount) > 0 &&
          !inSufficient &&
          (!quoteLoading || (activeProvider && !!activeProvider.manualClick)) &&
          payToken &&
          receiveToken ? (
            <>
              <ReceiveDetails
                bestQuoteDex={bestQuoteDex}
                activeProvider={activeProvider}
                isWrapToken={isWrapToken}
                payAmount={payAmount}
                receiveRawAmount={activeProvider?.actualReceiveAmount || 0}
                payToken={payToken}
                receiveToken={receiveToken}
                quoteWarning={activeProvider?.quoteWarning}
                chain={chain}
                openQuotesList={openQuotesList}
              />
            </>
          ) : null}

          {Number(payAmount) > 0 &&
          (!quoteLoading || !!activeProvider?.manualClick) &&
          !!activeProvider &&
          !!activeProvider?.quote?.toTokenAmount &&
          payToken &&
          receiveToken ? (
            <>
              {isWrapToken ? (
                <>
                  <View style={styles.afterWrapper}>
                    <View style={styles.flexRow}>
                      <Text style={styles.afterLabel}>
                        {t('page.swap.slippage-tolerance')}
                      </Text>
                      <Text style={styles.afterValue}>
                        {t('page.swap.no-slippage-for-wrap')}
                      </Text>
                    </View>
                    {FeeAndMEVGuarded}
                  </View>
                </>
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
                  {FeeAndMEVGuarded}
                </View>
              )}
            </>
          ) : null}
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
              refresh(e => e + 1);
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
            !payToken ||
            !receiveToken ||
            !payAmount ||
            Number(payAmount) === 0 ||
            !activeProvider
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
      <ReserveGasPopup
        selectedItem={gasLevel}
        chain={chain}
        limit={gasLimit}
        onGasChange={changeGasPrice}
        gasList={gasList}
        visible={reserveGasOpen}
        onClose={closeReserveGasOpen}
        rawHexBalance={payToken?.raw_amount_hex_str}
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
  maxBtn: {
    marginLeft: 6,
  },
}));

export default Swap;
