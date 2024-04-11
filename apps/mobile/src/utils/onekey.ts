import type { OneKeyKeyring } from '@/core/keyring-bridge/onekey/onekey-keyring';
import { KeyringInstance } from '@rabby-wallet/service-keyring';
import { eventBus, EVENTS } from './events';

export function bindOneKeyEvents(keyring: KeyringInstance) {
  (keyring as unknown as OneKeyKeyring).init();

  eventBus.on(EVENTS.ONEKEY.REQUEST_PIN, () => {
    // create a modal to receive pin
  });

  eventBus.on(EVENTS.ONEKEY.REQUEST_PASSPHRASE, () => {
    // create a modal to receive passphrase
  });
}
