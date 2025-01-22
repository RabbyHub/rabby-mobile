import { BaseEntity } from 'typeorm/browser';
import { ClassOf } from '@rabby-wallet/base-utils';

import { makeJsEEClass } from '@/core/services/_utils';
import { EntityAddressAssetBase } from '../entities/base';
import { useEffect } from 'react';

export type SyncTaskOptions = {
  owner_addr: string;
  taskFor:
    | 'token'
    | 'all-history'
    | 'swap-history'
    | 'nfts'
    | 'portocols'
    | 'balance';
};

type RemoteDataUpsertedCtx<
  T extends EntityAddressAssetBase = EntityAddressAssetBase,
> = {
  entityCls: ClassOf<EntityAddressAssetBase> & typeof BaseEntity;
  taskFor: SyncTaskOptions['taskFor'] | '@unknown';
  owner_addr: string;
  syncDetails: {
    items: T[];
    count: number;
    total: number;
    round: number;
    batchSize: number;
  };
  success: boolean;
};

const { EventEmitter: AppORMEvents } = makeJsEEClass<{
  onRemoteDataUpserted: <T extends EntityAddressAssetBase>(
    ctx: RemoteDataUpsertedCtx<T>,
  ) => void;
}>();

export const appOrmEvents = new AppORMEvents();

export function useAppOrmSyncEvents<
  T extends SyncTaskOptions['taskFor'],
>(options: {
  taskFor: T | T[];
  onRemoteDataUpserted: (ctx: Omit<RemoteDataUpsertedCtx, 'items'>) => void;
}) {
  const { taskFor, onRemoteDataUpserted } = options;
  useEffect(() => {
    const taskFors = Array.isArray(taskFor) ? taskFor : [taskFor];
    const listener: Parameters<(typeof appOrmEvents)['on']>[1] = ctx => {
      if (
        !taskFors.includes(ctx.taskFor as T) ||
        ['@unknown'].includes(ctx.taskFor)
      )
        return;

      // console.debug('onRemoteDataUpserted:: ctx', ctx);
      onRemoteDataUpserted(ctx);
    };
    appOrmEvents.on('onRemoteDataUpserted', listener);

    return () => {
      appOrmEvents.off('onRemoteDataUpserted', listener);
    };
  }, [taskFor, onRemoteDataUpserted]);
}
