import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import { MiniApproval } from '@/components/Approval/components/MiniSignTx/MiniSignTx';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RabbyFeePopup } from '@/components/RabbyFeePopup';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { DEX_WITH_WRAP, SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { swapService } from '@/core/services';
import { useCurrentAccount } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import { useLastUsedAccountInScreen } from '@/hooks/useLastUsedAccountInScreen';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { DEX_ENUM, DEX_SPENDER_WHITELIST } from '@rabby-wallet/rabby-swap';
import {
  StackActions,
  useIsFocused,
  useNavigation,
  useNavigationState,
} from '@react-navigation/native';
import { useMemoizedFn, useRequest } from 'ahooks';
import BigNumber from 'bignumber.js';
import { useSetAtom } from 'jotai';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import useMount from 'react-use/lib/useMount';
import { ChainInfo2024 } from '../Send/components/ChainInfo2024';
import { SwapHeader } from './components/Header';
import { LowCreditModal } from './components/LowCreditModal';
import { QuoteList } from './components/Quotes';
import { TwpStepApproveModal } from './components/TwoStepApproveModal';
import {
  useDetectLoss,
  useSlippageStore,
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
import {
  PropsForAccountSwitchScreen,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { SwapTokenItem } from './components/Token';
import { Divider } from '@rneui/themed';
import BridgeSwitchBtn from '../Bridge/components/BridgeSwitchBtn';
import BridgeShowMore from '../Bridge/components/BridgeShowMore';
import useDebounceValue from '@/hooks/common/useDebounceValue';
import useDebounce from 'react-use/lib/useDebounce';
import { useSwapRecentToTokens } from './hooks/recent';
import { SWAP_SLIPPAGE } from '../Bridge/components/BridgeSlippage';

const isAndroid = Platform.OS === 'android';

const Swap = ({ isForMultipleAdderss }: PropsForAccountSwitchScreen) => {
  useLastUsedAccountInScreen({ disableAutoEffect: isForMultipleAdderss });
  const { t } = useTranslation();
  const keyboardAwareRef = useRef<KeyboardAwareScrollView>(null);

  const { colors2024, styles } = useTheme2024({ getStyle });

  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const headerRight = useCallback(() => <SwapHeader />, []);
  useEffect(() => {
    setNavigationOptions({
      headerRight,
    });
  }, [headerRight, setNavigationOptions]);

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

    gasList,
    passGasPrice,
    slider,
    onChangeSlider,

    showMoreVisible,

    lowCreditToken,
    lowCreditVisible,
    setLowCreditToken,
    setLowCreditVisible,

    swapUseSlider,
    clearExpiredTimer,
    finishedQuotes,
  } = useTokenPair(currentAccount!.address);

  const {
    autoSlippage,
    isCustomSlippage,
    setAutoSlippage,
    setIsCustomSlippage,
  } = useSlippageStore();

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
    s =>
      s.routes.find(
        r =>
          r.name ===
          (isForMultipleAdderss ? RootNames.MultiSwap : RootNames.Swap),
      )?.params,
  ) as
    | {
        chainEnum?: CHAINS_ENUM | undefined;
        tokenId?: TokenItem['id'];
        type?: 'Buy' | 'Sell';
        swapAgain?: boolean;
        swapTokenId?: TokenItem['id'][];
      }
    | undefined;

  useMount(() => {
    if (!navState?.chainEnum) {
      return;
    }

    const isBuy = navState?.type === 'Buy';
    const chainItem = findChainByEnum(navState?.chainEnum, { fallback: true });

    if (navState.swapAgain) {
      switchSwapAgain(
        chainItem?.enum || CHAINS_ENUM.ETH,
        navState?.swapTokenId?.[0]!,
        navState?.swapTokenId?.[1]!,
      );
      return;
    }

    switchChain(chainItem?.enum || CHAINS_ENUM.ETH, {
      payTokenId: navState?.tokenId,
      changeTo: isBuy,
    });
  });

  const btnText = useMemo(() => {
    if (quoteLoading) {
      return t('page.swap.title');
    }

    if (activeProvider?.shouldApproveToken) {
      return t('page.swap.approve-swap');
    }

    return t('page.swap.title');
  }, [activeProvider, quoteLoading, t]);

  const { safeOffBottom } = useSafeSizes();

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

  const showLoss = useDetectLoss({
    payToken: payToken,
    payAmount: payAmount,
    receiveRawAmount: activeProvider?.actualReceiveAmount || 0,
    receiveToken: receiveToken,
  });

  const [_, setRecentSwapToToken] = useSwapRecentToTokens();

  const handleSwap = useMemoizedFn(() => {
    if (receiveToken) {
      setRecentSwapToToken(receiveToken);
    }
    if (
      [
        KEYRING_TYPE.SimpleKeyring,
        KEYRING_TYPE.HdKeyring,
        KEYRING_CLASS.HARDWARE.LEDGER,
      ].includes((currentAccount?.type || '') as any) &&
      !receiveToken?.low_credit_score &&
      !receiveToken?.is_scam &&
      receiveToken?.is_verified !== false &&
      !isSlippageHigh &&
      !isSlippageLow &&
      !showLoss
    ) {
      runBuildSwapTxs();
      setIsShowSign(true);
      clearExpiredTimer();
    } else {
      gotoSwap();
    }
  });

  const chainServerId = useMemo(() => {
    return findChainByEnum(chain)?.serverId || CHAINS[chain].serverId;
  }, [chain]);

  const amountAvailable = useMemo(
    () => new BigNumber(payToken?.raw_amount_hex_str || 0, 16).gt(0),
    [payToken],
  );

  const navigation = useNavigation();
  const scrollToEnd = () => {
    keyboardAwareRef.current?.scrollToEnd(true);
  };

  const lowCreditInit = useRef(false);

  const isFocused = useIsFocused();

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
      !inSufficient &&
      amountAvailable &&
      !quoteLoading &&
      !!payToken &&
      !!receiveToken &&
      !activeProvider,
    [
      payAmount,
      inSufficient,
      amountAvailable,
      quoteLoading,
      payToken,
      receiveToken,
      activeProvider,
    ],
  );

  const noQuote = useDebounceValue(noQuoteOrigin, 10);

  useEffect(() => {
    if (noQuote) {
      setShowMoreOpen(true);
    }
  }, [noQuote]);

  useDebounce(
    () => {
      if (
        !isWrapToken &&
        Number(payAmount) > 0 &&
        !inSufficient &&
        amountAvailable &&
        !quoteLoading &&
        !!payToken &&
        !!receiveToken &&
        activeProvider &&
        Number(slippage) >= Number(SWAP_SLIPPAGE[1])
      ) {
        setShowMoreOpen(true);
      }
    },
    10,
    [
      showMoreVisible,
      isWrapToken,
      payAmount,
      inSufficient,
      amountAvailable,
      payToken,
      receiveToken,
      activeProvider,
      autoSlippage,
      activeProvider,
      quoteLoading,
    ],
  );

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

  return (
    <NormalScreenContainer2024 type="bg1">
      {isForMultipleAdderss && (
        <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
      )}
      <KeyboardAwareScrollView
        style={[
          styles.container,

          {
            marginBottom: 112 + (isAndroid ? 20 + safeOffBottom : 0),
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
            supportChains={SWAP_SUPPORT_CHAINS}
            hideTestnetTab
          />
          <View style={styles.swapContainer}>
            <View style={styles.flex1}>
              <Text style={styles.label}>{t('page.swap.token')}</Text>
            </View>
          </View>
          <View
            style={{
              borderRadius: 24,
              backgroundColor: colors2024['neutral-bg-2'],
              position: 'relative',
            }}>
            <SwapTokenItem
              inSufficient={inSufficient}
              slider={slider}
              onChangeSlider={onChangeSlider}
              value={payAmount}
              onValueChange={handleAmountChange}
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
              type={'from'}
              excludeTokens={receiveToken?.id ? [receiveToken?.id] : undefined}
            />
            <Divider color={colors2024['neutral-line']} />

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
              chainId={chainServerId}
              type={'to'}
              currentQuote={activeProvider}
              // placeholder={t('page.swap.search-by-name-address')}
              excludeTokens={payToken?.id ? [payToken?.id] : undefined}
              finishedQuotes={finishedQuotes}
            />
            <BridgeSwitchBtn
              onPress={exchangeToken}
              style={styles.arrowWrapper}
            />
          </View>

          {noQuote ? (
            <Text style={styles.errorTip}>{t('page.swap.no-quote-found')}</Text>
          ) : null}

          {showMoreVisible &&
            Number(payAmount) > 0 &&
            !inSufficient &&
            !!amountAvailable &&
            !!payToken &&
            !!receiveToken && (
              <View style={{ marginTop: 16, marginHorizontal: -24 }}>
                <BridgeShowMore
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
                />
              </View>
            )}
        </View>
      </KeyboardAwareScrollView>
      <View
        style={[
          styles.buttonContainer,
          isAndroid && { paddingBottom: safeOffBottom },
        ]}>
        <Button
          onPress={() => {
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
            quoteLoading ||
            !payToken ||
            !receiveToken ||
            !amountAvailable ||
            inSufficient ||
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
        ga={{
          category: 'Swap',
          source: 'swap',
          swapUseSlider,

          // trigger: rbiSource,
        }}
        onReject={() => {
          setIsShowSign(false);
          mutateTxs([]);
          refresh(e => e + 1);
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
    <Swap {...props} key={sceneCurrentAccountDepKey} isForMultipleAdderss />
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
  arrowWrapper: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -45 / 2 }, { translateY: -45 / 2 }],
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
    paddingHorizontal: 24,
    backgroundColor: colors2024['neutral-bg-1'],
    width: '100%',
    marginBottom: 56,
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
