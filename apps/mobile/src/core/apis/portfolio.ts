import { openapi, testOpenapi } from '@/core/request';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';
import { pQueue } from '@/utils/requestQueue';

export type PortfolioSnapshotRequestPhase =
  | 'queue-entered'
  | 'request-started'
  | 'request-fulfilled'
  | 'request-rejected';

export type PortfolioSnapshotRequestDetails = {
  queueSize?: number;
  pendingCount?: number;
  queueWaitMs?: number;
  requestMs?: number;
  itemCount?: number;
};

export type PortfolioSnapshotRequestObserver = (
  phase: PortfolioSnapshotRequestPhase,
  details: PortfolioSnapshotRequestDetails,
) => void;

export const loadPortfolioSnapshot = (
  userAddr: string,
  observe?: PortfolioSnapshotRequestObserver,
) => {
  const queuedAt = Date.now();
  observe?.('queue-entered', {
    queueSize: pQueue.size,
    pendingCount: pQueue.pending,
  });
  return pQueue.add(async () => {
    const startedAt = Date.now();
    observe?.('request-started', {
      queueWaitMs: startedAt - queuedAt,
    });
    try {
      const result = await openapi.getComplexProtocolList(userAddr);
      observe?.('request-fulfilled', {
        requestMs: Date.now() - startedAt,
        itemCount: result?.length || 0,
      });
      return result;
    } catch (error) {
      observe?.('request-rejected', {
        requestMs: Date.now() - startedAt,
      });
      throw error;
    }
  });
};

export const loadTestnetPortfolioSnapshot = (userAddr: string) => {
  return pQueue.add(() => {
    return testOpenapi.getComplexProtocolList(userAddr);
  });
};

export const batchLoadProjects = makeSWRKeyAsyncFunc(
  async (
    user_id: string,
    projectIds: string[],
    isTestnet = false,
    ignoreSingleError = false,
  ) => {
    const queues = projectIds.map(id =>
      pQueue.add(async () => {
        try {
          if (isTestnet) {
            return await testOpenapi.getProtocol({ addr: user_id, id });
          } else {
            return await openapi.getProtocol({ addr: user_id, id });
          }
        } catch (error) {
          console.error(`Failed to load protocol for project ${id}:`, error);
          if (ignoreSingleError) {
            return null;
          }
          throw error;
        }
      }),
    );
    return await Promise.all(queues);
  },
  ctx => [
    ctx.args[0],
    ctx.args[1].join(','),
    ctx.args[2] ? 'testnet' : 'mainnet',
    ctx.args[3] ? 'ignoreError' : 'strict',
  ],
);
