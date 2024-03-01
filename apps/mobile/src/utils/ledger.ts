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
