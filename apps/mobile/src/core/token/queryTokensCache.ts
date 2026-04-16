import { requestOpenApiWithChainId } from '@/utils/openapi';
import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';

export const queryTokensCache = makeSWRKeyAsyncFunc(
  (userId: string, isTestnet = false) => {
    return requestOpenApiWithChainId(
      ({ openapi }) => openapi.getCachedTokenList(userId),
      {
        isTestnet,
      },
    );
  },
  ctx => [`${ctx.args[0]}-${ctx.args[1]}`],
);
