import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { IosMenuViewRef } from '@rabby-wallet/zeego/menu';
import { useShallow } from 'zustand/react/shallow';

import { zCreate } from '@/core/utils/reexports';
import { runDevIIFEFunc } from '@/core/utils/store';

type ModalGateState = {
  blockingModalCountMap: Record<string, number>;
};

export const MODAL_GATE_IDS = {
  screenshotFeedback: 'screenshot-feedback',
  rateGuide: 'rate-guide',
  upgradePrompt: 'upgrade-prompt',
  swapModal: 'swap-modal',
  securityTip: 'security-tip',
  biometricsStub: 'biometrics-stub',
  accountSelectSheet: 'account-select-sheet',
  miniSignDirectOverlay: 'mini-sign-direct-overlay',
  debugReproModalA: 'debug-repro-modal-a',
  aliasNameEdit: 'alias-name-edit',
  qrCode: 'qr-code',
  duplicateAddress: 'duplicate-address',
  confirmSetPassword: 'confirm-set-password',
  addressConfirmDiscard: 'address-confirm-discard',
  syncExtensionNoNewAddresses: 'sync-extension-no-new-addresses',
  gasAccountSwitchLoginAddress: 'gas-account-switch-login-address',
  gasAccountDepositTokenAlert: 'gas-account-deposit-token-alert',
  gasAccountHeaderMenu: 'gas-account-header-menu',
  tokenDetailHeaderMenu: 'token-detail-header-menu',
  tokenContractCopyConfirm: 'token-contract-copy-confirm',
  perpsAgentsLimit: 'perps-agents-limit',
  perpsDepositToken: 'perps-deposit-token',
  perpsEditTpSlPrice: 'perps-edit-tp-sl-price',
  perpsGuideEntry: 'perps-guide-entry',
  perpsAutoClose: 'perps-auto-close',
  perpsProCancelConfirmation: 'perps-pro-cancel-confirmation',
  perpsProCloseAllConfirmation: 'perps-pro-close-all-confirmation',
  perpsProCloseConfirmation: 'perps-pro-close-confirmation',
  perpsProFieldExplanation: 'perps-pro-field-explanation',
  swapLowCredit: 'swap-low-credit',
  swapTokenInfo: 'swap-token-info',
  gnosisSameMessage: 'gnosis-same-message',
  hdKeystoneSwitchDevice: 'hd-keystone-switch-device',
  receiveWatchMode: 'receive-watch-mode',
  devServerSettings: 'dev-server-settings',
  devUpgradePromptPreview: 'dev-upgrade-prompt-preview',
  convertDustEntryGuide: 'convert-dust-entry-guide',
  convertDustStopSheet: 'convert-dust-stop-sheet',
  feedbackHistoryMediaPreview: 'feedback-history-media-preview',
  nativeMenu: 'native-menu',
  perpsProBasicOrderEdit: 'perps-pro-basic-order-edit',
  perpsProConditionalOrderEdit: 'perps-pro-conditional-order-edit',
  perpsProOpenOrderEditConfirmation: 'perps-pro-open-order-edit-confirmation',
  perpsProPositionTpSlConfirmation: 'perps-pro-position-tpsl-confirmation',
} as const;

export type ModalGateId = (typeof MODAL_GATE_IDS)[keyof typeof MODAL_GATE_IDS];

const modalGateStore = zCreate<ModalGateState>(() => ({
  blockingModalCountMap: {},
}));

function markBlockingModalVisible(id: ModalGateId, visible: boolean) {
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
  return modalGateStore(
    useShallow(s => Object.keys(s.blockingModalCountMap).sort()),
  );
}

export function resetModalGateForTests() {
  modalGateStore.setState({ blockingModalCountMap: {} });
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

/**
 * Imperatively mark a blocking surface visible. The returned release function
 * is idempotent, so callers can invoke it from both a close callback and an
 * unmount cleanup.
 */
export function acquireBlockingModal(id: ModalGateId) {
  markBlockingModalVisible(id, true);

  let released = false;
  return () => {
    if (released) {
      return;
    }

    released = true;
    markBlockingModalVisible(id, false);
  };
}

export function useRegisterBlockingModal(id: ModalGateId, visible: boolean) {
  useEffect(() => {
    if (!visible) {
      return;
    }

    return acquireBlockingModal(id);
  }, [id, visible]);
}

const openNativeMenuDismissers = new Set<() => void>();

/**
 * Ask every open native menu to close. Each menu releases the gate from its own
 * did-hide callback, so gated modals open only after the menu is fully gone.
 */
export function dismissOpenNativeMenus() {
  openNativeMenuDismissers.forEach(dismiss => dismiss());
}

/**
 * On iOS, an open zeego menu is a view controller presented on the root view
 * controller. UIKit rejects any RN `Modal` presented meanwhile, but RN keeps the
 * empty full-screen modal host view mounted, which then swallows every touch.
 * Spread the returned props onto a zeego menu `Root` so gated modals, such as
 * screenshot feedback, wait until the menu has fully hidden, and so
 * `dismissOpenNativeMenus()` can close it.
 *
 * Uses refs instead of state so opening a menu never re-renders its trigger.
 * Android menus don't fire these callbacks, so this is a no-op there.
 */
export function useNativeMenuModalGate() {
  const iosMenuViewRef = useRef<IosMenuViewRef | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);

  const release = useCallback(() => {
    releaseRef.current?.();
    releaseRef.current = null;
  }, []);

  const acquire = useCallback(() => {
    if (releaseRef.current) {
      return;
    }

    const releaseGate = acquireBlockingModal(MODAL_GATE_IDS.nativeMenu);
    const dismiss = () => {
      iosMenuViewRef.current?.dismissMenu().catch(error => {
        console.error('[modal-gate] dismiss native menu failed', error);
      });
    };
    openNativeMenuDismissers.add(dismiss);

    releaseRef.current = () => {
      openNativeMenuDismissers.delete(dismiss);
      releaseGate();
    };
  }, []);

  // The menu may unmount while open, in which case `onOpenChange(false)` never
  // fires.
  useEffect(() => release, [release]);

  const onOpenWillChange = useCallback(
    (willOpen: boolean) => {
      if (willOpen) {
        acquire();
      }
    },
    [acquire],
  );

  // Release only once the menu has fully hidden: the menu view controller is
  // still presented during the hide animation.
  const onOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        acquire();
      } else {
        release();
      }
    },
    [acquire, release],
  );

  return useMemo(
    () => ({ iosMenuViewRef, onOpenWillChange, onOpenChange }),
    [onOpenWillChange, onOpenChange],
  );
}

runDevIIFEFunc(() => {
  (globalThis as any).__dumpBlockingModalIds = () => {
    return getVisibleBlockingModalIds();
  };
  (globalThis as any).__dumpModalGateDebugSnapshot = () => {
    return getModalGateDebugSnapshot();
  };
});
