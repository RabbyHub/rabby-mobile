import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  StyleSheet,
  View,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import {
  StackActions,
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { GetNestedScreenRouteProp } from '@/navigation-type';
import { RootNames } from '@/constant/layout';
import { SignatureInstanceProvider } from '@/components2024/MiniSignV2/state/SignatureInstanceContext';
import {
  apiSendToken,
  getSendChainToken,
  SendTokenEvents,
  SendTokenInternalContextProvider,
  useSendTokenCanSubmit,
  useSendTokenForm,
  useSendTokenInternalShallowSelector,
  useSendTokenScreenChainToken,
  useSendTokenScreenStateShallowSelector,
} from './hooks/useSendToken';
import BottomArea from './components/BottomArea';
import {
  findChainByEnum,
  findChainByID,
  findChainByServerID,
  makeTokenFromChain,
} from '@/utils/chain';
import { getLastTimeSendToken } from '@/core/serviceApi/preference';
import type {
  TokenItem,
  TokenItemWithEntity,
} from '@rabby-wallet/rabby-api/dist/types';
import { apiPageStateCache } from '@/core/apis';
import { useLoadMatteredChainBalances } from '@/hooks/accountChainBalance';
import { redirectBackErrorHandler } from '@/utils/navigation';
import { BalanceSection } from './Section';
import { formatSendTokenBalanceText } from './utils';
import { createGetStyles2024 } from '@/utils/styles';
import { useContactAccounts } from '@/hooks/contact';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { toastLoading } from '@/components2024/Toast';
import { sleep } from '@/utils/async';
import BigNumber from 'bignumber.js';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import type { PropsForAccountSwitchScreen } from '@/hooks/accountsSwitcher';
import {
  ScreenSceneAccountProvider,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';
import { useTranslation } from 'react-i18next';
import ToAddressControl2024 from './components/ToAddressControl2024';
import { TokenInfoPopup } from '../Swap/components/TokenInfoPopup';
import { openapi } from '@/core/request';
import { BlockedAddressDialog } from '@/components/Dialogs/BlockedAddressDialog';
import FromAddressControl2024 from './components/FromAddressControl';
import { useAtomValue } from 'jotai';
import { sendScreenParamsAtom } from '@/hooks/useSendRoutes';
import { getAddrDescWithCexLocalCacheSync } from '@/databases/hooks/cex';
import { SendHeaderRight } from './SubScreens/SelectPolyScreen/HeaderRight';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { getRecommendToken } from '@/utils/addressSupport';
import { lowcaseSame } from '@/utils/common';
import { ShowMoreOnSend } from './components/ShowMoreOnSend';
import { PendingTxItem } from '../Swap/components/PendingTxItem';
import type { SendTxHistoryItem } from '@/core/services/transactionHistory';
import { useRecentSendPendingTx } from './hooks/useRecentSend';
import { useClearMiniGasStateEffect } from '@/hooks/miniSignGasStore';
import { globalSupportCexList } from '@/hooks/useCexSupportList';
import { isValidHexAddress } from '@metamask/utils';
import { type ITokenCheck } from '@/components/Token/TokenSelectorSheetModal';
import { useRendererDetect } from '@/components/Perf/PerfDetector';
import { E2E_ID } from '@/constant/e2e';
import { makeTestIDProps } from '@/utils/makeTestIDProps';
import Animated from 'react-native-reanimated';
import { markStartupPerf } from '@/core/utils/startupPerfMarks';
import {
  claimSendScreenSession,
  getSendScreenActivationPlan,
  isSendScreenSessionActive,
  releaseSendScreenSession,
  type SendScreenSession,
} from './sendScreenSession';

const AnimatedKeyboardAwareScrollView = Animated.createAnimatedComponent(
  KeyboardAwareScrollView,
);

const EMPTY_TOKEN_ITEM = {
  decimals: 18,
  logo_url: '',
  symbol: '',
  display_symbol: '',
  optimized_symbol: '',
  is_core: false,
  is_verified: false,
  is_wallet: false,
  is_scam: false,
  is_suspicious: false,
  name: '',
  time_at: 0,
  amount: 0,
  price: 0,
};

const SEND_SCREEN_RENDER_MARK_LIMIT = 20;
let sendScreenRenderSeq = 0;

function markSendScreenPerf(event: string, data: Record<string, unknown> = {}) {
  markStartupPerf('sendScreen', event, data);
}

function markSendScreenRenderPerf(
  renderSeq: number,
  event: string,
  data: Record<string, unknown> = {},
) {
  if (renderSeq > SEND_SCREEN_RENDER_MARK_LIMIT) {
    return;
  }

  markSendScreenPerf(event, {
    renderSeq,
    ...data,
  });
}

markSendScreenPerf('module_loaded');

function getInitialDisplayToken(token: TokenItem): TokenItem | null {
  const chain = findChainByServerID(token.chain);
  if (chain && lowcaseSame(token.id, chain.nativeTokenAddress)) {
    return makeTokenFromChain(chain);
  }

  if (token.optimized_symbol || token.display_symbol || token.symbol) {
    return token;
  }

  return null;
}

const SendPendingTxItem = React.memo(function SendPendingTxItem({
  clearLocalPendingTxData,
  isForMultipleAddress,
  localPendingTxData,
}: {
  clearLocalPendingTxData: () => void;
  isForMultipleAddress: boolean;
  localPendingTxData: SendTxHistoryItem | null;
}) {
  const canSubmit = useSendTokenCanSubmit();
  const { account } = useSendTokenInternalShallowSelector(ctx => ({
    account: ctx.computed.account,
  }));

  if (!localPendingTxData || canSubmit) {
    return null;
  }

  return (
    <PendingTxItem
      isForMultipleAddress={isForMultipleAddress}
      data={localPendingTxData}
      account={account}
      type="send"
      clearLocalPendingTxData={clearLocalPendingTxData}
    />
  );
});

const SendScreenBody = React.memo(function SendScreenBody({
  clearLocalPendingTxData,
  isForMultipleAddress,
  isShowBlockedTransactionDialog,
  localPendingTxData,
}: {
  clearLocalPendingTxData: () => void;
  isForMultipleAddress: boolean;
  isShowBlockedTransactionDialog: boolean;
  localPendingTxData: SendTxHistoryItem | null;
}) {
  const navigation = useNavigation();
  const { styles } = useTheme2024({ getStyle });
  const { scrollViewRef, scrollViewStyle, sendTokenEvents } =
    useSendTokenInternalShallowSelector(ctx => ({
      scrollViewRef: ctx.scrollViewRef,
      scrollViewStyle: ctx.scrollViewStyle,
      sendTokenEvents: ctx.sendTokenEvents,
    }));

  const toAddressControlStyle = useMemo(
    () => ({
      marginTop: 16,
      marginBottom: 0,
    }),
    [],
  );

  const mainContentStyle = useMemo(
    () => [styles.mainContent, scrollViewStyle],
    [scrollViewStyle, styles.mainContent],
  );

  const handlePressDismiss = useCallback(() => {
    sendTokenEvents.emit(SendTokenEvents.ON_PRESS_DISMISS);
    Keyboard.dismiss();
  }, [sendTokenEvents]);

  const handleScrollViewRef = useCallback(
    (instance: any) => {
      scrollViewRef.current = instance as unknown as KeyboardAwareScrollView;
    },
    [scrollViewRef],
  );

  const handleBlockedTransactionConfirm = useCallback(() => {
    navigation.dispatch(
      StackActions.replace(RootNames.StackRoot, {
        screen: RootNames.Home,
      }),
    );
  }, [navigation]);

  return (
    <View style={styles.screenRoot} {...makeTestIDProps(E2E_ID.send.screen)}>
      <NormalScreenContainer2024
        type="bg1"
        // overwriteStyle={styles.screenContainer}
      >
        <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
        <TouchableWithoutFeedback onPress={handlePressDismiss}>
          <ScrollView contentContainerStyle={styles.sendScreen}>
            <AnimatedKeyboardAwareScrollView
              innerRef={handleScrollViewRef}
              contentContainerStyle={mainContentStyle}>
              <View>
                <FromAddressControl2024 disableSwitch={false} />
                <ToAddressControl2024
                  style={toAddressControlStyle}
                  // brandName={navParams?.addressBrandName}
                />
                <BalanceSection style={styles.balance} />
                <ShowMoreOnSend />
              </View>
              <SendPendingTxItem
                clearLocalPendingTxData={clearLocalPendingTxData}
                isForMultipleAddress={isForMultipleAddress}
                localPendingTxData={localPendingTxData}
              />
            </AnimatedKeyboardAwareScrollView>
            <BottomArea />
          </ScrollView>
        </TouchableWithoutFeedback>
        <TokenInfoPopup />
        <BlockedAddressDialog
          visible={isShowBlockedTransactionDialog}
          onConfirm={handleBlockedTransactionConfirm}
        />
      </NormalScreenContainer2024>
    </View>
  );
});

function SendScreen({
  isForMultipleAddress = false,
}: PropsForAccountSwitchScreen): JSX.Element {
  const renderSeq = ++sendScreenRenderSeq;
  markSendScreenRenderPerf(renderSeq, 'render_start', {
    isForMultipleAddress,
  });

  const navigation = useNavigation();
  const { t } = useTranslation();
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const [isShowBlockedTransactionDialog, setIsShowBlockedTransactionDialog] =
    useState(false);
  const { localPendingTxData, clearLocalPendingTxData } =
    useRecentSendPendingTx(isForMultipleAddress);
  markSendScreenRenderPerf(renderSeq, 'recent_pending_tx_hook_end', {
    hasLocalPendingTx: !!localPendingTxData,
  });

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  markSendScreenRenderPerf(renderSeq, 'scene_account_hook_end', {
    hasCurrentAccount: !!currentAccount,
    accountType: currentAccount?.type,
    brandName: currentAccount?.brandName,
  });

  useRendererDetect({ name: 'SendScreen' });

  useEffect(() => {
    markSendScreenPerf('mounted', {
      isForMultipleAddress,
    });

    return () => {
      markSendScreenPerf('unmounted', {
        isForMultipleAddress,
      });
    };
  }, [isForMultipleAddress]);

  useEffect(() => {
    clearLocalPendingTxData();
  }, [clearLocalPendingTxData]);

  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        'Send' | 'MultiSend'
      >
    >();
  const navParams = route.params;
  const isFocused = useIsFocused();
  const initByCacheFinishedRef = useRef(false);
  const sendScreenSessionRef = useRef<SendScreenSession | null>(null);
  const hasClaimedSendScreenSessionRef = useRef(false);

  const { chainItem, currentToken } = useSendTokenScreenChainToken();
  const routeParams = useAtomValue(sendScreenParamsAtom);
  markSendScreenRenderPerf(renderSeq, 'route_and_chain_hook_end', {
    hasNavParams: !!navParams,
    hasRouteParams: !!routeParams,
    chain: chainItem?.serverId,
    tokenChain: currentToken.chain,
    tokenId: currentToken.id,
  });

  const screenState = useSendTokenScreenStateShallowSelector(state => ({
    clickedMax: state.clickedMax,
    inited: state.inited,
    selectedGasLevel: state.selectedGasLevel,
    toAddrDesc: state.toAddrDesc,
  }));
  markSendScreenRenderPerf(renderSeq, 'screen_state_selector_end', {
    inited: screenState.inited,
    hasToAddrDesc: !!screenState.toAddrDesc,
    clickedMax: screenState.clickedMax,
    hasSelectedGasLevel: !!screenState.selectedGasLevel,
  });

  useEffect(() => {
    if (!currentAccount || !isFocused) {
      return;
    }

    const hadClaimedSession = hasClaimedSendScreenSessionRef.current;
    const { ownerChanged, session } = claimSendScreenSession(route.key);
    sendScreenSessionRef.current = session;
    hasClaimedSendScreenSessionRef.current = true;
    const activationPlan = getSendScreenActivationPlan({
      hadClaimedSession,
      ownerChanged,
      screenStateInited: screenState.inited,
    });

    if (activationPlan.restartInitialization) {
      initByCacheFinishedRef.current = false;
    }
    if (activationPlan.resetSharedState) {
      apiSendToken.resetScreenState();
    }

    apiSendToken.putScreenState({ inited: true });
    markSendScreenPerf('screen_inited_set');
  }, [currentAccount, isFocused, route.key, screenState.inited]);

  const Header = useCallback(
    () => <SendHeaderRight isForMultipleAddress={isForMultipleAddress} />,
    [isForMultipleAddress],
  );
  useEffect(() => {
    setNavigationOptions({
      headerRight: Header,
    });
  }, [Header, setNavigationOptions]);

  const disableItemCheck = useCallback<ITokenCheck>(
    (token: TokenItemWithEntity) => {
      if (!screenState.toAddrDesc) {
        return {
          disable: false,
          simpleReason: '',
          reason: '',
        };
      }
      const toCexId = screenState.toAddrDesc?.cex?.id;
      const isSupportCEX = globalSupportCexList.find(cex => cex.id === toCexId);
      if (toCexId && isSupportCEX) {
        const cex_ids =
          token.cex_ids || token.identity?.cex_list.map(item => item.id);
        const noSupportToken = cex_ids?.every?.(
          id => id.toLowerCase() !== toCexId.toLowerCase(),
        );
        if (!cex_ids?.length || noSupportToken) {
          return {
            disable: true,
            simpleReason: t('page.sendToken.noSupportTokenReason.forDexSimple'),
            reason: t('page.sendToken.noSupportTokenReason.forDex'),
          };
        }
      } else {
        const safeChains = Object.entries(
          screenState.toAddrDesc?.contract || {},
        )
          .filter(([, contract]) => {
            return contract.multisig;
          })
          .map(([chain]) => chain?.toLowerCase());
        if (
          safeChains.length > 0 &&
          !safeChains.includes(token?.chain?.toLowerCase())
        ) {
          return {
            disable: true,
            simpleReason: t(
              'page.sendToken.noSupportTokenReason.forSafeSimple',
            ),
            reason: t('page.sendToken.noSupportTokenReason.forSafe'),
          };
        }
        const contactChains = Object.entries(
          screenState.toAddrDesc?.contract || {},
        ).map(([chain]) => chain?.toLowerCase());
        if (
          contactChains.length > 0 &&
          !contactChains.includes(token?.chain?.toLowerCase())
        ) {
          return {
            disable: true,
            simpleReason: t('page.sendToken.noSupportTokenReason.forChain'),
            reason: t('page.sendToken.noSupportTokenReason.forChain'),
          };
        }
      }
      return {
        disable: false,
        simpleReason: '',
        reason: '',
      };
    },
    [screenState.toAddrDesc, t],
  );

  const {
    sendTokenEvents,
    formValues,
    submitForm,
    handleFieldChange,
    handleClickMaxButton,
    onChangeSlider,
    setSlider,
    handleGasLevelChanged,
    handleIgnoreGasFeeChange,
    setReloadTxRefreshPaused,
    onBottomAreaLayout,
    scrollViewRef,
    scrollViewStyle,
    scrollToBottom,

    checkCexSupport,
    loadCurrentToken,
    refreshCurrentTokenBalance,
    handleCurrentTokenChange,

    directSignBtnRef,
    formValuesRef,
    formValuesStore,
    saveCurrentFormValuesSnapshot,

    whitelistEnabled,
    computed: {
      toAccount,
      toAddressInContactBook,
      toAddressIsCex,
      toAddressPositiveTips,
      canDirectSign,
      toAddrCex,
    },
    miniSignInstance,
  } = useSendTokenForm({
    toAddress: navParams?.toAddress,
    toAddressBrandName: navParams?.addressBrandName,
    isForMultipleAddress: isForMultipleAddress,
    disableItemCheck,
    currentAccount,
  });
  markSendScreenRenderPerf(renderSeq, 'send_token_form_hook_end', {
    hasTo: !!formValues.to,
    whitelistEnabled,
    hasMiniSignInstance: !!miniSignInstance,
    canDirectSign,
    hasToAccount: !!toAccount,
    hasCurrentAccount: !!currentAccount,
  });

  useEffect(() => {
    if (!formValues.to) return;
    if (!isValidHexAddress(formValues.to as `0x${string}`)) return;

    const session = sendScreenSessionRef.current;
    if (!isFocused || !session || !isSendScreenSessionActive(session)) {
      return;
    }

    let disposed = false;

    markSendScreenPerf('to_addr_desc_start');
    getAddrDescWithCexLocalCacheSync(formValues.to).then(res => {
      markSendScreenPerf('to_addr_desc_end', {
        hasCex: !!res?.cex,
        contractChainCount: Object.keys(res?.contract || {}).length,
      });
      if (disposed || !isSendScreenSessionActive(session)) {
        return;
      }
      apiSendToken.putScreenState({
        toAddrDesc: res,
      });
    });

    return () => {
      disposed = true;
    };
  }, [formValues.to, isFocused]);

  const { fetchOrderedChainList } = useLoadMatteredChainBalances({
    account: currentAccount,
  });
  const initByCache = useCallback(async () => {
    const session = sendScreenSessionRef.current;
    if (!session) return;
    const isSessionActive = () => isSendScreenSessionActive(session);
    if (!isSessionActive()) return;

    const startedAt = Date.now();
    markSendScreenPerf('init_by_cache_start', {
      hasNavParams: !!navParams,
      hasRouteParams: !!routeParams,
      hasCurrentAccount: !!currentAccount,
      isForMultipleAddress,
    });

    let targetToken: TokenItem | null = null;
    const { chainItem: latestChainItem, currentToken } = getSendChainToken();

    if (
      navParams &&
      'safeInfo' in navParams &&
      typeof navParams.safeInfo === 'object'
    ) {
      const safeInfo = navParams.safeInfo;
      const target = findChainByID(safeInfo.chainId);
      apiSendToken.putScreenState({
        safeInfo: safeInfo,
      });

      targetToken = {
        id: target ? target?.nativeTokenAddress : currentToken.id,
        chain: target ? target?.serverId : currentToken.chain,
        ...EMPTY_TOKEN_ITEM,
      };
      target?.enum && apiSendToken.setChainEnum(target.enum);
    } else if (
      navParams &&
      'chainEnum' in navParams &&
      navParams?.chainEnum &&
      navParams?.tokenId
    ) {
      const isManualChangeToken =
        routeParams?.tokenId && routeParams?.chainEnum;
      const target = findChainByEnum(
        isManualChangeToken ? routeParams.chainEnum : navParams?.chainEnum,
      );

      targetToken = {
        chain: target ? target?.serverId : currentToken.chain,
        id: target
          ? isManualChangeToken
            ? routeParams.tokenId
            : navParams?.tokenId
          : currentToken.id,
        ...EMPTY_TOKEN_ITEM,
      };
      target && apiSendToken.setChainEnum(target.enum);
    } else {
      const isManualChangeToken =
        routeParams?.tokenId && routeParams?.chainEnum;
      if (isManualChangeToken) {
        const target = findChainByEnum(routeParams.chainEnum);
        if (target) {
          targetToken = {
            chain: target.serverId,
            id: routeParams.tokenId,
            ...EMPTY_TOKEN_ITEM,
          };
        }
      }

      if (!targetToken && currentAccount?.address) {
        const lastTokenStartedAt = Date.now();
        markSendScreenPerf('last_time_send_token_start');
        targetToken =
          (await getLastTimeSendToken(currentAccount?.address)) ?? null;
        markSendScreenPerf('last_time_send_token_end', {
          elapsedMs: Date.now() - lastTokenStartedAt,
          hasToken: !!targetToken,
          chain: targetToken?.chain,
          tokenId: targetToken?.id,
        });
        if (!isSessionActive()) return;
      }
      if (!targetToken) {
        const orderedChainStartedAt = Date.now();
        markSendScreenPerf('fetch_ordered_chain_list_start', {
          hasAddress: !!currentAccount?.address,
        });
        const { firstChain } = await fetchOrderedChainList({
          address: currentAccount?.address,
          supportChains: undefined,
        });
        markSendScreenPerf('fetch_ordered_chain_list_end', {
          elapsedMs: Date.now() - orderedChainStartedAt,
          hasFirstChain: !!firstChain,
          firstChain: firstChain?.serverId,
        });
        if (!isSessionActive()) return;
        targetToken = firstChain ? makeTokenFromChain(firstChain) : null;
      }
      if (!targetToken) {
        targetToken = currentToken;
      }
    }

    if (navParams?.toAddress && currentAccount?.address) {
      const recommendStartedAt = Date.now();
      markSendScreenPerf('recommend_token_start', {
        chain: targetToken.chain,
        tokenId: targetToken.id,
      });
      const res = await getRecommendToken({
        from: currentAccount?.address,
        to: navParams?.toAddress || '',
        tokenId: targetToken.id,
        chain: targetToken.chain,
      });
      markSendScreenPerf('recommend_token_end', {
        elapsedMs: Date.now() - recommendStartedAt,
        chain: res.chain,
        tokenId: res.tokenId,
      });
      if (!isSessionActive()) return;
      if (
        !lowcaseSame(res.chain, targetToken.chain) ||
        !lowcaseSame(res.tokenId, targetToken.id)
      ) {
        targetToken = {
          chain: res.chain,
          id: res.tokenId,
          ...EMPTY_TOKEN_ITEM,
        };
      }
    }
    if (!isSessionActive()) return;
    if (latestChainItem && targetToken.chain !== latestChainItem.serverId) {
      const target = findChainByServerID(targetToken.chain);
      if (target?.enum) {
        apiSendToken.setChainEnum(target.enum);
      }
    }
    const initialDisplayToken = getInitialDisplayToken(targetToken);
    if (initialDisplayToken) {
      markSendScreenPerf('initial_display_token_apply', {
        chain: initialDisplayToken.chain,
        tokenId: initialDisplayToken.id,
        hasSymbol: !!(
          initialDisplayToken.optimized_symbol ||
          initialDisplayToken.display_symbol ||
          initialDisplayToken.symbol
        ),
      });
      apiSendToken.putChainToken({ currentToken: initialDisplayToken });
      if (currentAccount?.address) {
        apiSendToken.markBalanceLoading({
          tokenId: targetToken.id,
          chainId: targetToken.chain,
          currentAddress: currentAccount.address,
        });
      }
      apiSendToken.putScreenState({ initialTokenIdentityReady: true });
    }

    const loadCurrentTokenStartedAt = Date.now();
    markSendScreenPerf('load_current_token_start', {
      enabled: !!currentAccount?.address,
      chain: targetToken.chain,
      tokenId: targetToken.id,
    });
    const loadedTokenPromise = currentAccount?.address
      ? loadCurrentToken(
          targetToken.id,
          targetToken.chain,
          currentAccount.address,
          false,
          isSessionActive,
        )
          .then(loadedToken => {
            markSendScreenPerf('load_current_token_end', {
              elapsedMs: Date.now() - loadCurrentTokenStartedAt,
              hasLoadedToken: !!loadedToken,
            });
            return loadedToken;
          })
          .catch(error => {
            markSendScreenPerf('load_current_token_error', {
              elapsedMs: Date.now() - loadCurrentTokenStartedAt,
              error: error instanceof Error ? error.message : String(error),
            });
            console.error('SendScreen loadCurrentToken error', error);
            return null;
          })
      : Promise.resolve(null).then(value => {
          markSendScreenPerf('load_current_token_skip', {
            elapsedMs: Date.now() - loadCurrentTokenStartedAt,
          });
          return value;
        });

    if (!initialDisplayToken) {
      void loadedTokenPromise.then(loadedToken => {
        if (loadedToken && isSessionActive()) {
          apiSendToken.putScreenState({ initialTokenIdentityReady: true });
        }
      });
    }

    await Promise.race([loadedTokenPromise, sleep(5000)]);
    markSendScreenPerf('init_by_cache_end', {
      elapsedMs: Date.now() - startedAt,
      hasInitialDisplayToken: !!initialDisplayToken,
      chain: targetToken.chain,
      tokenId: targetToken.id,
    });
  }, [
    navParams,
    routeParams,
    currentAccount,
    fetchOrderedChainList,
    loadCurrentToken,
    isForMultipleAddress,
  ]);

  const checkIsAddressBlocked = useCallback(async (to?: string) => {
    if (!to) return;

    try {
      const startedAt = Date.now();
      markSendScreenPerf('blocked_address_check_start');
      const { is_blocked } = await openapi.isBlockedAddress(to);
      markSendScreenPerf('blocked_address_check_end', {
        elapsedMs: Date.now() - startedAt,
        isBlocked: is_blocked,
      });
      if (is_blocked) {
        apiPageStateCache.clearPageStateCache();
        setIsShowBlockedTransactionDialog(true);
      }
    } catch (e) {
      markSendScreenPerf('blocked_address_check_error', {
        error: e instanceof Error ? e.message : String(e),
      });
      console.error('checkIsAddressBlocked error', e);
    }
  }, []);

  useEffect(() => {
    markSendScreenPerf('init_effect_commit', {
      inited: screenState.inited,
      hasToAddress: !!navParams?.toAddress,
      initByCacheFinished: initByCacheFinishedRef.current,
    });

    if (screenState.inited && isFocused) {
      const session = sendScreenSessionRef.current;
      if (!session || !isSendScreenSessionActive(session)) {
        return;
      }

      (async () => {
        if (initByCacheFinishedRef.current) return;
        initByCacheFinishedRef.current = true;

        try {
          await initByCache();
        } catch (e) {
          markSendScreenPerf('init_by_cache_error', {
            error: e instanceof Error ? e.message : String(e),
          });
          console.error('SendScreen initByCache error', e);
          if (isSendScreenSessionActive(session)) {
            initByCacheFinishedRef.current = false;
          }
        } finally {
          if (isSendScreenSessionActive(session)) {
            apiSendToken.putScreenState({ initialTokenReady: true });
            markSendScreenPerf('initial_token_ready_set');
          }
        }
      })();
      checkIsAddressBlocked(navParams?.toAddress);
    }
  }, [
    screenState.inited,
    isFocused,
    initByCache,
    checkIsAddressBlocked,
    navParams?.toAddress,
  ]);

  useEffect(() => {
    (async () => {
      if (!initByCacheFinishedRef.current) return;
      if (!currentAccount?.address) return;
      const session = sendScreenSessionRef.current;
      if (!session || !isSendScreenSessionActive(session)) return;

      const startedAt = Date.now();
      markSendScreenPerf('refresh_current_token_balance_start');
      try {
        await refreshCurrentTokenBalance();
        markSendScreenPerf('refresh_current_token_balance_end', {
          elapsedMs: Date.now() - startedAt,
        });
      } catch (error) {
        markSendScreenPerf('refresh_current_token_balance_error', {
          elapsedMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    })();
  }, [currentAccount?.address, refreshCurrentTokenBalance]);

  useEffect(() => {
    markSendScreenPerf('account_ready_effect_commit', {
      hasCurrentAccount: !!currentAccount,
    });

    if (!currentAccount) {
      if (isFocused) {
        redirectBackErrorHandler(navigation);
      }
    }
  }, [currentAccount, isFocused, navigation]);

  useEffect(() => {
    if (!currentAccount) return;
    return () => {
      apiPageStateCache.clearPageStateCache();
      markSendScreenPerf('page_state_cache_clear_on_account_effect_cleanup');
    };
  }, [currentAccount]);

  const { fetchContactAccounts } = useContactAccounts();

  useLayoutEffect(() => {
    return () => {
      const session = sendScreenSessionRef.current;
      if (session && releaseSendScreenSession(session)) {
        markSendScreenPerf('layout_cleanup_reset_screen_state');
        apiSendToken.resetScreenState();
      }
    };
  }, []);

  const { balanceNumText } = React.useMemo(() => {
    const balanceNum = new BigNumber(currentToken.raw_amount_hex_str || 0).div(
      10 ** currentToken.decimals,
    );
    const decimalPlaces =
      screenState.clickedMax || screenState.selectedGasLevel ? 8 : 4;

    return {
      balanceNumText: formatSendTokenBalanceText(balanceNum, decimalPlaces),
    };
  }, [
    currentToken.raw_amount_hex_str,
    currentToken.decimals,
    screenState.clickedMax,
    screenState.selectedGasLevel,
  ]);

  useClearMiniGasStateEffect({
    chainServerId: chainItem?.serverId || '',
  });

  const sendTokenInternalValue = useMemo(
    () => ({
      computed: {
        account: currentAccount || null,
        fromAddress: currentAccount?.address || '',
        toAccount,
        toAddressIsCex,
        whitelistEnabled,
        toAddressInContactBook,
        toAddressPositiveTips,
        canDirectSign,
        toAddrCex,

        chainItem,
        currentToken,
        currentTokenBalance: balanceNumText,
      },
      sendTokenEvents,
      scrollViewRef,
      scrollViewStyle,
      fns: {
        fetchContactAccounts,
        disableItemCheck,
      },

      directSignBtnRef,
      formValuesRef,
      formValuesStore,
      callbacks: {
        handleCurrentTokenChange,
        submitForm,
        handleFieldChange,
        checkCexSupport,
        handleClickMaxButton,
        onChangeSlider,
        setSlider,
        handleGasLevelChanged,
        handleIgnoreGasFeeChange,
        saveCurrentFormValuesSnapshot,
        setReloadTxRefreshPaused,
        onBottomAreaLayout,
        onGasInfoDebouncedLoaded: scrollToBottom,
      },
    }),
    [
      balanceNumText,
      canDirectSign,
      chainItem,
      checkCexSupport,
      currentAccount,
      currentToken,
      directSignBtnRef,
      disableItemCheck,
      fetchContactAccounts,
      formValuesRef,
      formValuesStore,
      handleClickMaxButton,
      handleCurrentTokenChange,
      submitForm,
      handleFieldChange,
      handleGasLevelChanged,
      handleIgnoreGasFeeChange,
      onBottomAreaLayout,
      onChangeSlider,
      setSlider,
      scrollToBottom,
      scrollViewRef,
      scrollViewStyle,
      saveCurrentFormValuesSnapshot,
      sendTokenEvents,
      setReloadTxRefreshPaused,
      toAccount,
      toAddrCex,
      toAddressInContactBook,
      toAddressIsCex,
      toAddressPositiveTips,
      whitelistEnabled,
    ],
  );

  markSendScreenRenderPerf(renderSeq, 'render_end', {
    inited: screenState.inited,
    hasCurrentAccount: !!currentAccount,
    chain: chainItem?.serverId,
    tokenChain: currentToken.chain,
    tokenId: currentToken.id,
    hasTo: !!formValues.to,
  });

  return (
    <SignatureInstanceProvider instance={miniSignInstance}>
      <SendTokenInternalContextProvider value={sendTokenInternalValue}>
        <SendScreenBody
          clearLocalPendingTxData={clearLocalPendingTxData}
          isForMultipleAddress={isForMultipleAddress}
          isShowBlockedTransactionDialog={isShowBlockedTransactionDialog}
          localPendingTxData={localPendingTxData}
        />
      </SendTokenInternalContextProvider>
    </SignatureInstanceProvider>
  );
}

/** @deprecated */
const ForMultipleAddress = (
  props: Omit<
    React.ComponentProps<typeof SendScreen>,
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
        ofScreen: 'MultiSend',
        sceneScreenRenderId: `${sceneCurrentAccountDepKey}-MultiSend`,
      }}>
      <SendScreen {...props} isForMultipleAddress />
    </ScreenSceneAccountProvider>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) =>
  StyleSheet.create({
    chainSection: {
      marginTop: 8,
    },
    sendScreen: {
      flexDirection: 'column',
      justifyContent: 'space-between',
      flex: 1,
      paddingTop: 4,
      position: 'relative',
      height: '100%',
    },
    mainContent: {
      paddingHorizontal: 20,
      paddingBottom: 280,
    },
    balance: {
      marginTop: 16,
    },
    screenRoot: {
      flex: 1,
    },
    buttonContainer: {
      width: '100%',
      height: 52,
    },
    button: {
      backgroundColor: colors2024['blue-default'],
    },
  }),
);
SendScreen.ForMultipleAddress = ForMultipleAddress;
export default SendScreen;
