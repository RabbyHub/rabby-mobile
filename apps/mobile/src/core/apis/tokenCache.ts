import { makeSWRKeyAsyncFunc } from '@/core/utils/concurrency';
import { requestOpenApiWithChainId } from '@/utils/openapi';

export const queryTokensCache = makeSWRKeyAsyncFunc(
  (user_id: string, isTestnet: boolean = false) => {
    return requestOpenApiWithChainId(
      ({ openapi }) => openapi.getCachedTokenList(user_id),
      {
        isTestnet,
      },
    );
  },
  ctx => [`${ctx.args[0]}-${ctx.args[1]}`],
);
