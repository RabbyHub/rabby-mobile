import React, { useMemo, useEffect } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { useThemeColors } from '@/hooks/theme';
import { useNavigation } from '@react-navigation/native';
import { useNavigationState } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { CHAINS_ENUM } from '@debank/common';
import {
  SendScreenState,
  SendTokenInternalContextProvider,
  useSendTokenForm,
  useSendTokenScreenChainToken,
  useSendTokenScreenState,
} from './hooks/useSendToken';
import BottomArea from './components/BottomArea';
import { findChainByServerID, makeTokenFromChain } from '@/utils/chain';
import { preferenceService } from '@/core/services';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { apiPageStateCache } from '@/core/apis';
import { useLoadMatteredChainBalances } from '@/hooks/account';
import { redirectBackErrorHandler } from '@/utils/navigation';
import { BalanceSection, Section } from './Section';
import { ChainSelectorTrigger } from '@/components/ChainSelector/Triggers';
import FromAddressInfo from './components/FromAddressInfo';
import ToAddressControl from './components/ToAddressControl';
import { createGetStyles } from '@/utils/styles';

function SendScreen(): JSX.Element {
  const navigation = useNavigation();

  const colors = useThemeColors();
  const styles = getStyles(colors);

  React.useEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: colors['neutral-card2'],
      },
    });
  }, [navigation, colors]);

  const navState = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.Send)?.params,
  ) as
    | {
        params?: { chain?: CHAINS_ENUM | undefined };
      }
    | undefined;

  const {
    chainItem,
    currentToken,
    loadCurrentToken,
    setCurrentToken,
    setChainEnum,
    isNativeToken,
    currentTokenBalance,
    currentTokenPrice,
  } = useSendTokenScreenChainToken();

  const { sendTokenScreenState: screenState, putScreenState } =
    useSendTokenScreenState();

  const {
    formik,
    formValues,
    handleFieldChange,
    handleClickTokenBalance,
    handleGasChange,

    chainEnum,
    handleChainChanged,
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
    } else if (/* (history.location.state as any)?.safeInfo */ false) {
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
    } else {
      let tokenFromOrder: TokenItem | null = null;

      const lastTimeToken = await preferenceService.getLastTimeSendToken(
        account.address,
      );
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
      loadCurrentToken(needLoadToken.id, needLoadToken.chain, account.address);
    }
  };

  const init = async () => {
    const account = await preferenceService.getCurrentAccount()!;
    // dispatch.whitelist.getWhitelistEnabled();
    // dispatch.whitelist.getWhitelist();
    // dispatch.contactBook.getContactBookAsync();
    if (!account) {
      // TODO: go back to Home Screen
      // history.replace('/');
      redirectBackErrorHandler(navigation);
      return;
    }
    // setCurrentAccount(account);

    const screenStatePatch: Partial<SendScreenState> = {};
    // if (account.type === KEYRING_CLASS.GNOSIS) {
    //   screenStatePatch.isGnosisSafe = false;
    // }
    screenStatePatch.inited = true;
    putScreenState(screenStatePatch);
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
  }, [navState, screenState.inited]);

  return (
    <NormalScreenContainer>
      <View style={styles.container}>
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
              currentTokenBalance,
              currentTokenPrice,
            },
            formik,
            fns: {
              putScreenState: putScreenState,
            },

            callbacks: {
              handleCurrentTokenChange,
              handleFieldChange,
              handleClickTokenBalance,
              handleGasChange,
            },
          }}>
          <>
            <View style={styles.SendContainer}>
              {/* FromToSection */}
              <Section>
                {/* ChainInfo */}
                <View className="mt-[0]">
                  <Text style={styles.sectionTitle}>Chain</Text>
                  <ChainSelectorTrigger
                    className="mt-[8]"
                    chainEnum={chainEnum}
                    onChange={handleChainChanged}
                  />
                </View>

                {/* From */}
                <View className="mt-[20]">
                  <Text style={styles.sectionTitle}>From</Text>
                  <FromAddressInfo className="mt-[8]" />
                </View>

                {/* To */}
                <ToAddressControl className="mt-[20]" />
              </Section>
              {/* balance info */}
              <BalanceSection style={{ marginTop: 20 }} />
            </View>

            <BottomArea />
          </>
        </SendTokenInternalContextProvider>
      </View>
    </NormalScreenContainer>
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
    SendContainer: {
      width: '100%',
      alignItems: 'center',
      padding: 20,
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
