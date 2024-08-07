import React from 'react';
import { Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useThemeStyles } from '@/hooks/theme';
import { TransactionNavigatorParamList } from '@/navigation-type';
import { createGetStyles } from '@/utils/styles';
import { StackActions, useNavigationState } from '@react-navigation/native';
import { NFTAmountSection, SendNFTSection } from './Section';
import { ChainInfo } from './components/ChainInfo';
import FromAddressInfo from './components/FromAddressInfo';
import { CHAINS_ENUM } from '@debank/common';
import ToAddressControl from './components/ToAddressControl';
import {
  SendNFTEvents,
  SendNFTInternalContextProvider,
  subscribeEvent,
  useSendNFTForm,
  useSendNFTScreenChainToken,
  useSendNFTScreenState,
} from './hooks/useSendNFT';
import { useLoadMatteredChainBalances } from '@/hooks/account';
import { useContactAccounts } from '@/hooks/contact';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import BottomArea from './components/BottomArea';

export default function SendNFT() {
  const { styles } = useThemeStyles(getStyles);

  const navigation = useRabbyAppNavigation();
  const navParams = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.SendNFT)?.params,
  ) as TransactionNavigatorParamList['SendNFT'] | undefined;

  // console.debug('navParams', JSON.stringify(navParams));

  // const chainEnum = React.useMemo(
  //   () => navParams?.chainEnum || CHAINS_ENUM.ETH,
  //   [navParams?.chainEnum],
  // );

  const {
    chainItem,
    currentToken,
    // currentTokenPrice,
  } = useSendNFTScreenChainToken();

  const {
    sendTokenScreenState: screenState,
    putScreenState,
    resetScreenState,
  } = useSendNFTScreenState();

  const {
    sendNFTEvents,
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
  } = useSendNFTForm();

  const { fetchOrderedChainList } = useLoadMatteredChainBalances();

  const { fetchContactAccounts } = useContactAccounts();

  React.useEffect(() => {
    const disposeRets = [] as Function[];
    subscribeEvent(
      sendNFTEvents,
      SendNFTEvents.ON_SIGNED_SUCCESS,
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
  }, [sendNFTEvents, resetScreenState, navigation]);

  React.useLayoutEffect(() => {
    return () => {
      resetScreenState();
    };
  }, [resetScreenState]);

  if (!navParams?.nftToken) return null;

  return (
    <SendNFTInternalContextProvider
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
          // currentTokenPrice,
          // currentTokenBalance: balanceNumText,
        },
        events: sendNFTEvents,
        formik,
        fns: {
          putScreenState,
          fetchContactAccounts,
        },

        callbacks: {
          handleCurrentTokenChange,
          handleFieldChange,
          handleClickTokenBalance,
          handleGasChange,
        },
      }}>
      <NormalScreenContainer style={styles.container}>
        <View style={styles.sendNFTScreen}>
          <KeyboardAwareScrollView contentContainerStyle={styles.mainContent}>
            {/* FromToSection */}
            <SendNFTSection>
              {/* ChainInfo */}
              <View style={{ marginTop: 0 }}>
                <Text style={styles.sectionTitle}>Chain</Text>
                <ChainInfo
                  style={{ marginTop: 8 }}
                  chainEnum={chainEnum}
                  // onChange={handleChainChanged}
                />
              </View>

              {/* From */}
              <View style={{ marginTop: 20 }}>
                <Text style={styles.sectionTitle}>From</Text>
                <FromAddressInfo style={{ marginTop: 8 }} />
              </View>

              {/* To */}
              <ToAddressControl style={{ marginTop: 20 }} />
            </SendNFTSection>

            {/* nft amount info */}
            <NFTAmountSection
              nftToken={navParams?.nftToken}
              style={{ marginTop: 20 }}
            />
          </KeyboardAwareScrollView>
          <BottomArea />
        </View>
      </NormalScreenContainer>
    </SendNFTInternalContextProvider>
  );
}

const getStyles = createGetStyles(colors => ({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors['neutral-card2'],
    position: 'relative',
  },
  sendNFTScreen: {
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
}));
