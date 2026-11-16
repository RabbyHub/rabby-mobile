import { zCreate } from '@/core/utils/reexports';
import type { BridgeHistoryPendingStatus } from '../utils/status';

export const useBridgeHistoryPendingStore = zCreate<{
  pendingByScene: Record<string, BridgeHistoryPendingStatus>;
}>(() => ({ pendingByScene: {} }));

export function setBridgeHistoryPending(
  sceneKey: string,
  pending: BridgeHistoryPendingStatus,
) {
  useBridgeHistoryPendingStore.setState(state => {
    if ((state.pendingByScene[sceneKey] ?? null) === pending) {
      return state;
    }
    const pendingByScene = { ...state.pendingByScene };
    if (pending) {
      pendingByScene[sceneKey] = pending;
    } else {
      delete pendingByScene[sceneKey];
    }
    return { pendingByScene };
  });
}
