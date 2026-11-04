import React, { cloneElement } from 'react';
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
import {
  APPROVAL_SNAP_POINTS,
  APPROVAL_TOP_INSETS,
} from '@/components/Approval/components/map';
import { bottomSheetModalSecurityApis } from './security';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { makeBottomSheetProps } from './utils-help';
import { storeApiScreenshotReport } from '@/components/Screenshot/hooks';
import { runStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { perfEvents } from '@/core/utils/perf';

type ModalData = {
  snapPoints: (string | number)[] | undefined;
  params: CreateParams;
  id: MODAL_ID;
  ref: React.RefObject<AppBottomSheetModal | null>;
};

let globalRemoveAllModals: ((params?: RemoveParams) => void) | null = null;

export const GlobalBottomSheetModal2024 = () => {
  const modalRefs = React.useRef<Record<string, ModalData['ref']>>({});
  const waitForDismissIdsRef = React.useRef(new Set<MODAL_ID>());
  const pendingCreateTokensRef = React.useRef(new Map<MODAL_ID, symbol>());
  const pendingPresentIdsRef = React.useRef(new Set<MODAL_ID>());
  const presentedIdsRef = React.useRef(new Set<MODAL_ID>());
  const [modals, setModals] = React.useState<ModalData[]>([]);

  const removeAllModals = React.useCallback((params?: RemoveParams) => {
    pendingCreateTokensRef.current.clear();
    pendingPresentIdsRef.current.clear();
    presentedIdsRef.current.clear();
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
    const pendingCreates = pendingCreateTokensRef.current;
    globalRemoveAllModals = removeAllModals;
    return () => {
      pendingCreates.clear();
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
    if (presentedIdsRef.current.has(key)) {
      return;
    }
    const modalRef = modalRefs.current[key];
    if (!modalRef) {
      return;
    }
    if (!modalRef.current) {
      pendingPresentIdsRef.current.add(key);
      return;
    }
    pendingPresentIdsRef.current.delete(key);
    presentedIdsRef.current.add(key);
    modalRef.current.present();
    globalSheetModalEvents.emit(EVENT_NAMES.PRESENTED, key);
  }, []);

  // Fabric may commit the ref after a zero-delay timer has already run.
  // Present from the committed tree; never report PRESENTED for a null ref.
  React.useLayoutEffect(() => {
    modals.forEach(modal => {
      if (pendingPresentIdsRef.current.has(modal.id)) {
        handlePresent(modal.id);
      }
    });
  }, [modals, handlePresent]);

  const [getApproval] = useApproval();

  const handleCreate = React.useCallback<
    GlobalSheetModalListeners[EVENT_NAMES.CREATE]
  >(
    async (id, params) => {
      // REMOVE, clear-all, or host unmount may happen while approval lookup
      // is pending. A stale request must not recreate a dismissed sheet or
      // mark its security state after its owner has gone away.
      const createToken = Symbol(id);
      pendingCreateTokensRef.current.set(id, createToken);
      let _approval: Awaited<ReturnType<typeof getApproval>>;
      try {
        _approval = await getApproval();
      } catch (error) {
        if (pendingCreateTokensRef.current.get(id) === createToken) {
          pendingCreateTokensRef.current.delete(id);
        }
        throw error;
      }
      if (pendingCreateTokensRef.current.get(id) !== createToken) {
        return;
      }
      pendingCreateTokensRef.current.delete(id);
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

      const approvalTopInset =
        approvalComponent && params.name === MODAL_NAMES.APPROVAL
          ? APPROVAL_TOP_INSETS[approvalComponent]
          : undefined;

      // Set security state before a commit can present the sheet.
      if (params.preventScreenshotOnModalOpen) {
        bottomSheetModalSecurityApis.markAtSensitiveModal(id);
      }
      if (params.screenshotReportFreeBeforeModalClose) {
        storeApiScreenshotReport.markIsScreenshotReportFree(true);
      }
      pendingPresentIdsRef.current.add(id);
      // Allocate/register once per event, not in a replayable state updater.
      // Otherwise a concurrent replay can leave the registry pointing to a
      // discarded ref while the committed sheet owns another ref.
      const newModal: ModalData = {
        id,
        params: {
          ...params,
          approvalComponent,
          bottomSheetModalProps: {
            ...params.bottomSheetModalProps,
            ...(approvalTopInset !== undefined && {
              topInset: approvalTopInset,
            }),
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
      setModals(prev => [...prev, newModal]);
    },
    [getApproval],
  );

  const finalizeRemove = React.useCallback((key: MODAL_ID) => {
    pendingCreateTokensRef.current.delete(key);
    pendingPresentIdsRef.current.delete(key);
    presentedIdsRef.current.delete(key);
    delete modalRefs.current[key];

    setModals(prev => {
      return prev.filter(modal => modal.id !== key);
    });

    globalSheetModalEvents.emit(EVENT_NAMES.CLOSED, key);
    globalSheetModalEvents.emit(EVENT_NAMES.DISMISS, key);
  }, []);

  const handleRemove = React.useCallback<
    GlobalSheetModalListeners[EVENT_NAMES.REMOVE]
  >(
    (key, params) => {
      const { waitForDismiss, ...animationParams } = params || {};
      const currentModal = modalRefs.current[key]?.current;

      if (waitForDismiss && currentModal) {
        waitForDismissIdsRef.current.add(key);
        currentModal.close(
          Object.keys(animationParams).length
            ? { ...animationParams }
            : undefined,
        );
        return;
      }

      if (currentModal) {
        // Empty object as props causes flash, undefined is preferred
        currentModal.close(
          Object.keys(animationParams).length
            ? { ...animationParams }
            : undefined,
        );
      }
      finalizeRemove(key);
    },
    [finalizeRemove],
  );

  const handleDismiss = React.useCallback<
    GlobalSheetModalListeners[EVENT_NAMES.DISMISS]
  >(
    key => {
      if (waitForDismissIdsRef.current.delete(key)) {
        bottomSheetModalSecurityApis.removeAtSensitiveModal(key);

        const params = modals.find(modal => modal.id === key)?.params;
        if (params?.screenshotReportFreeBeforeModalClose) {
          storeApiScreenshotReport.markIsScreenshotReportFree(false);
        }

        finalizeRemove(key);
        return;
      }

      globalSheetModalEvents.emit(EVENT_NAMES.DISMISS, key);
      bottomSheetModalSecurityApis.removeAtSensitiveModal(key);

      const params = modals.find(modal => modal.id === key)?.params;
      if (params?.screenshotReportFreeBeforeModalClose) {
        storeApiScreenshotReport.markIsScreenshotReportFree(false);
      }

      handleRemove(key);
    },
    [finalizeRemove, handleRemove, modals],
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
      if (modalsToPreventBack.length > 0) {
        const lastModal = modals[modals.length - 1];
        if (lastModal) {
          modalRefs.current[lastModal.id]?.current?.close();
        }
        return false;
      }
      return true;
    }, [modalsToPreventBack, modals]),
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

        finalBottomSheetModalProps.rootViewStyle = StyleSheet.flatten([
          propsPreset?.rootViewStyle || {},
          finalBottomSheetModalProps?.enableDynamicSizing
            ? {}
            : {
                flex: 1,
              },
          finalBottomSheetModalProps?.rootViewStyle || {},
        ]);

        const modalViewProps = {
          ...modal.params,
          $createParams: modal.params,
        };

        let children = (
          <RootView
            // eslint-disable-next-line react-native/no-inline-styles
            // TODO: need check
            style={finalBottomSheetModalProps.rootViewStyle}
            {...panResponder.panHandlers}>
            <ModalView {...modalViewProps} />
          </RootView>
        );

        if (
          !finalBottomSheetModalProps.enableDynamicSizing &&
          RootView === BottomSheetView
        ) {
          children = (
            // eslint-disable-next-line react-native/no-inline-styles
            <View style={{ flex: 1 }}>
              {cloneElement(children, {
                style: [children.props.style, { bottom: 0 }],
              })}
            </View>
          );
        }

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
            children={children}
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

runStartupTask(() => {
  perfEvents.subscribe('GLOBAL_CLEAR_ALL_COVERED_COMPONENTS', () => {
    removeAllGlobalBottomSheetModals();
  });
}, STARTUP_TASKS.globalBottomSheetClearListener);
