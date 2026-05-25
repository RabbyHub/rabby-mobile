import React from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { SignatureInstanceProvider } from '@/components2024/MiniSignV2/state/SignatureInstanceContext';
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
  useSendNFTInternalShallowSelector,
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
import { Text } from '@/components/Typography';

const AnimatedKeyboardAwareScrollView = Animated.createAnimatedComponent(
  KeyboardAwareScrollView,
);

const SendNFTScreenBody = React.memo(function SendNFTScreenBody() {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { scrollViewRef, scrollViewStyle } = useSendNFTInternalShallowSelector(
    ctx => ({
      scrollViewRef: ctx.scrollViewRef,
      scrollViewStyle: ctx.scrollViewStyle,
    }),
  );

  const mainContentStyle = React.useMemo(
    () => [styles.mainContent, scrollViewStyle],
    [scrollViewStyle, styles.mainContent],
  );

  const handleScrollViewRef = React.useCallback(
    (instance: any) => {
      scrollViewRef.current = instance as unknown as KeyboardAwareScrollView;
    },
    [scrollViewRef],
  );

  return (
    <NormalScreenContainer2024 type="bg1">
      <AccountSwitcherModal forScene="SendNFT" inScreen />
      <View style={styles.sendNFTScreen}>
        <AnimatedKeyboardAwareScrollView
          innerRef={handleScrollViewRef}
          contentContainerStyle={mainContentStyle}>
          <FromAddressControl2024 disableSwitch={true} />
          <ToAddressControl2024 />
          <NFTSection />
          <ShowMoreOnSendNFT />
        </AnimatedKeyboardAwareScrollView>
        <BottomArea />
      </View>
    </NormalScreenContainer2024>
  );
});

export default function SendNFT() {
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
    submitForm,
    handleFieldChange,
    handleGasLevelChanged,
    scrollviewRef,
    handleIgnoreGasFeeChange,
    onBottomAreaLayout,
    scrollViewStyle,
    scrollToBottom,

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
    miniSignInstance,
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

  const sendNFTInternalValue = React.useMemo(
    () => ({
      screenState,
      formValues,
      computed: {
        account,
        addrDesc: addrDesc || null,
        collectionName,
        fromAddress: account.address,
        canSubmit,
        toAccount,
        toAddressPositiveTips,
        // toAddressIsRecentlySend,
        // toAddressInWhitelist,
        whitelistEnabled,
        toAddrCex,
        toAddressInContactBook,
        chainItem: chainItem || null,
        currentNFT: nftItem || null,
        canDirectSign,
      },
      events: sendNFTEvents,
      formik,
      scrollViewRef: scrollviewRef,
      scrollViewStyle,
      fns: {
        putScreenState,
        fetchContactAccounts,
      },

      callbacks: {
        handleFieldChange,
        submitForm,
        handleGasLevelChanged,
        handleIgnoreGasFeeChange,
        onBottomAreaLayout,
        onGasInfoDebouncedLoaded: scrollToBottom,
      },
    }),
    [
      account,
      addrDesc,
      canDirectSign,
      canSubmit,
      chainItem,
      collectionName,
      fetchContactAccounts,
      formValues,
      formik,
      handleFieldChange,
      submitForm,
      handleGasLevelChanged,
      handleIgnoreGasFeeChange,
      nftItem,
      onBottomAreaLayout,
      putScreenState,
      screenState,
      scrollToBottom,
      scrollviewRef,
      scrollViewStyle,
      sendNFTEvents,
      toAccount,
      toAddrCex,
      toAddressInContactBook,
      toAddressPositiveTips,
      whitelistEnabled,
    ],
  );

  if (!nftItem || !chainItem || !account) {
    return null;
  }

  return (
    <SignatureInstanceProvider instance={miniSignInstance}>
      <SendNFTInternalContextProvider value={sendNFTInternalValue}>
        <SendNFTScreenBody />
      </SendNFTInternalContextProvider>
    </SignatureInstanceProvider>
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
