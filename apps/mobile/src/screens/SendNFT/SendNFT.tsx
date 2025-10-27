import React from 'react';
import { Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { StackActions, useRoute } from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { NFTSection, SendNFTSection } from './Section';
import ToAddressControl2024 from '@/screens/Send/components/ToAddressControl2024';
import FromAddressControl2024 from '@/screens/Send/components/FromAddressControl';
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
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import { useTranslation } from 'react-i18next';
import { createGetStyles2024 } from '@/utils/styles';

export default function SendNFT() {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const navigation = useRabbyAppNavigation();
  const route =
    useRoute<
      GetNestedScreenRouteProp<'TransactionNavigatorParamList', 'SendNFT'>
    >();
  const navParams = route.params;

  const nftItem = navParams?.nftItem;
  const chainItem = findChain({ serverId: nftItem?.chain });
  const collectionName = navParams?.collectionName;
  const fromAccount = navParams?.fromAccount;

  const toAddress = navParams?.toAddress || '';
  const addressBrandName = navParams?.addressBrandName;
  const addrDesc = navParams?.addrDesc;
  const account = fromAccount || undefined;

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
      canDirectSign,
    },
  } = useSendNFTForm({ nftToken: nftItem, account });

  const { fetchContactAccounts } = useContactAccounts();
  const { t } = useTranslation();

  // Initialize formValues.to with toAddress from navParams
  React.useEffect(() => {
    if (toAddress && toAddress !== formValues.to) {
      handleFieldChange('to', toAddress);
    }
  }, [toAddress, formValues.to, handleFieldChange]);

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

  if (!nftItem || !chainItem || !account) {
    return null;
  }

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
          canDirectSign,
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
      <NormalScreenContainer overwriteStyle={styles.container}>
        <AccountSwitcherModal forScene="SendNFT" inScreen />
        <View style={styles.sendNFTScreen}>
          <KeyboardAwareScrollView contentContainerStyle={styles.mainContent}>
            {/* From */}
            <FromAddressControl2024 disableSwitch={true} forScene="SendNFT" />

            {/* To */}
            <ToAddressControl2024
              // address={toAddress}
              brandName={addressBrandName}
              addrDesc={addrDesc}
            />

            {/* nft amount info */}
            <NFTSection
              collectionName={collectionName}
              nftItem={nftItem}
              chainItem={chainItem}
            />
          </KeyboardAwareScrollView>
          <BottomArea />
        </View>
      </NormalScreenContainer>
    </SendNFTInternalContextProvider>
  );
}

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    position: 'relative',
  },
  sendNFTScreen: {
    width: '100%',
    height: '100%',
    flexDirection: 'column',
    backgroundColor: colors2024['neutral-bg-1'],
    justifyContent: 'space-between',
  },
  mainContent: {
    width: '100%',
    alignItems: 'center',
    padding: 20,
    paddingTop: 16,
  },

  bottomDockArea: {
    bottom: 0,
    width: '100%',
    padding: 20,
    backgroundColor: colors2024['neutral-bg1'],
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
}));
