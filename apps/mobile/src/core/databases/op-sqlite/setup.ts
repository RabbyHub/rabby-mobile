import { DB } from '@op-engineering/op-sqlite';
import { getOpSqliteDBInstance } from './typeorm';
import { OPSQLiteEvents } from './events';

export const waitDBInited = new Promise<DB>(resolve => {
  const inst = getOpSqliteDBInstance();
  if (inst) {
    console.debug('[op-sqlite] db already existed');
    resolve(inst);
    return;
  }

  console.debug('[op-sqlite] wait for __OP_SQLITE_LOADED__ event');

  OPSQLiteEvents.once('__OP_SQLITE_LOADED__', ctx => {
    console.debug('[op-sqlite] __OP_SQLITE_LOADED__ event received');
    resolve(ctx.database);
  });
});

waitDBInited.then(db => {
  db.updateHook(payload => {
    OPSQLiteEvents.emit('UPDATE_HOOK', payload);
  });
});
