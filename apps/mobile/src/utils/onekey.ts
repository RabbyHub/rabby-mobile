import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import type { OneKeyKeyring } from '@/core/keyring-bridge/onekey/onekey-keyring';
import { KeyringInstance } from '@rabby-wallet/service-keyring';
import { eventBus, EVENTS } from './events';

export function bindOneKeyEvents(keyring: KeyringInstance) {
  const oneKeyKeyring = keyring as unknown as OneKeyKeyring;

  oneKeyKeyring.init();
  let pinModalId: string | null = null;
  let passphraseModalId: string | null = null;

  eventBus.on(EVENTS.ONEKEY.REQUEST_PIN, () => {
    if (pinModalId) {
      return;
    }
    pinModalId = createGlobalBottomSheetModal({
      name: MODAL_NAMES.ONEKEY_INPUT_PIN,
      onConfirm(pin: string, switchOnDevice: boolean) {
        oneKeyKeyring.bridge.receivePin({
          pin,
          switchOnDevice,
        });
        eventBus.once(EVENTS.ONEKEY.CLOSE_UI_WINDOW, () => {
          removeGlobalBottomSheetModal(pinModalId);
          pinModalId = null;
        });
      },
    });
  });
  eventBus.on(EVENTS.ONEKEY.REQUEST_PASSPHRASE, () => {
    if (passphraseModalId) {
      return;
    }
    passphraseModalId = createGlobalBottomSheetModal({
      name: MODAL_NAMES.ONEKEY_INPUT_PASSPHRASE,
      onConfirm(passphrase: string, switchOnDevice: boolean) {
        oneKeyKeyring.bridge.receivePassphrase({
          passphrase,
          switchOnDevice,
        });
        eventBus.once(EVENTS.ONEKEY.CLOSE_UI_WINDOW, () => {
          removeGlobalBottomSheetModal(passphraseModalId);
          passphraseModalId = null;
        });
      },
    });
  });
}
