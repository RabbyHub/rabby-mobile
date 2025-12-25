import React from 'react';
import { useApproval } from '@/hooks/useApproval';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import {
  APPROVAL_MODAL_NAMES,
  CreateParams,
  EVENT_NAMES,
  GlobalSheetModalListeners,
  MODAL_ID,
  MODAL_NAMES,
  RemoveParams,
} from './types';
import { MODAL_CONFIGS, ModalComponents } from './utils';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { useRefreshAutoLockPanResponder } from '@/components/AutoLockView';
import { globalSheetModalEvents } from './event';
import { APPROVAL_SNAP_POINTS } from '@/components/Approval/components/map';
import { bottomSheetModalSecurityApis } from './security';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { makeBottomSheetProps } from './utils-help';
import { storeApiScreenshotReport } from '@/components/Screenshot/hooks';

type ModalData = {
  snapPoints: (string | number)[] | undefined;
  params: CreateParams;
  id: MODAL_ID;
  ref: React.RefObject<AppBottomSheetModal>;
};

let globalRemoveAllModals: ((params?: RemoveParams) => void) | null = null;

export const GlobalBottomSheetModal2024 = () => {
  const modalRefs = React.useRef<Record<string, ModalData['ref']>>({});
  const [modals, setModals] = React.useState<ModalData[]>([]);

  const removeAllModals = React.useCallback((params?: RemoveParams) => {
    // Close all current modals
    Object.values(modalRefs.current).forEach(modalRef => {
      modalRef.current?.close(
        Object.keys(params || {}).length ? { ...params } : undefined,
      );
    });

    // Clear all modal refs
    modalRefs.current = {};

    // Clear all modals from state
    setModals([]);
  }, []);

  React.useEffect(() => {
    globalRemoveAllModals = removeAllModals;
    return () => {
      globalRemoveAllModals = null;
    };
  }, [removeAllModals]);

  React.useEffect(() => {
    modalRefs.current = modals.reduce((acc, modal) => {
      acc[modal.id] = modal.ref;
      return acc;
    }, {} as Record<string, ModalData['ref']>);
  }, [modals]);

  const handlePresent = React.useCallback<
    GlobalSheetModalListeners[EVENT_NAMES.PRESENT]
  >(key => {
    const currentModal = modalRefs.current[key];

    if (!currentModal) {
      if (__DEV__) {
        console.warn(
          `[GlobalBottomSheetModal] Modal with key ${key} not found`,
        );
      }
      return;
    }

    currentModal.current?.present();
    globalSheetModalEvents.emit(EVENT_NAMES.PRESENTED, key);
  }, []);

  const [getApproval] = useApproval();

  const handleCreate = React.useCallback<
    GlobalSheetModalListeners[EVENT_NAMES.CREATE]
  >(
    async (id, params) => {
      const _approval = await getApproval();
      const approvalComponent = _approval?.data
        ?.approvalComponent as APPROVAL_MODAL_NAMES;

      const isWaitingComponent =
        approvalComponent &&
        params.name === MODAL_NAMES.APPROVAL &&
        [
          APPROVAL_MODAL_NAMES.LedgerHardwareWaiting,
          APPROVAL_MODAL_NAMES.KeystoneHardwareWaiting,
          APPROVAL_MODAL_NAMES.OneKeyHardwareWaiting,
          APPROVAL_MODAL_NAMES.PrivatekeyWaiting,
        ].includes(approvalComponent);

      setModals(prev => {
        const newModal = {
          id,
          params: {
            ...params,
            approvalComponent,
            bottomSheetModalProps: {
              ...params.bottomSheetModalProps,
              enableDynamicSizing: isWaitingComponent
                ? true
                : params?.bottomSheetModalProps?.enableDynamicSizing || false,
            },
          },
          snapPoints: isWaitingComponent
            ? undefined
            : approvalComponent && params.name === MODAL_NAMES.APPROVAL
            ? APPROVAL_SNAP_POINTS[approvalComponent] ??
              APPROVAL_SNAP_POINTS.Unknown
            : MODAL_CONFIGS[params.name].snapPoints,
          ref: React.createRef<AppBottomSheetModal>(),
        };
        modalRefs.current[id] = newModal.ref;

        return [...prev, newModal];
      });
      if (params.preventScreenshotOnModalOpen) {
        bottomSheetModalSecurityApis.markAtSensitiveModal(id);
      }
      if (params.screenshotReportFreeBeforeModalClose) {
        storeApiScreenshotReport.markIsScreenshotReportFree(true);
      }

      setTimeout(() => {
        handlePresent(id);
      }, 0);
    },
    [getApproval, handlePresent],
  );

  const handleRemove = React.useCallback<
    GlobalSheetModalListeners[EVENT_NAMES.REMOVE]
  >((key, params) => {
    if (modalRefs.current[key]) {
      // Empty object as props causes flash, undefined is preferred
      modalRefs.current[key].current?.close(
        Object.keys(params || {}).length ? { ...params } : undefined,
      );
    }
    delete modalRefs.current[key];

    setModals(prev => {
      return prev.filter(modal => modal.id !== key);
    });

    globalSheetModalEvents.emit(EVENT_NAMES.CLOSED, key);
    globalSheetModalEvents.emit(EVENT_NAMES.DISMISS, key);
  }, []);

  const handleDismiss = React.useCallback<
    GlobalSheetModalListeners[EVENT_NAMES.DISMISS]
  >(
    key => {
      globalSheetModalEvents.emit(EVENT_NAMES.DISMISS, key);
      bottomSheetModalSecurityApis.removeAtSensitiveModal(key);

      const params = modals.find(modal => modal.id === key)?.params;
      if (params?.screenshotReportFreeBeforeModalClose) {
        storeApiScreenshotReport.markIsScreenshotReportFree(false);
      }

      handleRemove(key);
    },
    [handleRemove, modals],
  );

  const handleSnapToIndex = React.useCallback<
    GlobalSheetModalListeners[EVENT_NAMES.SNAP_TO_INDEX]
  >((key, index) => {
    const currentModal = modalRefs.current[key];

    if (!currentModal) {
      return;
    }

    currentModal.current?.snapToIndex(index);
  }, []);

  React.useEffect(() => {
    globalSheetModalEvents.on(EVENT_NAMES.CREATE, handleCreate);
    globalSheetModalEvents.on(EVENT_NAMES.REMOVE, handleRemove);
    globalSheetModalEvents.on(EVENT_NAMES.PRESENT, handlePresent);
    globalSheetModalEvents.on(EVENT_NAMES.SNAP_TO_INDEX, handleSnapToIndex);

    return () => {
      globalSheetModalEvents.off(EVENT_NAMES.CREATE, handleCreate);
      globalSheetModalEvents.off(EVENT_NAMES.REMOVE, handleRemove);
      globalSheetModalEvents.off(EVENT_NAMES.PRESENT, handlePresent);
      globalSheetModalEvents.off(EVENT_NAMES.SNAP_TO_INDEX, handleSnapToIndex);
    };
  }, [handleCreate, handlePresent, handleRemove, handleSnapToIndex]);

  const height = useSafeAreaInsets();

  const modalsToPreventBack = React.useMemo(() => {
    return modals.map(modal => !modal.params.allowAndroidHarewareBack);
  }, [modals]);

  useHandleBackPressClosable(
    React.useCallback(() => {
      return !modalsToPreventBack.length;
    }, [modalsToPreventBack]),
    { autoEffectEnabled: !!modalsToPreventBack.length },
  );

  const { panResponder } = useRefreshAutoLockPanResponder();
  const { colors2024 } = useTheme2024();

  return (
    <View>
      {modals.map(modal => {
        const mConfig = MODAL_CONFIGS[modal.params.name];
        const ModalView = mConfig.Component as React.ComponentType<any>;
        const propsPreset =
          'globalModalPropsPreset' in mConfig
            ? mConfig.globalModalPropsPreset
            : {};
        const finalBottomSheetModalProps: typeof propsPreset & object = {
          ...propsPreset,
          ...modal.params.bottomSheetModalProps,
        };

        const rootViewType =
          finalBottomSheetModalProps?.rootViewType || 'BottomSheetView';
        const RootView =
          rootViewType === 'BottomSheetScrollView'
            ? BottomSheetScrollView
            : rootViewType === 'View'
            ? View
            : BottomSheetView;

        override_nested_object_props: {
          finalBottomSheetModalProps.rootViewStyle = StyleSheet.flatten([
            propsPreset?.rootViewStyle || {},
            finalBottomSheetModalProps?.enableDynamicSizing ? {} : { flex: 1 },
            finalBottomSheetModalProps?.rootViewStyle || {},
          ]);
        }

        const modalViewProps = {
          ...modal.params,
          $createParams: modal.params,
        };

        return (
          <AppBottomSheetModal
            topInset={height.top}
            // bottomInset={androidOnlyBottomOffset}
            enableContentPanningGesture={false}
            enableDismissOnClose
            keyboardBlurBehavior="restore"
            snapPoints={modal.snapPoints}
            {...finalBottomSheetModalProps}
            onDismiss={() => {
              handleDismiss(modal.id);
              finalBottomSheetModalProps?.onDismiss?.();
            }}
            key={modal.id}
            ref={modal.ref}
            name={modal.id}
            children={
              <RootView
                // eslint-disable-next-line react-native/no-inline-styles
                // TODO: need check
                style={finalBottomSheetModalProps.rootViewStyle}
                {...panResponder.panHandlers}>
                <ModalView {...modalViewProps} />
              </RootView>
            }
            stackBehavior="push"
            {...makeBottomSheetProps({
              createParams: modal.params,
              colors: colors2024,
            })}
          />
        );
      })}
    </View>
  );
};

export const removeAllGlobalBottomSheetModals = (params?: RemoveParams) => {
  if (globalRemoveAllModals) {
    globalRemoveAllModals(params);
  }
};
