import { PortfolioProject } from '../types';
import { pQueue, DisplayedProject } from './project';
import { getTokenHistoryPrice } from './price';
import { openapi, testOpenapi } from '@/core/request';
import { ProtocolItemEntity } from '@/databases/entities/portocolItem';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';

export const snapshot2Display = (projects?: PortfolioProject[]) => {
  if (!projects) {
    return { list: {}, netWorth: 0 };
  }

  const result = {} as Record<string, DisplayedProject>;
  let netWorth = 0;

  for (let i = 0; i < projects.length; i++) {
    const { portfolio_item_list, ...p } = projects[i];
    const project = new DisplayedProject(p, portfolio_item_list);
    result[project.id] = project;

    netWorth += project.netWorth;
  }

  return { list: result, netWorth };
};

export const portfolio2Display = (
  p: PortfolioProject,
  dict: Record<string, DisplayedProject>,
) => {
  // fetched failed
  if (!p) {
    return;
  }

  // 如果 positions 没有 中多出来
  if (!p.portfolio_item_list?.length) {
    delete dict[p.id];

    return;
  }

  // 如果 snapshot 中没有
  dict[p.id] = new DisplayedProject(p, p.portfolio_item_list);
};

export const patchPortfolioHistory = (
  portfolio: PortfolioProject,
  dict: Record<string, DisplayedProject>,
) => {
  // fetched failed
  if (!portfolio) {
    return;
  }

  const projectId = portfolio.id;

  // history empty, 100% increse
  if (dict[projectId]) {
    dict[projectId].patchHistory(portfolio.portfolio_item_list, true);
  }
};

export const loadPortfolioSnapshot = (userAddr: string) => {
  return pQueue.add(() => {
    return openapi.getComplexProtocolList(userAddr);
  });
};

export const loadAppChainList = (userAddr: string) => {
  return pQueue.add(() => {
    return openapi.getAppChainList(userAddr);
  });
};

export const getCachedPortfolios = async (
  userAddr: string,
  force?: boolean,
) => {
  if (force) {
    return false;
  }
  const isExpired = await ProtocolItemEntity.isExpired(userAddr);
  if (isExpired) {
    return false;
  }
  return ProtocolItemEntity.batchQueryPortocols(userAddr);
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

export const batchLoadHistoryProjects = async (
  user_id: string,
  projectIds: string[],
  time_at?: number,
  isTestnet = false,
) => {
  const queues = projectIds.map(id => {
    return pQueue.add(() => {
      if (isTestnet) {
        return testOpenapi.getHistoryProtocol({
          addr: user_id,
          id,
          timeAt: time_at,
        });
      }
      return openapi.getHistoryProtocol({
        addr: user_id,
        id,
        timeAt: time_at,
      });
    });
  });
  const result = await Promise.all(queues);
  return result;
};

export const getMissedTokenPrice = async (
  missedTokens: Record<string, Set<string>>,
  timeAt: number,
  isTestnet = false,
) => {
  const tokens = missedTokens && Object.entries(missedTokens);

  if (!tokens?.length) {
    return;
  }

  return Promise.all(
    tokens.map(([chain, missed]) =>
      getTokenHistoryPrice(chain, [...missed], timeAt, isTestnet)
        .then(dict => [chain, dict] as const)
        .catch(() => [chain] as const),
    ),
  ).then(dicts => {
    return dicts.reduce((m, n) => {
      if (n[1]) {
        m[n[0]] = n[1];
      }

      return m;
    }, {} as Record<string, Record<string, number>>);
  });
};
