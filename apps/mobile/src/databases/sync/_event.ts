import { BaseEntity } from 'typeorm/browser';
import { ClassOf } from '@rabby-wallet/base-utils';

import { makeJsEEClass } from '@/core/services/_utils';
import { EntityAddressAssetBase } from '../entities/base';
import { useEffect, useMemo, useRef } from 'react';
import { safeParseJSON } from '@rabby-wallet/base-utils/dist/isomorphic/string';

export type SyncTaskOptions = {
  owner_addr: string;
  taskFor:
    | 'token'
    | 'all-history'
    | 'swap-history'
    | 'nfts'
    | 'protocols'
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
  const taskForListStr = useMemo(
    () => JSON.stringify((Array.isArray(taskFor) ? taskFor : [taskFor]).sort()),
    [taskFor],
  );

  const fnsRef = useRef({ onRemoteDataUpserted });

  useEffect(() => {
    fnsRef.current.onRemoteDataUpserted = onRemoteDataUpserted;
  }, [onRemoteDataUpserted]);

  useEffect(() => {
    let isMounted = true;
    const taskFors = safeParseJSON(taskForListStr);
    const listener: Parameters<(typeof appOrmEvents)['on']>[1] = ctx => {
      if (!isMounted) return;
      if (
        !taskFors.includes(ctx.taskFor as T) ||
        ['@unknown'].includes(ctx.taskFor)
      )
        return;

      fnsRef.current.onRemoteDataUpserted?.(ctx);
    };

    // console.warn('[debug] useAppOrmSyncEvents mounted');
    appOrmEvents.on('onRemoteDataUpserted', listener);

    return () => {
      isMounted = false;
      // console.warn('[debug] useAppOrmSyncEvents cleanup: %s', taskFors);
      appOrmEvents.off('onRemoteDataUpserted', listener);
    };
  }, [taskForListStr]);
}
