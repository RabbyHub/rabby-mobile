import { useMemo, useSyncExternalStore } from 'react';

import { useSignatureInstance } from './SignatureInstanceContext';
import {
  type MiniSignGasPanelState,
  getMiniSignGasPanelController,
} from './MiniSignGasPanelController';

export type { MiniSignGasPanelInfo } from './MiniSignGasPanelController';

export const useMiniSignGasPanelController = () => {
  const instance = useSignatureInstance();
  return useMemo(() => getMiniSignGasPanelController(instance), [instance]);
};

export const useMiniSignGasPanelState = <T = MiniSignGasPanelState>(
  selector?: (state: MiniSignGasPanelState) => T,
) => {
  const controller = useMiniSignGasPanelController();
  return useSyncExternalStore(
    controller.subscribe,
    selector
      ? () => selector(controller.getState())
      : (controller.getState as () => T),
  );
};
