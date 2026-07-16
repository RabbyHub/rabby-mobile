import { eventBus, EVENTS } from '@/utils/events';
import { LedgerKeyring } from '@rabby-wallet/eth-keyring-ledger';
import { KeyringInstance } from '@rabby-wallet/service-keyring';

export function bindLedgerEvents(keyring: KeyringInstance) {
  (keyring as unknown as LedgerKeyring).events.on(
    EVENTS.broadcastToUI,
    (data: any) => {
      eventBus.emit(data.method, data.params);
    },
  );
}

export const isLedgerLockError = (message = '') => {
  return (
    message.includes('0x5515') ||
    message.includes('0x6b0c') ||
    message.includes('0x650f')
  );
};
