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
} from '@rabby-wallet/rabby-api/dist/types';
import { apiPageStateCache } from '@/core/apis';
import { useLoadMatteredChainBalances } from '@/hooks/account';
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
import { ShowMoreOnSend } from './components/SendShowMore';
import { PendingTxItem } from '../Swap/components/PendingTxItem';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useRecentSendPendingTx } from './hooks/useRecentSend';
import { useClearMiniGasStateEffect } from '@/hooks/miniSignGasStore';
import { SheetModalSelectAccountSend } from './components/SelectAccountSheetModal';

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

  useEffect(() => {
    clearLocalPendingTxData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        'Send' | 'MultiSend'
      >
    >();
  const navParams = route.params;

  const { chainItem, currentToken, setCurrentToken, setChainEnum } =
    useSendTokenScreenChainToken();
  const [addrDesc, setAddrDesc] = useState<
    AddrDescResponse['desc'] | undefined
  >(navParams?.addrDesc || getInitDescWithCexLocalCache(navParams?.toAddress));
  useEffect(() => {
    if (addrDesc || !navParams?.toAddress) {
      return;
    }
    getAddrDescWithCexLocalCacheSync(navParams.toAddress).then(res => {
      setAddrDesc(res);
    });
  }, [addrDesc, navParams?.toAddress]);
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

  const disableItemCheck = useCallback(
    (token: TokenItem & { cex_ids?: string[] }) => {
      if (!addrDesc) {
        return {
          disable: false,
          reason: '',
        };
      }
      const toCexId = addrDesc?.cex?.id;
      if (toCexId) {
        const noSupportToken = token.cex_ids?.every?.(
          id => id.toLowerCase() !== toCexId.toLowerCase(),
        );
        if (!token?.cex_ids?.length || noSupportToken) {
          return {
            disable: true,
            reason: t('page.sendToken.noSupprotTokenForDex'),
          };
        }
      } else {
        const safeChains = Object.entries(addrDesc?.contract || {})
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
            reason: t('page.sendToken.noSupprotTokenForSafe'),
          };
        }
        const contactChains = Object.entries(addrDesc?.contract || {}).map(
          ([chain]) => chain?.toLowerCase(),
        );
        if (
          contactChains.length > 0 &&
          !contactChains.includes(token?.chain?.toLowerCase())
        ) {
          return {
            disable: true,
            reason: t('page.sendToken.noSupportTokenForChain'),
          };
        }
      }
      return {
        disable: false,
        reason: '',
      };
    },
    [addrDesc, t],
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

    checkCexSupport,
    loadCurrentToken,
    handleCurrentTokenChange,

    whitelistEnabled,
    computed: {
      toAddressInContactBook,
      toAddressIsValid,
      toAddressInWhitelist,
      canSubmit,
      canDirectSign,
    },
  } = useSendTokenForm({
    toAddress: navParams?.toAddress,
    isForMultipleAddress: isForMultipleAddress,
    disableItemCheck,
    currentAccount: currentAccount!,
  });

  const { fetchOrderedChainList } = useLoadMatteredChainBalances({
    account: currentAccount!,
  });
  const isShowLoadingRef = useRef(true);
  const initByCache = async () => {
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
        targetToken = await preferenceService.getLastTimeSendToken(
          currentAccount!.address,
        );
      }
      if (!targetToken) {
        const { firstChain } = await fetchOrderedChainList({
          supportChains: undefined,
        });
        targetToken = firstChain ? makeTokenFromChain(firstChain) : null;
      }
      if (!targetToken) {
        targetToken = currentToken;
      }
    }
    const hideLoading = isShowLoadingRef.current
      ? toastLoading('Loading Token...')
      : noop;
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
      // 更新页面状态
      if (chainItem && targetToken.chain !== chainItem.serverId) {
        const target = findChainByServerID(targetToken.chain);
        if (target?.enum) {
          setChainEnum(target.enum);
        }
      }
      // // 不知道为什么要，感觉可以不要
      // if (!chainItem) {
      //   setChainEnum(CHAINS_ENUM.ETH);
      // }
      // // 应该去了也可以
      // if (targetToken) {
      //   if (
      //     !lowcaseSame(targetToken.chain, currentToken.chain) ||
      //     !lowcaseSame(targetToken.id, currentToken.id)
      //   ) {
      //     // setCurrentToken(targetToken);
      //   }
      // }
      await Promise.race([
        await loadCurrentToken(
          targetToken.id,
          targetToken.chain,
          currentAccount!.address,
        ),
        sleep(5000),
      ]);
    } finally {
      hideLoading();
      isShowLoadingRef.current = true;
    }
  };

  const init = async () => {
    if (!currentAccount) {
      redirectBackErrorHandler(navigation);
      return;
    }
    putScreenState({ inited: true });
  };

  const checkIsAddressBlocked = async (to?: string) => {
    if (!to) {
      return;
    }
    try {
      const { is_blocked } = await openapi.isBlockedAddress(to);
      if (is_blocked) {
        apiPageStateCache.clearPageStateCache();
        setIsShowBlockedTransactionDialog(true);
      }
    } catch (e) {
      // NOTHING
    }
  };

  useEffect(() => {
    if (screenState.inited) {
      initByCache();
      checkIsAddressBlocked(navParams?.toAddress);
    } else {
      init();

      return () => {
        apiPageStateCache.clearPageStateCache();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    navParams,
    screenState.inited,
    currentAccount?.address,
    currentAccount?.type,
  ]);

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
  }, [sendTokenEvents, resetScreenState, navigation]);

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
          canSubmit,
          toAddressInWhitelist,
          whitelistEnabled,
          toAddressIsValid,
          toAddressInContactBook,
          canDirectSign,

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
        },

        callbacks: {
          handleCurrentTokenChange,
          handleFieldChange,
          checkCexSupport,
          handleClickMaxButton,
          onChangeSlider,
          setSlider,
          handleGasLevelChanged,
        },
      }}>
      <NormalScreenContainer2024 type="bg1">
        {/* TODO: clean it */}
        {(isForMultipleAddress || !isForMultipleAddress) && (
          <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
        )}
        <TouchableWithoutFeedback
          onPress={() => {
            sendTokenEvents.emit(SendTokenEvents.ON_PRESS_DISMISS);
            Keyboard.dismiss();
          }}>
          <View style={styles.sendScreen}>
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
                  addrDesc={addrDesc}
                  brandName={navParams?.addressBrandName}
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
          </View>
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
    },
    mainContent: {
      paddingHorizontal: 24,
      paddingBottom: 200,
    },
    balance: {
      marginTop: 24,
    },
    sectionTitle: {
      color: colors2024['neutral-title-1'],
      fontSize: 17,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      marginBottom: 8,
    },
    buttonContainer: {
      width: '100%',
      height: 52,
    },
    button: {
      backgroundColor: colors2024['blue-default'],
    },
    overlay: {
      backgroundColor: 'rgba(0,0,0,0.8)',
      height: '100%',
      justifyContent: 'center',
    },
    modalContent: {
      borderRadius: 20,
      backgroundColor: colors2024['neutral-bg-1'],
      boxShadow: '0 20 20 0 rgba(45, 48, 51, 0.16)',
      borderWidth: 1,
      borderColor: colors2024['neutral-line'],
      marginHorizontal: 20,
      paddingHorizontal: 20,
      paddingVertical: 30,
    },
    btns: {
      padding: 0,
      marginTop: 30,
    },
    alertModalText: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      textAlign: 'center',
      color: colors2024['neutral-title-1'],
    },
  }),
);
SendScreen.ForMultipleAddress = ForMultipleAddress;
export default SendScreen;
