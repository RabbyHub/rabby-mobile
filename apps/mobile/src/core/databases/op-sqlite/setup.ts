import { DB } from '@op-engineering/op-sqlite';
import { getLatestOpSqliteDBInstance } from './typeorm';
import { OPSQLiteEvents } from './events';
import { reactotronEvents } from '@/core/utils/reactotron-plugins/_utils';
import { runDevIIFEFunc } from '@/core/utils/store';

export const waitFirstDBInited = new Promise<DB>(resolve => {
  const inst = getLatestOpSqliteDBInstance();
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

const prevDbRef = { current: null as null | DB };

OPSQLiteEvents.subscribe('__OP_SQLITE_LOADED__', ({ database }) => {
  if (prevDbRef.current && prevDbRef.current !== database) {
    prevDbRef.current.updateHook(null);
  }
  prevDbRef.current = database;
  database.updateHook(payload => {
    OPSQLiteEvents.emit('UPDATE_HOOK', payload);
  });
});

runDevIIFEFunc(() => {
  reactotronEvents.subscribe('CM_EXECUTE_SQL', payload => {
    // const db = await waitFirstDBInited;
    const loggerPrefix = `[Reactotron CM_EXECUTE_SQL::${payload.reqid}]`;
    console.debug(`${loggerPrefix} sql`, payload.sql);

    if (!payload.sql) {
      console.warn(`${loggerPrefix} No SQL provided, aborting.`);
      return;
    }

    if (!prevDbRef.current) {
      console.error(`${loggerPrefix} No database instance available.`);
      return;
    }

    try {
      const result = prevDbRef.current?.executeRawSync(payload.sql, []);

      console.debug(`${loggerPrefix} result`, result);
    } catch (error) {
      console.error(`${loggerPrefix} error`, error);
    }
  });
});
