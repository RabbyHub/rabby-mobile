import React from 'react';
import { useThemeColors } from '@/hooks/theme';
import { useApproval } from '@/hooks/useApproval';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import {
  APPROVAL_MODAL_NAMES,
  CreateParams,
  EVENT_NAMES,
  GlobalSheetModalListeners,
  MODAL_NAMES,
} from './types';

import {
  APPROVAL_SNAP_POINTS,
  makeBottomSheetProps,
  MODAL_VIEWS,
  SNAP_POINTS,
} from './utils';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useRefreshAutoLockPanResponder } from '../AutoLockView';
import { globalSheetModalEvents } from './event';

type ModalData = {
  snapPoints: (string | number)[] | undefined;
  params: CreateParams;
  id: string;
  ref: React.RefObject<AppBottomSheetModal>;
};

export const GlobalBottomSheetModal = () => {
  const modalRefs = React.useRef<Record<string, ModalData['ref']>>({});
  const [modals, setModals] = React.useState<ModalData[]>([]);

  const colors = useThemeColors();

  React.useEffect(() => {
    modalRefs.current = modals.reduce((acc, modal) => {
      acc[modal.id] = modal.ref;
      return acc;
    }, {} as Record<string, ModalData['ref']>);
  }, [modals]);

  const handlePresent = React.useCallback<
    GlobalSheetModalListeners[EVENT_NAMES.PRESENT]
  >((key: string) => {
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

      setModals(prev => [
        ...prev,
        {
          id,
          params: {
            ...params,
            approvalComponent,
          },
          snapPoints:
            approvalComponent && params.name === MODAL_NAMES.APPROVAL
              ? APPROVAL_SNAP_POINTS[approvalComponent] ??
                APPROVAL_SNAP_POINTS.Unknown
              : SNAP_POINTS[params.name],
          ref: React.createRef<AppBottomSheetModal>(),
        },
      ]);
      setTimeout(() => {
        handlePresent(id);
      }, 0);
    },
    [getApproval, handlePresent],
  );

  const handleRemove = React.useCallback<
    GlobalSheetModalListeners[EVENT_NAMES.REMOVE]
  >((key: string, params) => {
    if (modalRefs.current[key]) {
      // Empty object as props causes flash, undefined is preferred
      modalRefs.current[key].current?.close(
        Object.keys(params || {}).length ? { ...params } : undefined,
      );
    }
    delete modalRefs.current[key];
    // const modalInst = modals.find(modal => modal.id === key);
    // modalInst?.params.onCancel?.();

    setModals(prev => {
      return prev.filter(modal => modal.id !== key);
    });

    globalSheetModalEvents.emit(EVENT_NAMES.CLOSED, key);
    globalSheetModalEvents.emit(EVENT_NAMES.DISMISS, key);
  }, []);

  const handleDismiss = React.useCallback<
    GlobalSheetModalListeners[EVENT_NAMES.DISMISS]
  >(
    (key: string) => {
      globalSheetModalEvents.emit(EVENT_NAMES.DISMISS, key);
      handleRemove(key);
    },
    [handleRemove],
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

  const { onHardwareBackHandler } = useHandleBackPressClosable(
    React.useCallback(() => {
      return !modalsToPreventBack.length;
    }, [modalsToPreventBack]),
  );

  React.useEffect(onHardwareBackHandler);

  const { panResponder } = useRefreshAutoLockPanResponder();

  return (
    <View>
      {modals.map(modal => {
        const ModalView = MODAL_VIEWS[modal.params.name];
        const bottomSheetModalProps = modal.params.bottomSheetModalProps;
        const enableDynamicSizing = bottomSheetModalProps?.enableDynamicSizing;

        const modalViewProps = {
          ...modal.params,
          $createParams: modal.params,
        };

        return (
          <AppBottomSheetModal
            topInset={height.top}
            enableContentPanningGesture={false}
            keyboardBlurBehavior="restore"
            snapPoints={modal.snapPoints}
            {...bottomSheetModalProps}
            onDismiss={() => {
              handleDismiss(modal.id);
              bottomSheetModalProps?.onDismiss?.();
            }}
            key={modal.id}
            ref={modal.ref}
            name={modal.id}
            children={
              enableDynamicSizing ? (
                <BottomSheetView {...panResponder.panHandlers}>
                  <ModalView {...modalViewProps} />
                </BottomSheetView>
              ) : (
                <ModalView {...modalViewProps} />
              )
            }
            stackBehavior="push"
            {...makeBottomSheetProps({
              params: modal.params,
              colors,
            })}
          />
        );
      })}
    </View>
  );
};
