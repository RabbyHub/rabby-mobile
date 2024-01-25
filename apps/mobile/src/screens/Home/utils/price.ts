import { openapi, testOpenapi } from '@/core/request';
import { chunk } from 'lodash';
import { pQueue } from './project';

// 历史 token 价格
export const getTokenHistoryPrice = async (
  chain: string,
  ids: string[],
  time_at: number,
  isTestnet = false,
) => {
  const idChunks = chunk(ids, 100);

  const res = await Promise.all(
    idChunks.map(c =>
      pQueue.add(() => {
        if (isTestnet) {
          return testOpenapi
            .getTokenHistoryDict({
              chainId: chain,
              ids: c.join(','),
              timeAt: time_at,
            })
            .catch(() => null);
        }
        return openapi
          .getTokenHistoryDict({
            chainId: chain,
            ids: c.join(','),
            timeAt: time_at,
          })
          .catch(() => null);
      }),
    ),
  );

  return res.reduce(
    (m, n) => (n ? { ...m, ...n } : m),
    {} as Record<string, number>,
  );
};
