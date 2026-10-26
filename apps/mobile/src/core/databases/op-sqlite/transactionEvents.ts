import type { DB } from '@op-engineering/op-sqlite';

import type { EventBusListeners } from './events';

type EmitDatabaseEvent = <T extends keyof EventBusListeners & string>(
  eventType: T,
  ...args: Parameters<EventBusListeners[T]>
) => void;

export function bindOpSqliteTransactionEvents(
  database: DB,
  emit: EmitDatabaseEvent,
) {
  const pendingTables = new Set<string>();

  database.updateHook(payload => {
    pendingTables.add(payload.table);
    emit('UPDATE_HOOK', payload);
  });
  database.commitHook(() => {
    if (!pendingTables.size) {
      return;
    }

    const tables = Array.from(pendingTables);
    pendingTables.clear();
    emit('DATABASE_COMMITTED', { tables });
  });
  database.rollbackHook(() => {
    pendingTables.clear();
  });

  return () => {
    pendingTables.clear();
    database.updateHook(null);
    database.commitHook(null);
    database.rollbackHook(null);
  };
}
