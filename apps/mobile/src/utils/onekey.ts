import {
  EVENT_NAMES,
  MODAL_NAMES,
} from '@/components/GlobalBottomSheetModal/types';
import type { OneKeyKeyring } from '@/core/keyring-bridge/onekey/onekey-keyring';
import { KeyringInstance } from '@rabby-wallet/service-keyring';
import { eventBus, EVENTS } from './events';
import { appWinCaller } from '@/core/services/appWin';

// 当前版本的 OneKeyKeyring 仅支持在设备上输入 PIN 和 Passphrase
const ONLY_IN_DEVICE = true;

let pinModalId: string | null = null;
let passphraseModalId: string | null = null;

async function createPinModal(
  oneKeyKeyring: OneKeyKeyring,
  connectId: string,
  modalName: MODAL_NAMES,
) {
  pinModalId = await appWinCaller.createGlobalBottomSheetModal({
    name: modalName,
    onConfirm(pin: string, switchOnDevice: boolean) {
      oneKeyKeyring.bridge.receivePin({
        pin,
        switchOnDevice,
      });
    },
  });

  eventBus.once(EVENTS.ONEKEY.CLOSE_UI_WINDOW, async () => {
    await appWinCaller.removeGlobalBottomSheetModal(pinModalId);
    pinModalId = null;
  });

  appWinCaller.globalBottomSheetModalAddListener(
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

async function createPassphraseModal(
  oneKeyKeyring: OneKeyKeyring,
  connectId: string,
  modalName: MODAL_NAMES,
) {
  passphraseModalId = await appWinCaller.createGlobalBottomSheetModal({
    name: modalName,
    onConfirm(passphrase: string, switchOnDevice: boolean) {
      oneKeyKeyring.bridge.receivePassphrase({
        passphrase,
        switchOnDevice,
      });
    },
  });

  eventBus.once(EVENTS.ONEKEY.CLOSE_UI_WINDOW, async () => {
    await appWinCaller.removeGlobalBottomSheetModal(passphraseModalId);
    passphraseModalId = null;
  });

  appWinCaller.globalBottomSheetModalAddListener(
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

export function bindOneKeyEvents(keyring: KeyringInstance) {
  const oneKeyKeyring = keyring as unknown as OneKeyKeyring;

  oneKeyKeyring.init();

  eventBus.on(EVENTS.ONEKEY.REQUEST_PIN, e => {
    const connectId = e?.payload?.device?.connectId;

    if (pinModalId) {
      return;
    }

    if (ONLY_IN_DEVICE) {
      oneKeyKeyring.bridge.receivePin({
        switchOnDevice: true,
      });

      createPinModal(
        oneKeyKeyring,
        connectId,
        MODAL_NAMES.ONEKEY_TEMP_PIN_OR_PASSPHRASE,
      );
      return;
    }

    createPinModal(oneKeyKeyring, connectId, MODAL_NAMES.ONEKEY_INPUT_PIN);
  });

  eventBus.on(EVENTS.ONEKEY.REQUEST_PASSPHRASE, e => {
    const connectId = e?.payload?.device?.connectId;

    if (passphraseModalId) {
      return;
    }

    if (ONLY_IN_DEVICE) {
      oneKeyKeyring.bridge.receivePassphrase({
        passphrase: '',
        switchOnDevice: true,
      });

      createPassphraseModal(
        oneKeyKeyring,
        connectId,
        MODAL_NAMES.ONEKEY_TEMP_PIN_OR_PASSPHRASE,
      );
      return;
    }

    createPassphraseModal(
      oneKeyKeyring,
      connectId,
      MODAL_NAMES.ONEKEY_INPUT_PASSPHRASE,
    );
  });
}
