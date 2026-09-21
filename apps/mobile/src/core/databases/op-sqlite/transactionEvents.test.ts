import type { DB } from '@op-engineering/op-sqlite';

import { bindOpSqliteTransactionEvents } from './transactionEvents';

describe('OP-SQLite transaction events', () => {
  const createDatabase = () => {
    let update: Parameters<DB['updateHook']>[0];
    let commit: Parameters<DB['commitHook']>[0];
    let rollback: Parameters<DB['rollbackHook']>[0];
    const database = {
      updateHook: jest.fn(callback => {
        update = callback;
      }),
      commitHook: jest.fn(callback => {
        commit = callback;
      }),
      rollbackHook: jest.fn(callback => {
        rollback = callback;
      }),
    } as unknown as DB;

    return {
      database,
      update: (payload: Parameters<NonNullable<typeof update>>[0]) =>
        update?.(payload),
      commit: () => commit?.(),
      rollback: () => rollback?.(),
    };
  };

  it('publishes one table set only after a successful commit', () => {
    const db = createDatabase();
    const emit = jest.fn();
    bindOpSqliteTransactionEvents(db.database, emit);

    db.update({ table: 'projection_item', operation: 'INSERT', rowId: 1 });
    db.update({ table: 'projection_item', operation: 'INSERT', rowId: 2 });
    db.update({ table: 'projection_snapshot', operation: 'INSERT', rowId: 3 });

    expect(emit).toHaveBeenCalledTimes(3);
    db.commit();
    expect(emit).toHaveBeenLastCalledWith('DATABASE_COMMITTED', {
      tables: ['projection_item', 'projection_snapshot'],
    });
  });

  it('drops pending changes on rollback', () => {
    const db = createDatabase();
    const emit = jest.fn();
    bindOpSqliteTransactionEvents(db.database, emit);

    db.update({ table: 'projection_snapshot', operation: 'INSERT', rowId: 1 });
    db.rollback();
    db.commit();

    expect(emit).not.toHaveBeenCalledWith(
      'DATABASE_COMMITTED',
      expect.anything(),
    );
  });

  it('removes all native hooks when the connection is replaced', () => {
    const db = createDatabase();
    const dispose = bindOpSqliteTransactionEvents(db.database, jest.fn());

    dispose();

    expect(db.database.updateHook).toHaveBeenLastCalledWith(null);
    expect(db.database.commitHook).toHaveBeenLastCalledWith(null);
    expect(db.database.rollbackHook).toHaveBeenLastCalledWith(null);
  });
});
