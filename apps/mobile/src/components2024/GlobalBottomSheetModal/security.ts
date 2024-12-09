import { atom, useAtom } from 'jotai';
import { useCallback, useMemo } from 'react';
import { MODAL_ID } from './types';

const atSensitiveSceneAtom = atom({
  openedSensitiveGlobalModals: {} as Record<MODAL_ID, boolean>,
});
/**
 * @description Prevents the user from taking a screenshot,
 * and keep PREVIOUS state on cleanup
 */
export function useSensitiveGlobalModalsOpened() {
  const [sensitiveScene, setSensitiveScene] = useAtom(atSensitiveSceneAtom);

  const markAtSensitiveModal = useCallback(
    (key: MODAL_ID) => {
      setSensitiveScene(prev => {
        return {
          ...prev,
          openedSensitiveGlobalModals: {
            ...prev.openedSensitiveGlobalModals,
            [key]: true,
          },
        };
      });
    },
    [setSensitiveScene],
  );

  const removeAtSensitiveModal = useCallback(
    (key: MODAL_ID) => {
      setSensitiveScene(prev => {
        delete prev.openedSensitiveGlobalModals[key];
        return {
          ...prev,
          openedSensitiveGlobalModals: {
            ...prev.openedSensitiveGlobalModals,
          },
        };
      });
    },
    [setSensitiveScene],
  );

  const anySensitiveModalOpened = useMemo(() => {
    return Object.values(sensitiveScene.openedSensitiveGlobalModals).some(
      Boolean,
    );
  }, [sensitiveScene.openedSensitiveGlobalModals]);

  return {
    anySensitiveModalOpened,
    markAtSensitiveModal,
    removeAtSensitiveModal,
  };
}
