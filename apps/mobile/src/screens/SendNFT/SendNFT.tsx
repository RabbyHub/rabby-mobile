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
import ToAddressControl from './components/ToAddressControl';
import {
  SendNFTEvents,
  SendNFTInternalContextProvider,
  subscribeEvent,
  useSendNFTForm,
  useSendNFTScreenState,
} from './hooks/useSendNFT';
import { useContactAccounts } from '@/hooks/contact';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import BottomArea from './components/BottomArea';
import { findChain } from '@/utils/chain';

export default function SendNFT() {
  const { styles } = useThemeStyles(getStyles);

  const navigation = useRabbyAppNavigation();
  const navParams = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.SendNFT)?.params,
  ) as TransactionNavigatorParamList['SendNFT'] | undefined;

  const nftItem = navParams?.nftItem;
  const chainItem = findChain({ serverId: nftItem?.chain });

  const {
    sendNFTScreenState: screenState,
    putScreenState,
    resetScreenState,
  } = useSendNFTScreenState();

  const {
    sendNFTEvents,
    formik,
    formValues,
    handleFieldChange,

    whitelistEnabled,
    computed: {
      toAddressInContactBook,
      toAddressIsValid,
      toAddressInWhitelist,
      canSubmit,
    },
  } = useSendNFTForm(nftItem);

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

  if (!nftItem || !chainItem) return null;

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
          currentNFT: nftItem,
        },
        events: sendNFTEvents,
        formik,
        fns: {
          putScreenState,
          fetchContactAccounts,
        },

        callbacks: {
          handleFieldChange,
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
                  chainEnum={chainItem.enum}
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
              collectionName={navParams?.collectionName}
              nftItem={navParams?.nftItem}
              style={{ marginTop: 16 }}
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
