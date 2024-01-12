import React from 'react';
import { useThemeColors } from '@/hooks/theme';
import { useApproval } from '@/hooks/useApproval';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import { CreateParams, EVENT_NAMES, MODAL_NAMES } from './types';
import { useGlobalBottomSheetModalStyle } from './useGlobalBottomSheetModalStyle';

import {
  APPROVAL_SNAP_POINTS,
  events,
  makeBottomSheetProps,
  MODAL_VIEWS,
  SNAP_POINTS,
} from './utils';

type ModalData = {
  snapPoints: (string | number)[];
  params: CreateParams;
  id: string;
  ref: React.RefObject<AppBottomSheetModal>;
};

export const GlobalBottomSheetModal = () => {
  const [modals, setModals] = React.useState<ModalData[]>([]);
  const modalRefs = React.useRef<Record<string, ModalData['ref']>>({});
  const { handleStyle, setHandleStyle } = useGlobalBottomSheetModalStyle();
  const colors = useThemeColors();

  React.useEffect(() => {
    modalRefs.current = modals.reduce((acc, modal) => {
      acc[modal.id] = modal.ref;
      return acc;
    }, {} as Record<string, ModalData['ref']>);
  }, [modals]);

  const handlePresent = React.useCallback((key: string) => {
    const currentModal = modalRefs.current[key];

    if (!currentModal) {
      return;
    }

    currentModal.current?.present();
  }, []);

  const [getApproval] = useApproval();

  const handleCreate = React.useCallback(
    async (id: string, params: CreateParams) => {
      const _approval = await getApproval();
      const approvalComponent = _approval?.data?.approvalComponent;

      setModals(prev => [
        ...prev,
        {
          id,
          params,
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
    [handlePresent],
  );

  const handleRemove = React.useCallback((key: string) => {
    if (modalRefs.current[key]) {
      modalRefs.current[key].current?.close();
    }
    delete modalRefs.current[key];
    setModals(prev => {
      return prev.filter(modal => modal.id !== key);
    });
    setHandleStyle({
      backgroundColor: colors['neutral-bg-1'],
    });
  }, []);

  const handleDismiss = React.useCallback(
    (key: string) => {
      events.emit(EVENT_NAMES.DISMISS, key);
      handleRemove(key);
    },
    [handleRemove],
  );

  React.useEffect(() => {
    events.on(EVENT_NAMES.CREATE, handleCreate);
    events.on(EVENT_NAMES.REMOVE, handleRemove);
    events.on(EVENT_NAMES.PRESENT, handlePresent);

    return () => {
      events.off(EVENT_NAMES.CREATE, handleCreate);
      events.off(EVENT_NAMES.REMOVE, handleRemove);
      events.off(EVENT_NAMES.PRESENT, handlePresent);
    };
  }, [handleCreate, handlePresent, handleRemove]);

  const height = useSafeAreaInsets();

  return (
    <View>
      {modals.map(modal => {
        const ModalView = MODAL_VIEWS[modal.params.name];

        return (
          <AppBottomSheetModal
            topInset={height.top}
            enableContentPanningGesture={false}
            onDismiss={() => handleDismiss(modal.id)}
            handleStyle={handleStyle}
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
