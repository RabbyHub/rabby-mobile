import { useMemo, useSyncExternalStore } from 'react';

import { useSignatureInstance } from './SignatureInstanceContext';
import {
  getMiniSignGasPanelController,
  type MiniSignGasPanelInfo,
  type MiniSignGasPanelSnapshot,
} from './miniSignGasPanelController';

export type { MiniSignGasPanelInfo } from './miniSignGasPanelController';

export const useMiniSignGasPanelController = () => {
  const instance = useSignatureInstance();
  return useMemo(() => getMiniSignGasPanelController(instance), [instance]);
};

export const useMiniSignGasPanelState = <T = MiniSignGasPanelSnapshot>(
  selector?: (state: MiniSignGasPanelSnapshot) => T,
) => {
  const controller = useMiniSignGasPanelController();
  return useSyncExternalStore(
    controller.subscribe,
    selector
      ? () => selector(controller.getState())
      : (controller.getState as () => T),
  );
};
