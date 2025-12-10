import { useMemo } from 'react';
import { MODAL_ID } from './types';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

type AtSensitiveSceneState = {
  openedSensitiveGlobalModals: Record<MODAL_ID, boolean>;
};
export const atSensitiveSceneState = zCreate<AtSensitiveSceneState>(() => ({
  openedSensitiveGlobalModals: {},
}));
function setSensitiveScene(
  valOrFunc: UpdaterOrPartials<AtSensitiveSceneState>,
) {
  atSensitiveSceneState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

function isAnySensitiveModalOpened(sensitiveScene: AtSensitiveSceneState) {
  return Object.values(sensitiveScene.openedSensitiveGlobalModals).some(
    Boolean,
  );
}

const markAtSensitiveModal = (key: MODAL_ID) => {
  setSensitiveScene(prev => {
    return {
      ...prev,
      openedSensitiveGlobalModals: {
        ...prev.openedSensitiveGlobalModals,
        [key]: true,
      },
    };
  });
};

const removeAtSensitiveModal = (key: MODAL_ID) => {
  setSensitiveScene(prev => {
    delete prev.openedSensitiveGlobalModals[key];
    return {
      ...prev,
      openedSensitiveGlobalModals: {
        ...prev.openedSensitiveGlobalModals,
      },
    };
  });
};

function getIsAnySensitiveModalOpened() {
  const sensitiveScene = atSensitiveSceneState.getState();
  return isAnySensitiveModalOpened(sensitiveScene);
}

export const bottomSheetModalSecurityApis = {
  markAtSensitiveModal,
  removeAtSensitiveModal,
  isAnySensitiveModalOpened,
  getIsAnySensitiveModalOpened,
};
