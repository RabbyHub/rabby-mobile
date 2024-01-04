import React from 'react';
import { View } from 'react-native';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import { CreateParams, EVENT_NAMES } from './types';
import { events, MODAL_VIEWS, SNAP_POINTS } from './utils';

type ModalData = {
  snapPoints: (string | number)[];
  params: CreateParams;
  id: string;
  ref: React.RefObject<AppBottomSheetModal>;
};

export const GlobalBottomSheetModal = () => {
  const [modals, setModals] = React.useState<ModalData[]>([]);
  const modalRefs = React.useRef<Record<string, ModalData['ref']>>({});

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

  const handleCreate = React.useCallback(
    (id: string, params: CreateParams) => {
      setModals(prev => [
        ...prev,
        {
          id,
          params,
          snapPoints: SNAP_POINTS[params.name],
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

  return (
    <View>
      {modals.map(modal => (
        <AppBottomSheetModal
          onDismiss={() => handleDismiss(modal.id)}
          key={modal.id}
          ref={modal.ref}
          name={modal.id}
          children={MODAL_VIEWS[modal.params.name]}
          snapPoints={modal.snapPoints}
          stackBehavior="push"
        />
      ))}
    </View>
  );
};
