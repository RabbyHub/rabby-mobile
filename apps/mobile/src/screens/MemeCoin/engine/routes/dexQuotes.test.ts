import { CHAINS_ENUM } from '@debank/common';
import type { GasLevel, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import type { Account } from '@/core/startupServices/preference';
import { fetchDexQuotesIsolated, type DexQuoteDeps } from './dexQuotes';

jest.mock('@debank/common', () => ({
  CHAINS_ENUM: { ETH: 'ETH', BSC: 'BSC', LINEA: 'LINEA' },
}));

const account = { address: '0xabc' } as unknown as Account;
const baseArgs = {
  payToken: {} as TokenItem,
  receiveToken: {} as TokenItem,
  userAddress: '0xabc',
  slippage: '2.5',
  fee: '0.25',
  payAmount: '1',
  inSufficient: false,
  account,
};
const ETH = {
  enum: CHAINS_ENUM.ETH,
  serverId: 'eth',
  id: 1,
  nativeTokenAddress: 'eth',
};
const BSC = {
  enum: CHAINS_ENUM.BSC,
  serverId: 'bsc',
  id: 56,
  nativeTokenAddress: 'bsc',
};

const makeDeps = (seen: Record<string, unknown>[]): DexQuoteDeps => ({
  getRecommendNonce: async ({ chainId }) => `nonce-${chainId}`,
  getGasMarket: async id =>
    [{ level: 'normal', price: id === 'eth' ? 1 : 2 }] as unknown as GasLevel[],
  getToken: async (_addr, id) =>
    ({ id: `native-${id}` } as unknown as TokenItem),
  getDexQuote: async args => {
    seen.push({
      dexId: args.dexId,
      chain: args.chain,
      nonce: await args.sharedTasks?.recommendNonceTask,
      gas: args.sharedTasks?.preFetched?.gasMarket
        ? await args.sharedTasks.preFetched.gasMarket
        : undefined,
      native: await args.sharedTasks?.preFetched?.nativeToken,
    });
    return {
      name: String(args.dexId),
      data: null,
      isDex: true,
      preExecResult: null,
    };
  },
});

describe('fetchDexQuotesIsolated', () => {
  it('gives concurrent calls on different chains their own nonce, gas market and native token', async () => {
    const seen: Record<string, unknown>[] = [];
    const deps = makeDeps(seen);
    await Promise.all([
      fetchDexQuotesIsolated({
        dexIds: ['A', 'B'],
        chain: ETH,
        args: { ...baseArgs, chain: CHAINS_ENUM.ETH },
        deps,
      }),
      fetchDexQuotesIsolated({
        dexIds: ['A'],
        chain: BSC,
        args: { ...baseArgs, chain: CHAINS_ENUM.BSC },
        deps,
      }),
    ]);
    expect(seen.filter(s => s.chain === CHAINS_ENUM.ETH)).toEqual([
      {
        dexId: 'A',
        chain: CHAINS_ENUM.ETH,
        nonce: 'nonce-1',
        gas: [{ level: 'normal', price: 1 }],
        native: { id: 'native-eth' },
      },
      {
        dexId: 'B',
        chain: CHAINS_ENUM.ETH,
        nonce: 'nonce-1',
        gas: [{ level: 'normal', price: 1 }],
        native: { id: 'native-eth' },
      },
    ]);
    expect(seen.filter(s => s.chain === CHAINS_ENUM.BSC)).toEqual([
      {
        dexId: 'A',
        chain: CHAINS_ENUM.BSC,
        nonce: 'nonce-56',
        gas: [{ level: 'normal', price: 2 }],
        native: { id: 'native-bsc' },
      },
    ]);
  });

  it('does not prefetch the gas market on Linea', async () => {
    const seen: Record<string, unknown>[] = [];
    await fetchDexQuotesIsolated({
      dexIds: ['A'],
      chain: {
        enum: CHAINS_ENUM.LINEA,
        serverId: 'linea',
        id: 59144,
        nativeTokenAddress: 'linea',
      },
      args: { ...baseArgs, chain: CHAINS_ENUM.LINEA },
      deps: makeDeps(seen),
    });
    expect(seen[0].gas).toBeUndefined();
  });

  it('drops dex quotes that reject', async () => {
    const deps = makeDeps([]);
    const failing: DexQuoteDeps = {
      ...deps,
      getDexQuote: async args => {
        if (args.dexId === 'B') {
          throw new Error('dex down');
        }
        return deps.getDexQuote(args);
      },
    };
    const quotes = await fetchDexQuotesIsolated({
      dexIds: ['A', 'B'],
      chain: ETH,
      args: { ...baseArgs, chain: CHAINS_ENUM.ETH },
      deps: failing,
    });
    expect(quotes.map(q => q.name)).toEqual(['A']);
  });
});
