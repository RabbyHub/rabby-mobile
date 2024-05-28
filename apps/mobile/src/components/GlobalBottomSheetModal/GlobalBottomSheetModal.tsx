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

type ModalData = {
  snapPoints: (string | number)[];
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

  const handlePresent = React.useCallback((key: string) => {
    const currentModal = modalRefs.current[key];
    console.log(currentModal, modalRefs.current);

    if (!currentModal) {
      return;
    }

    currentModal.current?.present();
  }, []);

  const [getApproval] = useApproval();

  const handleCreate = React.useCallback(
    async (id: string, params: CreateParams) => {
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
              ? APPROVAL_SNAP_POINTS[approvalComponent]
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

  const handleRemove = React.useCallback((key: string) => {
    if (modalRefs.current[key]) {
      modalRefs.current[key].current?.close();
    }
    delete modalRefs.current[key];
    // const modalInst = modals.find(modal => modal.id === key);
    // modalInst?.params.onCancel?.();

    setModals(prev => {
      return prev.filter(modal => modal.id !== key);
    });
  }, []);

  const handleDismiss = React.useCallback(
    (key: string) => {
      events.emit(EVENT_NAMES.DISMISS, key);
      handleRemove(key);
    },
    [handleRemove],
  );

  const handleSnapToIndex = React.useCallback((key: string, index: number) => {
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
        return (
          <AppBottomSheetModal
            topInset={height.top}
            enableContentPanningGesture={false}
            {...bottomSheetModalProps}
            onDismiss={() => {
              handleDismiss(modal.id);
              bottomSheetModalProps?.onDismiss?.();
            }}
            key={modal.id}
            ref={modal.ref}
            name={modal.id}
            children={<ModalView {...modal.params} />}
            snapPoints={modal.snapPoints}
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
