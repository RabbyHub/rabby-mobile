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
import { events } from './event';
import { useHandleBackPressClosable } from '@/hooks/useAppGesture';
import { BottomSheetView } from '@gorhom/bottom-sheet';

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
      return;
    }

    currentModal.current?.present();
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
      modalRefs.current[key].current?.close({ ...params });
    }
    delete modalRefs.current[key];
    // const modalInst = modals.find(modal => modal.id === key);
    // modalInst?.params.onCancel?.();

    setModals(prev => {
      return prev.filter(modal => modal.id !== key);
    });

    events.emit(EVENT_NAMES.CLOSED, key);
  }, []);

  const handleDismiss = React.useCallback<
    GlobalSheetModalListeners[EVENT_NAMES.DISMISS]
  >(
    (key: string) => {
      events.emit(EVENT_NAMES.DISMISS, key);
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
    events.on(EVENT_NAMES.CREATE, handleCreate);
    events.on(EVENT_NAMES.REMOVE, handleRemove);
    events.on(EVENT_NAMES.PRESENT, handlePresent);
    events.on(EVENT_NAMES.SNAP_TO_INDEX, handleSnapToIndex);

    return () => {
      events.off(EVENT_NAMES.CREATE, handleCreate);
      events.off(EVENT_NAMES.REMOVE, handleRemove);
      events.off(EVENT_NAMES.PRESENT, handlePresent);
      events.off(EVENT_NAMES.SNAP_TO_INDEX, handleSnapToIndex);
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

  return (
    <View>
      {modals.map(modal => {
        const ModalView = MODAL_VIEWS[modal.params.name];
        const bottomSheetModalProps = modal.params.bottomSheetModalProps;
        const enableDynamicSizing = bottomSheetModalProps?.enableDynamicSizing;

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
                <BottomSheetView>
                  <ModalView {...modal.params} />
                </BottomSheetView>
              ) : (
                <ModalView {...modal.params} />
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
