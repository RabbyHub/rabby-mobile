import { pQueue } from './project';
import { openapi, testOpenapi } from '@/core/request';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';

export const loadPortfolioSnapshot = (userAddr: string) => {
  return pQueue.add(() => {
    return openapi.getComplexProtocolList(userAddr);
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
