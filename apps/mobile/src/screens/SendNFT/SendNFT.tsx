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
  SendNFTRecipientController,
  subscribeEvent,
  useSendNFTForm,
  useSendNFTInternalShallowSelector,
  useSendNFTScreenStateActions,
} from './hooks/useSendNFT';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import BottomArea from './components/BottomArea';
import { findChain } from '@/utils/chain';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import { createGetStyles2024 } from '@/utils/styles';
import { ShowMoreOnSendNFT } from './components/ShowMoreOnSendNFT';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { Text } from '@/components/Typography';
import { withWhitelistService } from '@/hooks/whitelistServiceDependencies';
import { markStartupPerf } from '@/core/utils/startupPerfMarks';

const AnimatedKeyboardAwareScrollView = Animated.createAnimatedComponent(
  KeyboardAwareScrollView,
);

const SEND_NFT_RENDER_MARK_LIMIT = 20;
let nextSendNFTCycleId = 0;

function markSendNFTPerf(event: string, data: Record<string, unknown> = {}) {
  markStartupPerf('sendNFTScreen', event, data);
}

function markSendNFTRenderPerf(
  renderSeq: number,
  event: string,
  data: Record<string, unknown> = {},
) {
  if (renderSeq > SEND_NFT_RENDER_MARK_LIMIT) {
    return;
  }
  markSendNFTPerf(event, { renderSeq, ...data });
}

markSendNFTPerf('module_loaded');

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

function SendNFT() {
  const cycleIdRef = React.useRef(0);
  const renderSeqRef = React.useRef(0);
  if (!cycleIdRef.current) {
    cycleIdRef.current = ++nextSendNFTCycleId;
  }
  const cycleId = cycleIdRef.current;
  const renderSeq = ++renderSeqRef.current;
  markSendNFTRenderPerf(renderSeq, 'render_start', { cycleId });

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  markSendNFTRenderPerf(renderSeq, 'scene_account_hook_end', {
    cycleId,
    hasCurrentAccount: !!currentAccount,
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
  markSendNFTRenderPerf(renderSeq, 'route_and_chain_hook_end', {
    cycleId,
    hasAccount: !!account,
    hasChain: !!chainItem,
    hasNFT: !!nftItem,
  });

  if (!account) {
    throw new Error('Account is required to send NFT');
  }

  const { resetScreenState } = useSendNFTScreenStateActions();

  const {
    sendNFTEvents,
    formValues,
    formValuesStore,
    submitForm,
    handleFieldChange,
    handleGasLevelChanged,
    scrollviewRef,
    handleIgnoreGasFeeChange,
    onBottomAreaLayout,
    scrollViewStyle,
    scrollToBottom,

    computed: { canDirectSign },
    miniSignInstance,
  } = useSendNFTForm({
    toAddress: navParams?.toAddress,
    nftToken: nftItem,
    currentAccount: account,
  });
  markSendNFTRenderPerf(renderSeq, 'send_nft_form_hook_end', {
    cycleId,
    hasRecipient: !!formValues.to,
  });

  React.useEffect(() => {
    markSendNFTPerf('mounted', { cycleId });
    return () => {
      markSendNFTPerf('unmounted', {
        cycleId,
      });
    };
  }, [cycleId]);

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
      computed: {
        account,
        addrDesc: addrDesc || null,
        collectionName,
        fromAddress: account.address,
        toAccount: null,
        toAddressPositiveTips: null,
        whitelistEnabled: false,
        toAddrCex: null,
        toAddressInContactBook: false,
        chainItem: chainItem || null,
        currentNFT: nftItem || null,
        canDirectSign,
      },
      events: sendNFTEvents,
      formValuesStore,
      scrollViewRef: scrollviewRef,
      scrollViewStyle,
      fns: {
        fetchContactAccounts: () => {},
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
      chainItem,
      collectionName,
      formValuesStore,
      handleFieldChange,
      submitForm,
      handleGasLevelChanged,
      handleIgnoreGasFeeChange,
      nftItem,
      onBottomAreaLayout,
      scrollToBottom,
      scrollviewRef,
      scrollViewStyle,
      sendNFTEvents,
    ],
  );

  if (!nftItem || !chainItem || !account) {
    markSendNFTRenderPerf(renderSeq, 'render_end', {
      cycleId,
      rendered: false,
    });
    return null;
  }

  markSendNFTRenderPerf(renderSeq, 'render_end', {
    cycleId,
    rendered: true,
  });
  return (
    <SignatureInstanceProvider instance={miniSignInstance}>
      <SendNFTInternalContextProvider value={sendNFTInternalValue}>
        <SendNFTRecipientController
          toAddressBrandName={navParams?.addressBrandName}
        />
        <SendNFTScreenBody />
      </SendNFTInternalContextProvider>
    </SignatureInstanceProvider>
  );
}

export default withWhitelistService(SendNFT);

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
