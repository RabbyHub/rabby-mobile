import React, { useEffect, useLayoutEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
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
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { apiPageStateCache } from '@/core/apis';
import {
  useCurrentAccount,
  useLoadMatteredChainBalances,
} from '@/hooks/account';
import { redirectBackErrorHandler } from '@/utils/navigation';
import { BalanceSection } from './Section';
import ToAddressControl from './components/ToAddressControl';
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
import { ChainInfo2024 } from './components/ChainInfo2024';

function SendScreen(): JSX.Element {
  useLastUsedAccountInScreen();
  const navigation = useNavigation();
  const { styles } = useTheme2024({ getStyle });

  const navParams = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.Send)?.params,
  ) as
    | { chainEnum?: CHAINS_ENUM | undefined; tokenId?: TokenItem['id'] }
    | { safeInfo: { nonce: number; chainId: number } }
    | undefined;

  const {
    chainItem,
    currentToken,
    setCurrentToken,
    setChainEnum,
    currentTokenPrice,
  } = useSendTokenScreenChainToken();

  const {
    sendTokenScreenState: screenState,
    putScreenState,
    resetScreenState,
  } = useSendTokenScreenState();

  const {
    sendTokenEvents,
    formik,
    formValues,
    handleFieldChange,
    handleClickMaxButton,
    handleGasLevelChanged,

    chainEnum,
    handleChainChanged,
    loadCurrentToken,
    handleCurrentTokenChange,

    whitelistEnabled,
    computed: {
      toAddressInContactBook,
      toAddressIsValid,
      toAddressInWhitelist,
      canSubmit,
    },
  } = useSendTokenForm();

  const { fetchOrderedChainList } = useLoadMatteredChainBalances();

  const initByCache = async () => {
    const account = (await preferenceService.getCurrentAccount())!;
    // const qs = urlUtils.query2obj(history.location.search);
    if (/* qs.token */ false) {
      // const [tokenChain, id] = qs.token.split(':');
      // if (!tokenChain || !id) return;
      // const target = Object.values(CHAINS).find(
      //   (item) => item.serverId === tokenChain
      // );
      // if (!target) {
      //   loadCurrentToken(currentToken.id, currentToken.chain, account.address);
      //   return;
      // }
      // setChain(target.enum);
      // loadCurrentToken(id, tokenChain, account.address);
    } else if (
      navParams &&
      'safeInfo' in navParams &&
      typeof navParams.safeInfo === 'object'
    ) {
      const safeInfo = navParams.safeInfo;
      // const safeInfo: {
      //   nonce: number;
      //   chainId: number;
      // } = (history.location.state as any)?.safeInfo;
      // const chain = findChainByID(safeInfo.chainId);
      // let nativeToken: TokenItem | null = null;
      // if (chain) {
      //   setChain(chain.enum);
      //   nativeToken = await loadCurrentToken(
      //     chain.nativeTokenAddress,
      //     chain.serverId,
      //     account.address
      //   );
      // }
      // setSafeInfo(safeInfo);
      // persistPageStateCache({
      //   safeInfo,
      //   currentToken: nativeToken || currentToken,
      // });
      const target = findChainByID(safeInfo.chainId);
      putScreenState({
        safeInfo: safeInfo,
      });

      const hideLoading = toastLoading('Loading Token...');
      try {
        if (!target) {
          await Promise.race([
            await loadCurrentToken(
              currentToken.id,
              currentToken.chain,
              account.address,
            ),
            sleep(5000),
          ]);
        } else {
          setChainEnum(target.enum);
          await Promise.race([
            await loadCurrentToken(
              target.nativeTokenAddress,
              target.serverId,
              account.address,
            ),
            sleep(5000),
          ]);
        }
      } finally {
        hideLoading();
      }
    } else if (
      navParams &&
      'chainEnum' in navParams &&
      navParams?.chainEnum &&
      navParams?.tokenId
    ) {
      const target = findChainByEnum(navParams?.chainEnum);

      const hideLoading = toastLoading('Loading Token...');
      try {
        if (!target) {
          await Promise.race([
            await loadCurrentToken(
              currentToken.id,
              currentToken.chain,
              account.address,
            ),
            sleep(5000),
          ]);
        } else {
          setChainEnum(target.enum);
          await Promise.race([
            await loadCurrentToken(
              navParams?.tokenId,
              target.serverId,
              account.address,
            ),
            sleep(5000),
          ]);
        }
      } finally {
        hideLoading();
      }
    } else {
      let tokenFromOrder: TokenItem | null = null;

      const _lastTimeToken = await preferenceService.getLastTimeSendToken(
        account.address,
      );
      const lastTimeToken =
        chainItem && chainItem.serverId === _lastTimeToken?.chain
          ? _lastTimeToken
          : null;
      if (lastTimeToken) {
        setCurrentToken(lastTimeToken);
      } else {
        const { firstChain } = await fetchOrderedChainList({
          supportChains: undefined,
        });

        tokenFromOrder = firstChain ? makeTokenFromChain(firstChain) : null;
        if (firstChain) setCurrentToken(tokenFromOrder!);
      }

      let needLoadToken: TokenItem =
        lastTimeToken || tokenFromOrder || currentToken;
      if (await apiPageStateCache.hasPageStateCache()) {
        // const cache = await apiPageStateCache.getPageStateCache();
        // if (cache?.path === history.location.pathname) {
        //   if (cache.states.values) {
        //     form.setFieldsValue(cache.states.values);
        //     handleFormValuesChange(cache.states.values, form.getFieldsValue(), {
        //       token: cache.states.currentToken,
        //       isInitFromCache: true,
        //     });
        //   }
        //   if (cache.states.currentToken) {
        //     setCurrentToken(cache.states.currentToken);
        //     needLoadToken = cache.states.currentToken;
        //   }
        //   if (cache.states.safeInfo) {
        //     setSafeInfo(cache.states.safeInfo);
        //   }
        // }
      }

      if (chainItem && needLoadToken.chain !== chainItem.serverId) {
        const target = findChainByServerID(needLoadToken.chain);
        if (target?.enum) setChainEnum(target.enum);
      }
      if (!chainItem) {
        setChainEnum(CHAINS_ENUM.ETH);
      }
      loadCurrentToken(needLoadToken.id, needLoadToken.chain, account.address);
    }
  };

  const init = async () => {
    const account = await preferenceService.getCurrentAccount()!;
    // dispatch.whitelist.getWhitelistEnabled();
    // dispatch.whitelist.getWhitelist();
    // dispatch.contactBook.getContactBookAsync();
    if (!account) {
      // history.replace('/');
      redirectBackErrorHandler(navigation);
      return;
    }
    // setCurrentAccount(account);

    // if (account.type === KEYRING_CLASS.GNOSIS) {
    //   screenStatePatch.isGnosisSafe = false;
    // }
    putScreenState({ inited: true });
  };

  const { currentAccount } = useCurrentAccount();

  useEffect(() => {
    if (screenState.inited) {
      initByCache();
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
        // navigation.push(RootNames.StackRoot, {
        //   screen: RootNames.Home,
        // });
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
          currentTokenPrice,
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
          handleClickMaxButton,
          handleGasLevelChanged,
        },
      }}>
      <NormalScreenContainer2024 type="bg1">
        <AccountSwitcherModal forScene="Send" inScreen />
        <TouchableWithoutFeedback
          onPress={() => {
            sendTokenEvents.emit(SendTokenEvents.ON_PRESS_DISMISS);
            Keyboard.dismiss();
          }}>
          <View style={styles.sendScreen}>
            <KeyboardAwareScrollView contentContainerStyle={styles.mainContent}>
              {/* FromToSection */}
              <View>
                {/* To */}
                <ToAddressControl />

                {/* ChainInfo */}
                <View style={styles.chainSection}>
                  <Text style={styles.sectionTitle}>Chain</Text>
                  <ChainInfo2024
                    chainEnum={chainEnum}
                    onChange={handleChainChanged}
                  />
                </View>
                {/* balance info */}
                <BalanceSection />
              </View>
            </KeyboardAwareScrollView>
            <BottomArea />
          </View>
        </TouchableWithoutFeedback>
      </NormalScreenContainer2024>
    </SendTokenInternalContextProvider>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) =>
  StyleSheet.create({
    chainSection: {
      marginBottom: 24,
    },
    sendScreen: {
      flexDirection: 'column',
      justifyContent: 'space-between',
      flex: 1,
      paddingTop: 16,
    },
    mainContent: {
      paddingHorizontal: 24,
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
  }),
);

export default SendScreen;
