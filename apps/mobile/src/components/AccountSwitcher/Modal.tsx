import { Keyboard, View } from 'react-native';
import { AccountSwitcherAopProps, useAccountSceneVisible } from './hooks';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { ModalLayouts } from '@/constant/layout';
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

export function AccountSwitcherModal({
  forScene,
  panelLinearGradientProps,
}: AccountSwitcherAopProps<{
  inScreen?: boolean;
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

  const snapPoints = useMemo(() => [ModalLayouts.defaultHeightPercentText], []);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      onDismiss={onCancel}
      handleStyle={{
        backgroundColor: colors2024['neutral-bg-1'],
        paddingVertical: 18,
      }}>
      <AutoLockView style={[styles.container]}>
        <View style={[styles.panelContainer]}>
          <AccountsPanelInModal
            linearContainerProps={panelLinearGradientProps}
            forScene={forScene}
          />
        </View>
      </AutoLockView>
    </AppBottomSheetModal>
  );
}

const getModalStyle = createGetStyles2024(ctx => {
  return {
    container: {
      height: '100%',
      paddingTop: 20,
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

  const snapPoints = useMemo(() => [ModalLayouts.defaultHeightPercentText], []);

  useEffect(() => {
    if (isVisible) {
      Keyboard.dismiss();
    }
    toggleShowSheetModal('selectAddress', isVisible || 'destroy');
  }, [isVisible, toggleShowSheetModal]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      onDismiss={onCancel}
      handleStyle={{
        backgroundColor: colors2024['neutral-bg-1'],
        paddingVertical: 18,
      }}>
      <AutoLockView style={[styles.container]}>
        <View style={[styles.panelContainer]}>
          <AccountsPanelInModal
            allowNullCurrentAccount
            forScene={'@ActiveDappWebViewModal'}
            onSwitchSceneAccount={async ctx => {
              if (!activeDappId) {
                return;
              }
              setDappCurrentAccount(activeDappId, ctx.sceneAccount);
              await ctx.switchAction();
            }}
          />
        </View>
      </AutoLockView>
    </AppBottomSheetModal>
  );
}

const getModalInDappWebViewStyle = createGetStyles2024(ctx => {
  return {
    container: {
      height: '100%',
      paddingHorizontal: 16,
      paddingTop: 10,
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
  };
});
