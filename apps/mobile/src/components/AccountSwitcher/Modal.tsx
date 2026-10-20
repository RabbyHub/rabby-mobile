import { Keyboard, useWindowDimensions } from 'react-native';
import type { AccountSwitcherAopProps } from './hooks';
import { useAccountSceneVisible } from './hooks';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { AccountsPanelInModal } from './AccountsPanel';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import type { DappInfo } from '@/core/services/dappService';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useSheetModals } from '@/hooks/useSheetModal';
import React from 'react';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import type { ITokenItem } from '@/store/tokens';
import {
  withDappAccountSwitcherServices,
  type DappAccountSwitcherServiceInjectedProps,
} from './dappAccountSwitcherServices';
import type { Account } from '@/types/account';
import { RenderActivityBoundary } from '@/hooks/storeActivity/RenderActivityBoundary';

export function AccountSwitcherModal({
  forScene,
  token,
  panelLinearGradientProps,
  getAccountDisabledTips,
}: AccountSwitcherAopProps<{
  inScreen?: boolean;
  token?: ITokenItem;
  panelLinearGradientProps?: React.ComponentProps<
    typeof AccountsPanelInModal
  >['linearContainerProps'];
  getAccountDisabledTips?: React.ComponentProps<
    typeof AccountsPanelInModal
  >['getAccountDisabledTips'];
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

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        linearGradientType: 'linear',
        colors: colors2024,
      })}
      handleStyle={styles.handleStyle}
      onDismiss={onCancel}
      enableDynamicSizing
      maxDynamicContentSize={maxHeight}>
      {/* The panel owns the sheet's scrollable (a virtualized list), which
          also reports the content height used by dynamic sizing. */}
      <RenderActivityBoundary
        active={!!isVisible}
        label={`account-switcher-modal-${forScene}`}>
        <AccountsPanelInModal
          linearContainerProps={panelLinearGradientProps}
          forScene={forScene}
          token={token}
          getAccountDisabledTips={getAccountDisabledTips}
        />
      </RenderActivityBoundary>
    </AppBottomSheetModal>
  );
}

const getModalStyle = createGetStyles2024(ctx => {
  return {
    handleStyle: {
      backgroundColor: ctx.isLight
        ? ctx.colors2024['neutral-bg-0']
        : ctx.colors2024['neutral-bg-1'],
      paddingTop: 10,
      height: 36,
    },
  };
});

type AccountSwitcherModalInDappWebViewProps = {
  // activeDapp: DappInfo | null;
  activeDappId?: DappInfo['origin'];
  /** @deprecated */
  forScene?: AccountSwitcherAopProps['forScene'];
  __IS_IN_SHEET_MODAL__?: boolean;
};

function AccountSwitcherModalInDappWebViewImpl({
  activeDappId,
  __IS_IN_SHEET_MODAL__ = false,
  coreServices,
}: AccountSwitcherModalInDappWebViewProps &
  DappAccountSwitcherServiceInjectedProps) {
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

  const setDappCurrentAccount = useCallback(
    (id: DappInfo['origin'], currentAccount: Account) => {
      if (!coreServices.dappService.getDapp(id)) {
        throw new Error('dapp not found');
      }

      coreServices.dappService.patchDapps({
        [id]: {
          currentAccount,
        },
      });
    },
    [coreServices.dappService],
  );

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

  const onSwitchSceneAccount = useCallback<
    React.ComponentProps<typeof AccountsPanelInModal>['onSwitchSceneAccount'] &
      object
  >(
    async ctx => {
      if (!activeDappId) {
        return;
      }
      setDappCurrentAccount(activeDappId, ctx.sceneAccount);
      await ctx.switchAction();
    },
    [activeDappId, setDappCurrentAccount],
  );

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        linearGradientType: 'linear',
        colors: colors2024,
      })}
      handleStyle={styles.handleStyle}
      onDismiss={onCancel}
      enableDynamicSizing
      maxDynamicContentSize={maxHeight}>
      <RenderActivityBoundary
        active={!!isVisible}
        label="account-switcher-modal-active-dapp">
        <AccountsPanelInModal
          allowNullCurrentAccount={false}
          forScene={'@ActiveDappWebViewModal'}
          onSwitchSceneAccount={onSwitchSceneAccount}
        />
      </RenderActivityBoundary>
    </AppBottomSheetModal>
  );
}

export const AccountSwitcherModalInDappWebView =
  withDappAccountSwitcherServices(AccountSwitcherModalInDappWebViewImpl);

const getModalInDappWebViewStyle = createGetStyles2024(ctx => {
  return {
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
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      paddingTop: 10,
      height: 36,
    },
  };
});
