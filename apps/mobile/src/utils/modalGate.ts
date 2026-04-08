import { useEffect } from 'react';

import { zCreate } from '@/core/utils/reexports';
import { runDevIIFEFunc } from '@/core/utils/store';

type ModalGateState = {
  blockingModalCountMap: Record<string, number>;
  diagnosticsEnabled: boolean;
};

export const MODAL_GATE_IDS = {
  screenshotFeedback: 'screenshot-feedback',
  rateGuide: 'rate-guide',
  swapModal: 'swap-modal',
  securityTip: 'security-tip',
  biometricsStub: 'biometrics-stub',
  miniSignDirectOverlay: 'mini-sign-direct-overlay',
  debugReproModalA: 'debug-repro-modal-a',
} as const;

const modalGateStore = zCreate<ModalGateState>(() => ({
  blockingModalCountMap: {},
  diagnosticsEnabled: false,
}));

function markBlockingModalVisible(id: string, visible: boolean) {
  modalGateStore.setState(prev => {
    const currentCount = prev.blockingModalCountMap[id] || 0;

    if (visible) {
      return {
        ...prev,
        blockingModalCountMap: {
          ...prev.blockingModalCountMap,
          [id]: currentCount + 1,
        },
      };
    }

    if (!currentCount) {
      return prev;
    }

    const nextMap = { ...prev.blockingModalCountMap };
    if (currentCount <= 1) {
      delete nextMap[id];
    } else {
      nextMap[id] = currentCount - 1;
    }

    return {
      ...prev,
      blockingModalCountMap: nextMap,
    };
  });
}

export function getVisibleBlockingModalIds(options?: {
  excludeIds?: string[];
}) {
  const excludedIds = options?.excludeIds || [];
  const allIds = Object.keys(modalGateStore.getState().blockingModalCountMap);

  return allIds.filter(id => !excludedIds.includes(id));
}

export function hasVisibleBlockingModal(options?: { excludeIds?: string[] }) {
  return getVisibleBlockingModalIds(options).length > 0;
}

export function useVisibleBlockingModalIds() {
  return modalGateStore(s => Object.keys(s.blockingModalCountMap).sort());
}

export type ModalGateDebugSnapshot = {
  visibleBlockingModalCount: number;
  visibleBlockingModalIds: string[];
};

export function getModalGateDebugSnapshot(): ModalGateDebugSnapshot {
  const visibleBlockingModalIds = getVisibleBlockingModalIds();

  return {
    visibleBlockingModalCount: visibleBlockingModalIds.length,
    visibleBlockingModalIds,
  };
}

export function subscribeModalGateDebugSnapshot(
  listener: (snapshot: ModalGateDebugSnapshot) => void,
) {
  let prevSnapshotKey: string | null = null;

  const emitSnapshot = () => {
    const snapshot = getModalGateDebugSnapshot();
    const nextSnapshotKey = snapshot.visibleBlockingModalIds.join('\n');

    if (nextSnapshotKey === prevSnapshotKey) {
      return;
    }

    prevSnapshotKey = nextSnapshotKey;
    listener(snapshot);
  };

  emitSnapshot();

  return modalGateStore.subscribe(() => {
    emitSnapshot();
  });
}

export function useRegisterBlockingModal(id: string, visible: boolean) {
  useEffect(() => {
    if (!visible) {
      return;
    }

    markBlockingModalVisible(id, true);

    return () => {
      markBlockingModalVisible(id, false);
    };
  }, [id, visible]);
}

export function setModalGateDiagnosticsEnabled(enabled: boolean) {
  modalGateStore.setState(prev => {
    if (prev.diagnosticsEnabled === enabled) {
      return prev;
    }

    return {
      ...prev,
      diagnosticsEnabled: enabled,
    };
  });
}

export function useModalGateDiagnosticsEnabled() {
  return modalGateStore(s => s.diagnosticsEnabled);
}

export const setModalGateDebugOverlayEnabled = setModalGateDiagnosticsEnabled;
export const useModalGateDebugOverlayEnabled = useModalGateDiagnosticsEnabled;

runDevIIFEFunc(() => {
  (globalThis as any).__dumpBlockingModalIds = () => {
    return getVisibleBlockingModalIds();
  };
  (globalThis as any).__dumpModalGateDebugSnapshot = () => {
    return getModalGateDebugSnapshot();
  };
  (globalThis as any).__setModalDebugOverlayEnabled = (enabled: boolean) => {
    setModalGateDiagnosticsEnabled(!!enabled);
  };
  (globalThis as any).__setModalDiagnosticsEnabled = (enabled: boolean) => {
    setModalGateDiagnosticsEnabled(!!enabled);
  };
});
