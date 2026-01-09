import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
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
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { RootNames } from '@/constant/layout';
import { CHAINS_ENUM } from '@/constant/chains';
import {
  SendTokenEvents,
  SendTokenInternalContextProvider,
  subscribeEvent,
  useSendTokenForm,
  useSendTokenInternalContext,
  useSendTokenScreenChainToken,
  useSendTokenScreenState,
} from './hooks/useSendToken';
import BottomArea from './components/BottomArea';
import {
  findChainByEnum,
  findChainByID,
  findChainByServerID,
  makeTokenFromChain,
} from '@/utils/chain';
import { preferenceService } from '@/core/services';
import {
  AddrDescResponse,
  TokenItem,
  TokenItemWithEntity,
} from '@rabby-wallet/rabby-api/dist/types';
import { apiPageStateCache } from '@/core/apis';
import { useLoadMatteredChainBalances } from '@/hooks/accountChainBalance';
import { redirectBackErrorHandler } from '@/utils/navigation';
import { BalanceSection } from './Section';
import { createGetStyles2024 } from '@/utils/styles';
import { useContactAccounts } from '@/hooks/contact';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { toastLoading } from '@/components/Toast';
import { sleep } from '@/utils/async';
import BigNumber from 'bignumber.js';
import { bizNumberUtils } from '@rabby-wallet/biz-utils';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import {
  PropsForAccountSwitchScreen,
  ScreenSceneAccountProvider,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';
import { useTranslation } from 'react-i18next';
import ToAddressControl2024 from './components/ToAddressControl2024';
import { TokenInfoPopup } from '../Swap/components/TokenInfoPopup';
import { openapi } from '@/core/request';
import { BlockedAddressDialog } from '@/components/Dialogs/BlockedAddressDialog';
import FromAddressControl2024 from './components/FromAddressControl';
import { useAtom } from 'jotai';
import { sendScreenParamsAtom } from '@/hooks/useSendRoutes';
import {
  getAddrDescWithCexLocalCacheSync,
  getInitDescWithCexLocalCache,
} from '@/databases/hooks/cex';
import { SendHeaderRight } from './SubScreens/SelectPolyScreen/HeaderRight';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { getRecommendToken } from '@/utils/addressSupport';
import { lowcaseSame } from '@/utils/common';
import { noop } from 'lodash';
import { ShowMoreOnSend } from './components/ShowMoreOnSend';
import { PendingTxItem } from '../Swap/components/PendingTxItem';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useRecentSendPendingTx } from './hooks/useRecentSend';
import { useClearMiniGasStateEffect } from '@/hooks/miniSignGasStore';
import {
  globalSupportCexList,
  useCexSupportList,
} from '@/hooks/useCexSupportList';
import { isValidHexAddress } from '@metamask/utils';
import { type ITokenCheck } from '@/components/Token/TokenSelectorSheetModal';
import { useRendererDetect } from '@/components/Perf/PerfDetector';

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

