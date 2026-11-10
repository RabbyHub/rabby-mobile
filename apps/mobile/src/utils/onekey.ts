import {
  EVENT_NAMES,
  MODAL_NAMES,
} from '@/components2024/GlobalBottomSheetModal/types';
import type { OneKeyKeyring } from '@/core/keyring-bridge/onekey/onekey-keyring';
import type { KeyringInstance } from '@rabby-wallet/service-keyring';
import {
  EVENT_ONEKEY_CLOSE_UI_PIN_WINDOW,
  EVENT_ONEKEY_REQUEST_BUTTON,
  EVENT_ONEKEY_REQUEST_PASSPHRASE_ON_DEVICE,
  eventBus,
  EVENTS,
} from './events';
import { apisAppWin2024 } from '@/core/serviceApi/appWin';
import type { MODAL_ID } from '@/components2024/GlobalBottomSheetModal/types';
import type { UiResponseCorrelation } from '@onekeyfe/hd-core';

// 当前版本的 OneKeyKeyring 仅支持在设备上输入 PIN 和 Passphrase
const ONLY_IN_DEVICE = true;

let pinModalId: MODAL_ID | null = null;
let passphraseModalId: MODAL_ID | null = null;
let activeOneKeyKeyring: OneKeyKeyring | null = null;
let oneKeyEventsBound = false;

function currentOneKeyKeyring() {
  return activeOneKeyKeyring as OneKeyKeyring;
}

function removeOneKeyModal(modalId: MODAL_ID | null) {
  if (!modalId) {
    return;
  }
  if (pinModalId === modalId) {
    pinModalId = null;
  }
  if (passphraseModalId === modalId) {
    passphraseModalId = null;
  }
  apisAppWin2024.removeGlobalBottomSheetModal(modalId, {
    waitMaxtime: 300,
  });
}

function closePinModal() {
  removeOneKeyModal(pinModalId);
}

function closePassphraseModal() {
  removeOneKeyModal(passphraseModalId);
}

function closeDeviceInputModals() {
  closePinModal();
  closePassphraseModal();
}

function createPinModal(
  oneKeyKeyring: OneKeyKeyring,
  connectId: string,
  modalName: MODAL_NAMES,
  responseCorrelation?: UiResponseCorrelation,
  deviceOnly = false,
) {
  pinModalId = apisAppWin2024.createGlobalBottomSheetModal({
    name: modalName,
    onConfirm(pin: string, switchOnDevice: boolean) {
      if (deviceOnly) {
        return;
      }
      oneKeyKeyring.bridge.receivePin({
        pin,
        switchOnDevice,
        ...(responseCorrelation ? { responseCorrelation } : {}),
      });
    },
  });

  eventBus.once(EVENTS.ONEKEY.CLOSE_UI_WINDOW, () => {
    closePinModal();
  });

  apisAppWin2024.globalBottomSheetModalAddListener(
    EVENT_NAMES.DISMISS,
    _id => {
      if (_id !== pinModalId) {
        return;
      }
      oneKeyKeyring.bridge.cancel(connectId);
      pinModalId = null;
    },
    true,
  );
}

function createPassphraseModal(
  oneKeyKeyring: OneKeyKeyring,
  connectId: string,
  modalName: MODAL_NAMES,
  responseCorrelation?: UiResponseCorrelation,
) {
  passphraseModalId = apisAppWin2024.createGlobalBottomSheetModal({
    name: modalName,
    onConfirm(passphrase: string, switchOnDevice: boolean) {
      oneKeyKeyring.bridge.receivePassphrase({
        passphrase,
        switchOnDevice,
        ...(responseCorrelation ? { responseCorrelation } : {}),
      });
    },
  });

  eventBus.once(EVENTS.ONEKEY.CLOSE_UI_WINDOW, async () => {
    closePassphraseModal();
  });

  apisAppWin2024.globalBottomSheetModalAddListener(
    EVENT_NAMES.DISMISS,
    _id => {
      if (_id !== passphraseModalId) {
        return;
      }
      oneKeyKeyring.bridge.cancel(connectId);
      passphraseModalId = null;
    },
    true,
  );
}

/**
 * The eventBus listeners are global, so bind them once and route every
 * request to the most recently bound keyring. Binding them per keyring
 * instance answered each PIN / passphrase request once per instance.
 */
export function bindOneKeyEvents(keyring: KeyringInstance | OneKeyKeyring) {
  activeOneKeyKeyring = keyring as unknown as OneKeyKeyring;

  if (oneKeyEventsBound) {
    return;
  }
  oneKeyEventsBound = true;

  eventBus.on(EVENT_ONEKEY_CLOSE_UI_PIN_WINDOW, closeDeviceInputModals);
  eventBus.on(EVENT_ONEKEY_REQUEST_BUTTON, closeDeviceInputModals);

  eventBus.on(EVENTS.ONEKEY.REQUEST_PIN, e => {
    const connectId = e?.payload?.device?.connectId;
    const responseCorrelation = e?.payload?.responseCorrelation;
    const deviceOnly =
      e?.payload?.deviceOnly === true ||
      e?.payload?.interaction?.protocol === 'V2';

    if (ONLY_IN_DEVICE) {
      if (!pinModalId) {
        createPinModal(
          currentOneKeyKeyring(),
          connectId,
          MODAL_NAMES.ONEKEY_TEMP_PIN_OR_PASSPHRASE,
          responseCorrelation,
          deviceOnly,
        );
      }

      if (deviceOnly) {
        return;
      }
      currentOneKeyKeyring().bridge.receivePin({
        switchOnDevice: true,
        ...(responseCorrelation ? { responseCorrelation } : {}),
      });
      return;
    }

    if (pinModalId) {
      return;
    }

    createPinModal(
      currentOneKeyKeyring(),
      connectId,
      MODAL_NAMES.ONEKEY_INPUT_PIN,
      responseCorrelation,
      deviceOnly,
    );
  });

  eventBus.on(EVENTS.ONEKEY.REQUEST_PASSPHRASE, e => {
    const connectId = e?.payload?.device?.connectId;
    const responseCorrelation = e?.payload?.responseCorrelation;

    if (ONLY_IN_DEVICE) {
      if (!passphraseModalId) {
        createPassphraseModal(
          currentOneKeyKeyring(),
          connectId,
          MODAL_NAMES.ONEKEY_TEMP_PIN_OR_PASSPHRASE,
          responseCorrelation,
        );
      }

      currentOneKeyKeyring().bridge.receivePassphrase({
        passphrase: '',
        switchOnDevice: true,
        ...(responseCorrelation ? { responseCorrelation } : {}),
      });
      return;
    }

    if (passphraseModalId) {
      return;
    }

    createPassphraseModal(
      currentOneKeyKeyring(),
      connectId,
      MODAL_NAMES.ONEKEY_INPUT_PASSPHRASE,
      responseCorrelation,
    );
  });

  eventBus.on(EVENT_ONEKEY_REQUEST_PASSPHRASE_ON_DEVICE, e => {
    const connectId = e?.payload?.device?.connectId;

    if (passphraseModalId) {
      return;
    }

    createPassphraseModal(
      currentOneKeyKeyring(),
      connectId,
      MODAL_NAMES.ONEKEY_TEMP_PIN_OR_PASSPHRASE,
    );
  });
}
