import { Keyboard, ScrollView, useWindowDimensions, View } from 'react-native';
import { AccountSwitcherAopProps, useAccountSceneVisible } from './hooks';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { AccountsPanelInModal } from './AccountsPanel';
import AutoLockView from '../AutoLockView';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { useDappCurrentAccount } from '@/hooks/useDapps';
import { DappInfo } from '@/core/services/dappService';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useSheetModals } from '@/hooks/useSheetModal';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React from 'react';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { ITokenItem } from '@/store/tokens';

export function AccountSwitcherModal({
  forScene,
  token,
  panelLinearGradientProps,
}: AccountSwitcherAopProps<{
  inScreen?: boolean;
  token?: ITokenItem;
  panelLinearGradientProps?: React.ComponentProps<
    typeof AccountsPanelInModal
  >['linearContainerProps'];
}>) {
  const { isVisible, toggleSceneVisible } = useAccountSceneVisible(forScene);
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { toggleShowSheetModal } = useSheetModals({
    selectAddress: modalRef,
  });

  const { styles, colors2024 } = useTheme2024({ getStyle: getModalStyle });

  useLayoutEffect(() => {
    return () => {
      toggleSceneVisible(forScene, false);
    };
  }, [forScene, toggleSceneVisible]);

  const onCancel = useCallback(() => {
    toggleSceneVisible(forScene, false);
  }, [forScene, toggleSceneVisible]);

  useEffect(() => {
    if (isVisible) {
      Keyboard.dismiss();
    }
    toggleShowSheetModal('selectAddress', isVisible || 'destroy');
  }, [isVisible, toggleShowSheetModal]);

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  const snapPoints = useMemo(() => [Math.max(maxHeight, 400)], [maxHeight]);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const scrollToBottom = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, []);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      // snapPoints={snapPoints}
      {...makeBottomSheetProps({
        linearGradientType: 'linear',
        colors: colors2024,
      })}
      onDismiss={onCancel}
      enableDynamicSizing
      maxDynamicContentSize={maxHeight}>
      <BottomSheetScrollView ref={scrollViewRef}>
        <AutoLockView style={[styles.container]}>
          <View style={[styles.panelContainer]}>
            <AccountsPanelInModal
              linearContainerProps={panelLinearGradientProps}
              forScene={forScene}
              scrollToBottom={scrollToBottom}
              token={token}
            />
          </View>
        </AutoLockView>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
}

const getModalStyle = createGetStyles2024(ctx => {
  return {
    handleStyle: {
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      paddingTop: 10,
      height: 36,
    },
    container: {
      height: '100%',
      minHeight: 364,
    },
    panelContainer: {
      position: 'relative',
      width: '100%',
    },
  };
});

export function AccountSwitcherModalInDappWebView({
  activeDappId,
  __IS_IN_SHEET_MODAL__ = false,
}: {
  // activeDapp: DappInfo | null;
  activeDappId?: DappInfo['origin'];
  /** @deprecated */
  forScene?: AccountSwitcherAopProps['forScene'];
  __IS_IN_SHEET_MODAL__?: boolean;
}) {
  const { isVisible, toggleSceneVisible } = useAccountSceneVisible(
    '@ActiveDappWebViewModal',
  );
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { toggleShowSheetModal } = useSheetModals({
    selectAddress: modalRef,
  });

  const { styles, colors2024 } = useTheme2024({
    getStyle: getModalInDappWebViewStyle,
  });

  useLayoutEffect(() => {
    return () => {
      toggleSceneVisible('@ActiveDappWebViewModal', false);
    };
  }, [toggleSceneVisible]);

  const { setDappCurrentAccount } = useDappCurrentAccount();

  const onCancel = useCallback(() => {
    toggleSceneVisible('@ActiveDappWebViewModal', false);
  }, [toggleSceneVisible]);

  useEffect(() => {
    if (isVisible) {
      Keyboard.dismiss();
    }
    toggleShowSheetModal('selectAddress', isVisible || 'destroy');
  }, [isVisible, toggleShowSheetModal]);

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  const snapPoints = useMemo(() => [Math.max(maxHeight, 400)], [maxHeight]);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const scrollToBottom = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, []);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        linearGradientType: 'linear',
        colors: colors2024,
      })}
      onDismiss={onCancel}
      enableDynamicSizing
      maxDynamicContentSize={maxHeight}>
      <BottomSheetScrollView ref={scrollViewRef}>
        <AutoLockView style={[styles.container]}>
          <View style={[styles.panelContainer]}>
            <AccountsPanelInModal
              allowNullCurrentAccount={false}
              forScene={'@ActiveDappWebViewModal'}
              onSwitchSceneAccount={async ctx => {
                if (!activeDappId) {
                  return;
                }
                setDappCurrentAccount(activeDappId, ctx.sceneAccount);
                await ctx.switchAction();
              }}
              scrollToBottom={scrollToBottom}
            />
          </View>
        </AutoLockView>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
}

const getModalInDappWebViewStyle = createGetStyles2024(ctx => {
  return {
    container: {
      height: '100%',
      minHeight: 364,
    },
    panelContainer: {
      position: 'relative',
      width: '100%',
    },
    bgMask: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.60)',
    },
    handleStyle: {
      backgroundColor: 'transparent',
      paddingTop: 10,
      height: 36,
    },
  };
});
