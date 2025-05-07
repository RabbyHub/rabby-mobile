import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
  Modal,
} from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { StackActions, useNavigation } from '@react-navigation/native';
import { useNavigationState } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { CHAINS_ENUM } from '@/constant/chains';
import {
  SendTokenEvents,
  SendTokenInternalContextProvider,
  subscribeEvent,
  useSendTokenForm,
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
import {
  useCurrentAccount,
  useLoadMatteredChainBalances,
} from '@/hooks/account';
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
import { useLastUsedAccountInScreen } from '@/hooks/useLastUsedAccountInScreen';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import {
  PropsForAccountSwitchScreen,
  ScreenSceneAccountProvider,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';
import { useTranslation } from 'react-i18next';
import ToAddressControl2024 from './components/ToAddressControl2024';
import { FooterButtonGroup } from '@/components2024/FooterButtonGroup';
import { TokenInfoPopup } from '../Swap/components/TokenInfoPopup';
import { openapi } from '@/core/request';
import { BlockedAddressDialog } from '@/components/Dialogs/BlockedAddressDialog';
import FromAddressControl2024 from './components/FromAddressControl';
import { useAtom } from 'jotai';
import { sendScreenParamsAtom } from '@/hooks/useSendRoutes';
import { lowcaseSame } from '@/utils/common';
import {
  getAddrDescWithCexLocalCacheSync,
  getInitDescWithCexLocalCache,
} from '@/databases/hooks/cex';
import { SendHeaderRight } from './SubScreens/SelectPolyScreen/HeaderRight';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { getRecommendToken } from '@/utils/addressSupport';

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
  isForMultipleAdderss = false,
}: PropsForAccountSwitchScreen): JSX.Element {
  useLastUsedAccountInScreen({ disableAutoEffect: !isForMultipleAdderss });
  const navigation = useNavigation();
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const [isShowBlockedTransactionDialog, setIsShowBlockedTransactionDialog] =
    useState(false);

  const navParams = useNavigationState(
    s =>
      s.routes.find(
        r =>
          r.name ===
          (isForMultipleAdderss ? RootNames.MultiSend : RootNames.Send),
      )?.params,
  ) as
    | {
        chainEnum?: CHAINS_ENUM | undefined;
        tokenId?: TokenItem['id'];
        toAddress?: string;
        addressBrandName?: string;
        addrDesc?: AddrDescResponse['desc'];
      }
    | {
        safeInfo: { nonce: number; chainId: number };
        toAddress?: string;
        addressBrandName?: string;
        addrDesc?: AddrDescResponse['desc'];
      }
    | undefined;

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
    () => <SendHeaderRight isForMultipleAdderss={isForMultipleAdderss} />,
    [isForMultipleAdderss],
  );
  useEffect(() => {
    setNavigationOptions({
      headerRight: Header,
    });
  }, [Header, setNavigationOptions]);

  const disableItemCheck = useCallback(
    (token: TokenItem) => {
      if (!addrDesc) {
        return {
          disable: false,
          reason: '',
        };
      }
      const toCexId = addrDesc?.cex?.id;
      if (toCexId) {
        const noSupportToken = token.cex_ids?.every?.(
          id => id.toLocaleLowerCase() !== toCexId.toLocaleLowerCase(),
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
          .map(([chain]) => chain?.toLocaleLowerCase());
        if (
          safeChains.length > 0 &&
          !safeChains.includes(token?.chain?.toLocaleLowerCase())
        ) {
          return {
            disable: true,
            reason: t('page.sendToken.noSupprotTokenForSafe'),
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
    handleGasLevelChanged,
    depositeModalInfo,
    setDepositeModalInfol,

    tmpToken,
    setTmpToken,
    checkCexSupport,
    loadCurrentToken,
    handleCurrentTokenChange,

    whitelistEnabled,
    computed: {
      toAddressInContactBook,
      toAddressIsValid,
      toAddressInWhitelist,
      canSubmit,
    },
  } = useSendTokenForm(
    navParams?.toAddress,
    isForMultipleAdderss,
    disableItemCheck,
  );

  const { fetchOrderedChainList } = useLoadMatteredChainBalances();

  const initByCache = async () => {
    const account = (await preferenceService.getCurrentAccount())!;
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
          account.address,
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
    const hideLoading = toastLoading('Loading Token...');
    try {
      if (navParams?.toAddress) {
        const res = await getRecommendToken({
          from: account.address,
          to: navParams?.toAddress || '',
          tokenId: targetToken.id,
          chain: targetToken.chain,
        });
        if (res.chain !== targetToken.chain || res.tokenId !== targetToken.id) {
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
          account.address,
        ),
        sleep(5000),
      ]);
    } finally {
      hideLoading();
    }
  };

  const init = async () => {
    const account = await preferenceService.getCurrentAccount()!;
    if (!account) {
      redirectBackErrorHandler(navigation);
      return;
    }
    putScreenState({ inited: true });
  };

  const checkIsAddressBlocked = async (to?: string) => {
    if (!to) return;
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

  const { currentAccount } = useCurrentAccount();

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
        resetScreenState();
        navigation.dispatch(
          StackActions.replace(RootNames.StackRoot, {
            screen: RootNames.Home,
          }),
        );
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

          chainItem,
          currentToken,
          currentTokenBalance: balanceNumText,
        },
        events: sendTokenEvents,
        formik,
        fns: {
          putScreenState,
          fetchContactAccounts,
        },

        callbacks: {
          handleCurrentTokenChange,
          handleFieldChange,
          checkCexSupport,
          handleClickMaxButton,
          handleGasLevelChanged,
        },
      }}>
      <NormalScreenContainer2024 type="bg1">
        {isForMultipleAdderss && (
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
                <FromAddressControl2024 disableSwitch={!isForMultipleAdderss} />
                {/* To */}
                <ToAddressControl2024
                  style={{
                    marginTop: 24,
                    marginBottom: 0,
                  }}
                  address={navParams?.toAddress || ''}
                  addrDesc={addrDesc}
                  brandName={navParams?.addressBrandName}
                />
                {/* balance info */}
                <BalanceSection
                  disableItemCheck={disableItemCheck}
                  style={styles.balance}
                />
              </View>
            </KeyboardAwareScrollView>
            <BottomArea />
          </View>
        </TouchableWithoutFeedback>
        <Modal
          visible={depositeModalInfo.visable}
          onRequestClose={() => {
            setDepositeModalInfol({
              visable: false,
              tips: '',
            });
          }}
          transparent
          animationType="fade">
          <View style={styles.overlay}>
            <View
              style={styles.modalContent}
              onStartShouldSetResponder={() => true}>
              <Text style={styles.alertModalText}>
                {depositeModalInfo.tips}
              </Text>
              <FooterButtonGroup
                style={styles.btns}
                confirmText={t('page.sendToken.noSupportBtns.confirm')}
                confirmType="ghost"
                cancelText={t('page.sendToken.noSupportBtns.cancel')}
                onCancel={() => {
                  setDepositeModalInfol({
                    visable: false,
                    tips: '',
                  });
                }}
                onConfirm={() => {
                  if (tmpToken) {
                    handleCurrentTokenChange(tmpToken);
                    setTmpToken(tmpToken);
                    setDepositeModalInfol({
                      visable: false,
                      tips: '',
                    });
                  }
                }}
              />
            </View>
          </View>
        </Modal>
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
      <SendScreen {...props} isForMultipleAdderss />
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
    bottomDockArea: {
      bottom: 0,
      width: '100%',
      padding: 20,
      borderTopWidth: 0.5,
      borderTopStyle: 'solid',
      borderTopColor: colors2024['neutral-line'],
      position: 'absolute',
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
