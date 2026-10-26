import { DB } from '@op-engineering/op-sqlite';
import { makeJsEEClass } from '@/core/utils/makeJsEEClass';

type UppdateHookPayload = Parameters<
  Parameters<DB['updateHook']>[0] & Function
>[0];

export type EventBusListeners = {
  __OP_SQLITE_LOADED__: (ctx: { database: DB }) => void;

  UPDATE_HOOK: (payload: UppdateHookPayload) => void;

  DATABASE_COMMITTED: (ctx: { tables: string[] }) => void;

  ASSET_TOKEN_TAG_TABLE_READY: () => void;

  TRIGGER_TOKEN_STATICS_REFRESH: () => void;
};
type Listeners = {
  [P: string]: (data: any) => void;
};
const { EventEmitter: EE } = makeJsEEClass<EventBusListeners & Listeners>();

export const OPSQLiteEvents = new EE();
