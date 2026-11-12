import { CHAINS_ENUM } from '@debank/common';
import type { GasLevel, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import type { DEX_ENUM } from '@rabby-wallet/rabby-swap';
import type { Account } from '@/core/startupServices/preference';
import type {
  TDexQuoteData,
  useQuoteMethods,
} from '@/screens/Swap/hooks/quote';

export type GetDexQuote = ReturnType<typeof useQuoteMethods>['getDexQuote'];
type DexQuoteArgs = Parameters<GetDexQuote>[0];
type PreFetched = NonNullable<
  NonNullable<DexQuoteArgs['sharedTasks']>['preFetched']
>;

export type DexQuoteChain = {
  enum: CHAINS_ENUM | string;
  serverId: string;
  id: number;
  nativeTokenAddress: string;
};

export type DexQuoteDeps = {
  getDexQuote: GetDexQuote;
  getRecommendNonce(params: {
    from: string;
    chainId: number;
    account: Account;
  }): Promise<string>;
  getGasMarket(chainServerId: string): Promise<GasLevel[]>;
  getToken(
    userAddress: string,
    chainServerId: string,
    tokenId: string,
  ): Promise<TokenItem>;
};

const handled = <T>(task: Promise<T>) => {
  task.catch(() => undefined);
  return task;
};

/**
 * Same as Swap `_getAllQuotes`, but every call builds its own nonce / gas market /
 * native token tasks, so concurrent quotes on different chains never share the
 * hook-level ref caches (spec §5.1).
 */
export const fetchDexQuotesIsolated = async ({
  dexIds,
  chain,
  args,
  deps,
}: {
  dexIds: string[];
  chain: DexQuoteChain;
  args: Omit<
    DexQuoteArgs,
    'dexId' | 'sharedTasks' | 'onFinishedQuote' | 'setQuote'
  >;
  deps: DexQuoteDeps;
}): Promise<TDexQuoteData[]> => {
  const preFetched: PreFetched = {
    lastTimeGas: undefined,
    nativeToken: handled(
      deps.getToken(args.userAddress, chain.serverId, chain.nativeTokenAddress),
    ),
  };
  if (chain.enum !== CHAINS_ENUM.LINEA) {
    preFetched.gasMarket = handled(deps.getGasMarket(chain.serverId));
  }
  const recommendNonceTask = handled(
    deps.getRecommendNonce({
      from: args.userAddress,
      chainId: chain.id,
      account: args.account,
    }),
  );

  const quotes = await Promise.all(
    dexIds.map(dexId =>
      deps
        .getDexQuote({
          ...args,
          dexId: dexId as DEX_ENUM,
          onFinishedQuote: () => undefined,
          sharedTasks: { preFetched, recommendNonceTask },
        })
        .catch(() => null),
    ),
  );
  return quotes.filter((q): q is TDexQuoteData => !!q);
};
