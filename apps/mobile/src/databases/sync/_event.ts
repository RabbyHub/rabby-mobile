import { BaseEntity } from 'typeorm/browser';
import { ClassOf } from '@rabby-wallet/base-utils';

import { makeJsEEClass } from '@/core/services/_utils';
import { EntityAddressAssetBase } from '../entities/base';
import { useEffect, useMemo, useRef } from 'react';
import { safeParseJSON } from '@rabby-wallet/base-utils/dist/isomorphic/string';
import { useCreationWithShallowCompare } from '@/hooks/common/useMemozied';

export type SyncTaskOptions = {
  owner_addr: string;
  taskFor:
    | 'token'
    | 'all-history'
    | 'swap-history'
    | 'nfts'
    | 'protocols'
    | 'balance'
    | 'buy-history'
    | 'cex';
};

type RemoteDataUpsertedCtx = {
  taskFor: SyncTaskOptions['taskFor'] | '@unknown';
  owner_addr: string;
  syncDetails: {
    // items: T[];
    count: number;
    total: number;
    round: number;
    batchSize: number;
  };
  success: boolean;
};

const { EventEmitter: AppORMEvents } = makeJsEEClass<{
  onRemoteDataUpserted: (ctx: RemoteDataUpsertedCtx) => void;
}>();

export const appOrmEvents = new AppORMEvents();
appOrmEvents.setMaxListeners(50);

export function useAppOrmSyncEvents<
  T extends SyncTaskOptions['taskFor'],
>(options: {
  taskFor: T | T[];
  onRemoteDataUpserted: (ctx: Omit<RemoteDataUpsertedCtx, 'items'>) => void;
}) {
  const { taskFor, onRemoteDataUpserted } = options;
  const sortedTask = useMemo(
    () => (Array.isArray(taskFor) ? taskFor.slice().sort() : [taskFor]),
    [taskFor],
  );
  const taskForListStr = useCreationWithShallowCompare(
    () => JSON.stringify(sortedTask),
    [sortedTask],
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

export function onAppOrmSyncEvents<
  T extends SyncTaskOptions['taskFor'],
>(options: {
  taskFor: T | T[];
  onRemoteDataUpserted: (ctx: Omit<RemoteDataUpsertedCtx, 'items'>) => void;
}) {
  const { taskFor, onRemoteDataUpserted } = options;
  const taskFors = Array.isArray(taskFor) ? taskFor : [taskFor].sort();

  const subscription = appOrmEvents.subscribe('onRemoteDataUpserted', ctx => {
    if (
      !taskFors.includes(ctx.taskFor as T) ||
      ['@unknown'].includes(ctx.taskFor)
    )
      return;

    onRemoteDataUpserted(ctx);
  });

  return subscription;
}
