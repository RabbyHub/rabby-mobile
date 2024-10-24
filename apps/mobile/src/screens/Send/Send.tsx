import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { useThemeColors } from '@/hooks/theme';
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
  findChain,
  findChainByEnum,
  findChainByID,
  findChainByServerID,
  makeTokenFromChain,
} from '@/utils/chain';
import { preferenceService } from '@/core/services';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { apiPageStateCache } from '@/core/apis';
import { useLoadMatteredChainBalances } from '@/hooks/account';
import { redirectBackErrorHandler } from '@/utils/navigation';
import { BalanceSection, SendTokenSection } from './Section';
import { ChainInfo } from './components/ChainInfo';
import FromAddressInfo from './components/FromAddressInfo';
import ToAddressControl from './components/ToAddressControl';
import { createGetStyles } from '@/utils/styles';
import { useContactAccounts } from '@/hooks/contact';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { toastLoading } from '@/components/Toast';
import { sleep } from '@/utils/async';
import BigNumber from 'bignumber.js';
import { bizNumberUtils } from '@rabby-wallet/biz-utils';

function SendScreen(): JSX.Element {
  const navigation = useNavigation();

  const colors = useThemeColors();
  const styles = getStyles(colors);

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
  }, [navParams, screenState.inited]);

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
      <NormalScreenContainer style={styles.container}>
        <TouchableWithoutFeedback
          onPress={() => {
            sendTokenEvents.emit(SendTokenEvents.ON_PRESS_DISMISS);
            Keyboard.dismiss();
          }}>
          <View style={styles.sendScreen}>
            <KeyboardAwareScrollView contentContainerStyle={styles.mainContent}>
              {/* FromToSection */}
              <SendTokenSection>
                {/* ChainInfo */}
                <View style={{ marginTop: 0 }}>
                  <Text style={styles.sectionTitle}>Chain</Text>
                  <ChainInfo
                    style={{ marginTop: 8 }}
                    chainEnum={chainEnum}
                    onChange={handleChainChanged}
                  />
                </View>

                {/* From */}
                <View style={{ marginTop: 20 }}>
                  <Text style={styles.sectionTitle}>From</Text>
                  <FromAddressInfo style={{ marginTop: 8 }} />
                </View>

                {/* To */}
                <ToAddressControl style={{ marginTop: 20 }} />
              </SendTokenSection>
              {/* balance info */}
              <BalanceSection style={{ marginTop: 20 }} />
            </KeyboardAwareScrollView>
            <BottomArea />
          </View>
        </TouchableWithoutFeedback>
      </NormalScreenContainer>
    </SendTokenInternalContextProvider>
  );
}

const getStyles = createGetStyles(colors =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors['neutral-card2'],
      position: 'relative',
    },
    sendScreen: {
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      justifyContent: 'space-between',
    },
    mainContent: {
      width: '100%',
      // height: '100%',
      alignItems: 'center',
      padding: 20,
      paddingTop: 0,
    },

    sectionTitle: {
      color: colors['neutral-body'],
      fontSize: 13,
      fontWeight: 'normal',
    },

    bottomDockArea: {
      bottom: 0,
      width: '100%',
      padding: 20,
      backgroundColor: colors['neutral-bg1'],
      borderTopWidth: 0.5,
      borderTopStyle: 'solid',
      borderTopColor: colors['neutral-line'],
      position: 'absolute',
    },

    buttonContainer: {
      width: '100%',
      height: 52,
    },
    button: {
      backgroundColor: colors['blue-default'],
    },
  }),
);

export default SendScreen;
