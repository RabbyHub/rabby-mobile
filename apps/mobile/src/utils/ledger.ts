import { eventBus, EVENTS } from '@/utils/events';
import { LedgerKeyring } from '@rabby-wallet/eth-keyring-ledger';
import { KeyringInstance } from '@rabby-wallet/service-keyring';

export function bindLedgerEvents(keyring: KeyringInstance) {
  (keyring as unknown as LedgerKeyring).events.on(
    EVENTS.LEDGER.REJECTED,
    (data: any) => {
      eventBus.emit(EVENTS.LEDGER.REJECTED, data);
    },
  );
}
