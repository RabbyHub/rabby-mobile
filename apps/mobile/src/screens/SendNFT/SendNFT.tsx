import React from 'react';
import { Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { StackActions, useRoute } from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { NFTSection, SendNFTSection } from './Section';
import ToAddressControl2024 from '@/screens/SendNFT/components/ToAddressControl2024';
import FromAddressControl2024 from '@/screens/SendNFT/components/FromAddressControl';
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
import { createGetStyles2024 } from '@/utils/styles';
import { ShowMoreOnSendNFT } from './components/ShowMoreOnSendNFT';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';

export default function SendNFT() {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

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
  const addrDesc = navParams?.addrDesc;
  const account = fromAccount || currentAccount;

  if (!account) {
    throw new Error('Account is required to send NFT');
  }

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
    handleGasLevelChanged,
    scrollviewRef,
    handleIgnoreGasFeeChange,

    whitelistEnabled,
    computed: {
      toAccount,
      toAddressPositiveTips,
      toAddressInContactBook,
      toAddrCex,
      // toAddressIsRecentlySend,
      // toAddressInWhitelist,
      canSubmit,
      canDirectSign,
    },
  } = useSendNFTForm({
    toAddress: navParams?.toAddress,
    toAddressBrandName: navParams?.addressBrandName,
    nftToken: nftItem,
    currentAccount: account,
  });

  const { fetchContactAccounts } = useContactAccounts();

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
          fromAddress: account.address,
          canSubmit,
          toAccount,
          toAddressPositiveTips,
          // toAddressIsRecentlySend,
          // toAddressInWhitelist,
          whitelistEnabled,
          toAddrCex,
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
          handleGasLevelChanged,
          handleIgnoreGasFeeChange,
        },
      }}>
      <NormalScreenContainer2024 type="bg1">
        <AccountSwitcherModal forScene="SendNFT" inScreen />
        <View style={styles.sendNFTScreen}>
          <KeyboardAwareScrollView
            ref={scrollviewRef}
            contentContainerStyle={styles.mainContent}>
            {/* From */}
            <FromAddressControl2024 disableSwitch={true} />

            {/* To */}
            <ToAddressControl2024 addrDesc={addrDesc} />

            {/* nft amount info */}
            <NFTSection
              collectionName={collectionName}
              nftItem={nftItem}
              chainItem={chainItem}
            />
            <ShowMoreOnSendNFT chainServeId={chainItem?.serverId || ''} />
          </KeyboardAwareScrollView>
          <BottomArea account={account} />
        </View>
      </NormalScreenContainer2024>
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
    paddingHorizontal: 20,
    paddingBottom: 308,
  },

  buttonContainer: {
    width: '100%',
    height: 52,
  },
  button: {
    backgroundColor: colors2024['blue-default'],
  },
}));
