import { RcIconSwapArrow } from '@/assets/icons/swap';
import { AppSwitch, Tip } from '@/components';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import { MiniApproval } from '@/components/Approval/components/MiniSignTx/MiniSignTx';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RabbyFeePopup } from '@/components/RabbyFeePopup';
import { ReserveGasPopup } from '@/components/ReserveGasPopup';
import TouchableItem from '@/components/Touchable/TouchableItem';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { DEX, SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { swapService } from '@/core/services';
import { useCurrentAccount } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { useLastUsedAccountInScreen } from '@/hooks/useLastUsedAccountInScreen';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import { formatAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { DEX_ENUM, DEX_SPENDER_WHITELIST } from '@rabby-wallet/rabby-swap';
import {
  StackActions,
  useNavigation,
  useNavigationState,
} from '@react-navigation/native';
import { useMemoizedFn, useRequest } from 'ahooks';
import BigNumber from 'bignumber.js';
import { useSetAtom } from 'jotai';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useMount from 'react-use/lib/useMount';
import { BestQuoteLoading } from '../Bridge/components/loading';
import { ChainInfo2024 } from '../Send/components/ChainInfo2024';
import { SwapHeader } from './components/Header';
import { LowCreditModal, useLowCreditState } from './components/LowCreditModal';
import { QuoteList } from './components/Quotes';
import { ReceiveDetails } from './components/ReceiveDetail';
import { Slippage } from './components/Slippage';
import TokenSelect from './components/TokenSelect';
import { TwpStepApproveModal } from './components/TwoStepApproveModal';
import {
  useDetectLoss,
  useSwapUnlimitedAllowance,
  useTokenPair,
} from './hooks';
import {
  refreshIdAtom,
  useQuoteVisible,
  useRabbyFeeVisible,
} from './hooks/atom';
import { buildDexSwap, dexSwap } from './hooks/swap';
import { Button } from '@/components2024/Button';
import { PropsForAccountSwitchScreen } from '@/hooks/accountsSwitcher';

const Swap = ({ isForMultipleAdderss }: PropsForAccountSwitchScreen) => {
  useLastUsedAccountInScreen({ disableAutoEffect: isForMultipleAdderss });
  const { t } = useTranslation();

  const { colors2024, styles } = useTheme2024({ getStyle });

  const { setNavigationOptions } = useSafeSetNavigationOptions();
  useEffect(() => {
    setNavigationOptions({
      headerRight: SwapHeader,
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
    isSlippageHigh,
    isSlippageLow,

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
    passGasPrice,
  } = useTokenPair(currentAccount!.address);

  const refresh = useSetAtom(refreshIdAtom);
  const [
    { visible: isShowRabbyFeePopup, dexName, dexFeeDesc },
    setIsShowRabbyFeePopup,
  ] = useRabbyFeeVisible();

  const {
    lowCreditToken,
    lowCreditVisible,
    setLowCreditToken,
    setLowCreditVisible,
  } = useLowCreditState();

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
    s =>
      s.routes.find(
        r =>
          r.name ===
          (isForMultipleAdderss ? RootNames.MultiSwap : RootNames.Swap),
      )?.params,
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

  const [isShowSign, setIsShowSign] = useState(false);
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
            gasPrice:
              payTokenIsNativeToken && passGasPrice
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

  const {
    data: txs,
    runAsync: runBuildSwapTxs,
    mutate: mutateTxs,
  } = useRequest(buildSwapTxs, {
    manual: true,
  });

  const showLoss = useDetectLoss({
    payToken: payToken,
    payAmount: payAmount,
    receiveRawAmount: activeProvider?.actualReceiveAmount || 0,
    receiveToken: receiveToken,
  });

  const handleSwap = useMemoizedFn(() => {
    if (
      [
        KEYRING_TYPE.SimpleKeyring,
        KEYRING_TYPE.HdKeyring,
        KEYRING_CLASS.HARDWARE.LEDGER,
      ].includes((currentAccount?.type || '') as any) &&
      !isSlippageHigh &&
      !isSlippageLow &&
      !showLoss
    ) {
      runBuildSwapTxs();
      setIsShowSign(true);
    } else {
      gotoSwap();
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

  const payTokenAmountAvailable = useMemo(
    () => new BigNumber(payToken?.raw_amount_hex_str || 0, 16).gt(0),
    [payToken],
  );

  const navigation = useNavigation();

  return (
    <NormalScreenContainer2024 type="bg1">
      {isForMultipleAdderss && (
        <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
      )}
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.container}
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
            supportChains={SWAP_SUPPORT_CHAINS}
          />
          <View style={styles.swapContainer}>
            <View style={styles.flex1}>
              <Text style={styles.label}>{t('page.swap.from')}</Text>
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
            <TouchableItem style={styles.arrowWrapper} onPress={exchangeToken}>
              <RcIconSwapArrow width={22} height={22} style={styles.arrow} />
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

                  if (token?.low_credit_score) {
                    setLowCreditToken(token);
                    setLowCreditVisible(true);
                  }
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
            <Text style={styles.label}>Amount:</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center' }}
              onPress={() => {
                if (payTokenAmountAvailable) {
                  handleBalance();
                }
              }}>
              <Text
                style={[styles.balanceText, inSufficient && styles.errorTip]}>
                {inSufficient
                  ? t('page.swap.insufficient-balance')
                  : t('global.Balance')}
                : {formatAmount(payToken?.amount || 0)}
              </Text>
              {payTokenAmountAvailable && (
                <TouchableOpacity
                  style={[styles.maxBtn]}
                  onPress={handleBalance}>
                  <Text style={styles.maxButtonText}>MAX</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                value={payAmount}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
                inputMode="decimal"
                placeholder="0"
                numberOfLines={1}
                style={styles.input}
                placeholderTextColor={colors2024['neutral-foot']}
              />
            </View>
            <Text style={styles.inputUsdValue}>
              {payAmount
                ? `≈ ${formatUsdValue(
                    new BigNumber(payAmount)
                      .times(payToken?.price || 0)
                      .toString(10),
                  )}`
                : '≈$0'}
            </Text>
          </View>
          {quoteLoading &&
          payToken &&
          receiveToken &&
          Number(payAmount) > 0 &&
          !inSufficient &&
          !activeProvider?.manualClick ? (
            <View style={styles.loadingQuoteContainer}>
              <BestQuoteLoading />
            </View>
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
            // gotoSwap();
            handleSwap();
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
        onConfirm={handleSwap}
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
      <MiniApproval
        visible={isShowSign}
        txs={txs}
        onReject={() => {
          setIsShowSign(false);
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

      <LowCreditModal
        token={lowCreditToken}
        visible={lowCreditVisible}
        onCancel={() => setLowCreditVisible(false)}
      />
    </NormalScreenContainer2024>
  );
};

Swap.ForMultipleAddress = (
  props: Omit<
    React.ComponentProps<typeof Swap>,
    keyof PropsForAccountSwitchScreen
  >,
) => {
  return <Swap {...props} isForMultipleAdderss />;
};

Swap.SwapHeader = SwapHeader;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
  },
  content: {
    minHeight: 300,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: colors2024['neutral-card-1'],
  },
  label: {
    fontSize: 17,
    lineHeight: 22,
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
    color: colors2024['red-default'],
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
    marginTop: 16,
    marginBottom: 12,
  },
  flex1: {
    flex: 1,
  },
  arrowWrapper: {
    width: 45,
    height: 45,
    borderWidth: 0.7,
    borderColor: colors2024['neutral-line'],
    borderRadius: 100,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
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
    backgroundColor: colors2024['neutral-bg-1'],
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
    color: colors2024['neutral-title-1'],
  },
  unlimitedText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  btnTitle: {
    color: colors2024['neutral-title-2'],
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
