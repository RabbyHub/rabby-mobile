import { atom, useAtom } from 'jotai';
import { useCallback } from 'react';

import {
  AccountSwitcherScene,
  AccountSwitcherState,
} from '@/hooks/accountsSwitcher';

export type AccountSwitcherAopProps<T extends void | object = void> = {
  forScene: AccountSwitcherScene;
} & (T extends void ? {} : T);

export type { AccountSwitcherScene };

function makeDefaultState(): AccountSwitcherState {
  return {
    collapsed: true,
  };
}
const DefaultStates = {
  Send: makeDefaultState(),
  Swap: makeDefaultState(),
  Bridge: makeDefaultState(),
};

export const screenHeaderAccountSwitcherAtom = atom(DefaultStates);

export function useAccountSwitcherScenes(forScene?: AccountSwitcherScene) {
  const [scenes, setScenes] = useAtom(screenHeaderAccountSwitcherAtom);

  const toggleSceneVisible = useCallback(
    (scene: AccountSwitcherScene, nextVisible: boolean) => {
      setScenes(prev => {
        return {
          ...prev,
          [scene]: {
            ...prev[scene],
            collapsed: !nextVisible,
          },
        };
      });
    },
    [setScenes],
  );

  const getSceneVisible = useCallback(
    (scene: AccountSwitcherScene) => {
      if (__DEV__ && !scenes.hasOwnProperty(scene)) {
        console.error(
          `[useAccountSwitcherScenes] AccountSwitcher scene "${scene}" not found in state`,
        );
      }

      return !scenes[scene]?.collapsed;
    },
    [scenes],
  );

  return {
    toggleSceneVisible,
    getSceneVisible,
    isVisible:
      typeof forScene === 'undefined' ? undefined : getSceneVisible(forScene),
  };
}