function SendScreen({
  isForMultipleAddress = false,
}: PropsForAccountSwitchScreen): JSX.Element {
  const navigation = useNavigation();
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const [isShowBlockedTransactionDialog, setIsShowBlockedTransactionDialog] =
    useState(false);
  const { localPendingTxData, clearLocalPendingTxData } =
    useRecentSendPendingTx(isForMultipleAddress);
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  useRendererDetect({ name: 'SendScreen' });

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

  const { chainItem, currentToken, setChainEnum } =
    useSendTokenScreenChainToken();
  const [routeParams] = useAtom(sendScreenParamsAtom);

  const {
    sendTokenScreenState: screenState,
    putScreenState,
    resetScreenState,
  } = useSendTokenScreenState();

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
    formik,
    formValues,
    handleFieldChange,
    handleClickMaxButton,
    onChangeSlider,
    slider,
    setSlider,
    handleGasLevelChanged,
    handleIgnoreGasFeeChange,

    checkCexSupport,
    loadCurrentToken,
    handleCurrentTokenChange,

    whitelistEnabled,
    computed: {
      toAccount,
      toAddressInContactBook,
      toAddressIsCex,
      toAddressPositiveTips,
      canSubmit,
      canDirectSign,
      toAddrCex,
    },
  } = useSendTokenForm({
    toAddress: navParams?.toAddress,
    toAddressBrandName: navParams?.addressBrandName,
    isForMultipleAddress: isForMultipleAddress,
    disableItemCheck,
    currentAccount: currentAccount!,
  });

  useEffect(() => {
    if (!formValues.to) return;
    if (!isValidHexAddress(formValues.to as `0x${string}`)) return;

    getAddrDescWithCexLocalCacheSync(formValues.to).then(res => {
      putScreenState({
        toAddrDesc: res,
      });
    });
  }, [formValues.to, putScreenState]);

  const { fetchOrderedChainList } = useLoadMatteredChainBalances({
    account: currentAccount!,
  });
  const isShowLoadingRef = useRef(true);
  const initByCacheFinishedRef = useRef(false);
  const initByCache = useCallback(async () => {
    let targetToken: TokenItem | null = null;
    if (
      navParams &&
      'safeInfo' in navParams &&
      typeof navParams.safeInfo === 'object'
    ) {
      const safeInfo = navParams.safeInfo;
      const target = findChainByID(safeInfo.chainId);
      putScreenState({
        safeInfo: safeInfo,
      });

      targetToken = {
        id: target ? target?.nativeTokenAddress : currentToken.id,
        chain: target ? target?.serverId : currentToken.chain,
        ...EMPTY_TOKEN_ITEM,
      };
      target?.enum && setChainEnum(target.enum);
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
      target && setChainEnum(target.enum);
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

      if (!targetToken) {
        targetToken =
          (await preferenceService.getLastTimeSendToken(
            currentAccount!.address,
          )) ?? null;
      }
      if (!targetToken) {
        const { firstChain } = await fetchOrderedChainList({
          address: currentAccount!.address,
          supportChains: undefined,
        });
        targetToken = firstChain ? makeTokenFromChain(firstChain) : null;
      }
      if (!targetToken) {
        targetToken = currentToken;
      }
    }

    try {
      if (navParams?.toAddress) {
        const res = await getRecommendToken({
          from: currentAccount!.address,
          to: navParams?.toAddress || '',
          tokenId: targetToken.id,
          chain: targetToken.chain,
        });
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
      if (chainItem && targetToken.chain !== chainItem.serverId) {
        const target = findChainByServerID(targetToken.chain);
        if (target?.enum) {
          setChainEnum(target.enum);
        }
      }
      await Promise.race([
        await loadCurrentToken(
          targetToken.id,
          targetToken.chain,
          currentAccount!.address,
        ),
        sleep(5000),
      ]);
    } finally {
      // hideLoading();
      isShowLoadingRef.current = true;
    }
  }, [
    navParams,
    routeParams,
    currentAccount,
    currentToken,
    chainItem,
    setChainEnum,
    putScreenState,
    fetchOrderedChainList,
    loadCurrentToken,
  ]);
  const initByCacheOnce = useCallback(async () => {
    if (initByCacheFinishedRef.current) {
      return;
    }
    initByCacheFinishedRef.current = true;

    try {
      await initByCache();
    } catch (e) {
      console.error('SendScreen initByCache error', e);
      initByCacheFinishedRef.current = false;
    }
  }, [initByCache]);

  const checkIsAddressBlocked = useCallback(async (to?: string) => {
    if (!to) return;

    try {
      const { is_blocked } = await openapi.isBlockedAddress(to);
      if (is_blocked) {
        apiPageStateCache.clearPageStateCache();
        setIsShowBlockedTransactionDialog(true);
      }
    } catch (e) {
      console.error('checkIsAddressBlocked error', e);
    }
  }, []);

  useEffect(() => {
    if (screenState.inited) {
      initByCacheOnce();
      checkIsAddressBlocked(navParams?.toAddress);
    }
  }, [
    screenState.inited,
    initByCacheOnce,
    checkIsAddressBlocked,
    navParams?.toAddress,
  ]);

  useEffect(() => {
    if (!currentAccount) {
      redirectBackErrorHandler(navigation);
      return;
    } else {
      putScreenState({ inited: true });

      return () => {
        apiPageStateCache.clearPageStateCache();
      };
    }
  }, [currentAccount, navigation, putScreenState]);

  const { fetchContactAccounts } = useContactAccounts();

  useEffect(() => {
    const disposeRets = [] as Function[];
    subscribeEvent(
      sendTokenEvents,
      SendTokenEvents.ON_SIGNED_SUCCESS,
      () => {
        isShowLoadingRef.current = false;
        resetScreenState();
        // navigation.dispatch(
        //   StackActions.replace(RootNames.StackRoot, {
        //     screen: RootNames.Home,
        //   }),
        // );
      },
      { disposeRets },
    );

    return () => {
      disposeRets.forEach(dispose => dispose());
    };
  }, [sendTokenEvents, resetScreenState]);

  useLayoutEffect(() => {
    return () => {
      resetScreenState();
    };
  }, [resetScreenState]);

  const { balanceNumText } = React.useMemo(() => {
    const balanceNum = new BigNumber(currentToken.raw_amount_hex_str || 0).div(
      10 ** currentToken.decimals,
    );
    const decimalPlaces =
      screenState.clickedMax || screenState.selectedGasLevel ? 8 : 4;

    return {
      balanceNumText: bizNumberUtils.formatTokenAmount(
        balanceNum.toFixed(decimalPlaces, BigNumber.ROUND_FLOOR),
        decimalPlaces,
      ),
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

  return (
    <SendTokenInternalContextProvider
      value={{
        screenState,
        formValues,
        computed: {
          fromAddress: currentAccount?.address || '',
          canSubmit,
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
        events: sendTokenEvents,
        formik,
        slider,
        fns: {
          putScreenState,
          fetchContactAccounts,
          disableItemCheck,
        },

        callbacks: {
          handleCurrentTokenChange,
          handleFieldChange,
          checkCexSupport,
          handleClickMaxButton,
          onChangeSlider,
          setSlider,
          handleGasLevelChanged,
          handleIgnoreGasFeeChange,
        },
      }}>
      <NormalScreenContainer2024
        type="bg1"
        // overwriteStyle={styles.screenContainer}
      >
        <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
        <TouchableWithoutFeedback
          onPress={() => {
            sendTokenEvents.emit(SendTokenEvents.ON_PRESS_DISMISS);
            Keyboard.dismiss();
          }}>
          <ScrollView contentContainerStyle={styles.sendScreen}>
            <KeyboardAwareScrollView contentContainerStyle={styles.mainContent}>
              {/* FromToSection */}
              <View>
                {/* From */}
                <FromAddressControl2024 disableSwitch={false} />
                {/* To */}
                <ToAddressControl2024
                  style={{
                    marginTop: 24,
                    marginBottom: 0,
                  }}
                  addrDesc={screenState.toAddrDesc}
                  // brandName={navParams?.addressBrandName}
                />
                {/* balance info */}
                <BalanceSection
                  disableItemCheck={disableItemCheck}
                  style={styles.balance}
                />
                <ShowMoreOnSend chainServeId={chainItem?.serverId || ''} />
              </View>
              {Boolean(localPendingTxData && !canSubmit) && (
                <PendingTxItem
                  isForMultipleAddress={isForMultipleAddress}
                  data={localPendingTxData!}
                  type="send"
                  clearLocalPendingTxData={clearLocalPendingTxData}
                />
              )}
            </KeyboardAwareScrollView>
            <BottomArea account={currentAccount} />
          </ScrollView>
        </TouchableWithoutFeedback>
        <TokenInfoPopup />
        <BlockedAddressDialog
          visible={isShowBlockedTransactionDialog}
          onConfirm={() => {
            navigation.dispatch(
              StackActions.replace(RootNames.StackRoot, {
                screen: RootNames.Home,
              }),
            );
          }}
        />
      </NormalScreenContainer2024>
    </SendTokenInternalContextProvider>
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
      paddingTop: 16,
      position: 'relative',
      height: '100%',
    },
    mainContent: {
      paddingHorizontal: 24,
      paddingBottom: 220,
    },
    balance: {
      marginTop: 24,
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
