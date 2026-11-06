import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import type { SwapServiceStore } from './swap';

const CHAINS_ENUM = {
  ETH: 'ETH',
  ARBITRUM: 'ARBITRUM',
} as const;

const makeToken = (chain: string, id: string): TokenItem =>
  ({
    id,
    chain,
    symbol: id,
    name: id,
    decimals: 18,
    time_at: 0,
  } as TokenItem);

function loadSwapServiceModule(persistedStore?: Partial<SwapServiceStore>) {
  jest.resetModules();

  class MockStoreServiceBase {
    store: SwapServiceStore;

    constructor(_name: string, template: SwapServiceStore) {
      this.store = {
        ...template,
        ...persistedStore,
      };
    }

    protected mutateStore(recipe: (draft: SwapServiceStore) => void) {
      recipe(this.store);
      return this.store;
    }

    getStoreSnapshot() {
      return JSON.parse(JSON.stringify(this.store)) as SwapServiceStore;
    }

    getStoreFieldSnapshot<K extends keyof SwapServiceStore>(key: K) {
      const value = this.store[key];
      return (
        value === undefined ? value : JSON.parse(JSON.stringify(value))
      ) as SwapServiceStore[K];
    }
  }

  jest.doMock('@rabby-wallet/persist-store', () => ({
    StoreServiceBase: MockStoreServiceBase,
  }));
  jest.doMock('@rabby-wallet/rabby-swap', () => ({
    DEX_ENUM: {
      ZEROXAPI: '0x',
    },
  }));
  jest.doMock('@/constant/swap', () => ({
    CEX: {},
    DEX: {},
    SWAP_SUPPORT_CHAINS: [CHAINS_ENUM.ETH, CHAINS_ENUM.ARBITRUM],
    getChainDefaultToken: jest.fn((chain: string) =>
      makeToken(
        chain === CHAINS_ENUM.ARBITRUM ? 'arb' : 'eth',
        `native-${chain}`,
      ),
    ),
  }));
  jest.doMock('@/core/storage/storeConstant', () => ({
    APP_STORE_NAMES: {
      swap: 'swap',
    },
  }));
  jest.doMock('@/utils/chain', () => ({
    findChainByEnum: jest.fn((chain: string) => {
      if (chain === CHAINS_ENUM.ARBITRUM) {
        return { enum: CHAINS_ENUM.ARBITRUM, serverId: 'arb' };
      }
      if (chain === CHAINS_ENUM.ETH) {
        return { enum: CHAINS_ENUM.ETH, serverId: 'eth' };
      }
      return null;
    }),
    findChainByServerID: (serverId: string) => {
      if (serverId === 'arb') {
        return { enum: CHAINS_ENUM.ARBITRUM, serverId: 'arb' };
      }
      if (serverId === 'eth') {
        return { enum: CHAINS_ENUM.ETH, serverId: 'eth' };
      }
      return null;
    },
  }));
  const mockPostSwap = jest.fn();
  jest.doMock('../request', () => ({
    openapi: {
      postSwap: (...args: unknown[]) => mockPostSwap(...args),
    },
  }));
  jest.doMock('@/utils/tempoTx', () => ({
    getTxMatchData: jest.fn(() => '0xdata'),
  }));

  const { SwapService } = require('./swap') as typeof import('./swap');
  const Sentry =
    require('@sentry/react-native') as typeof import('@sentry/react-native');

  return {
    SwapService,
    Sentry,
    mockPostSwap,
    findChainByEnum: jest.mocked(
      (require('@/utils/chain') as typeof import('@/utils/chain'))
        .findChainByEnum,
    ),
  };
}

describe('core/services/swap', () => {
  afterEach(() => {
    jest.resetModules();
  });

  it('clears persisted selection when an SDK-supported chain is missing', () => {
    const arbToken = makeToken('arb', 'arb-token');
    const { SwapService, findChainByEnum } = loadSwapServiceModule({
      selectedChain: CHAINS_ENUM.ARBITRUM as never,
      selectedFromToken: arbToken,
      selectedToToken: arbToken,
    });
    findChainByEnum.mockReturnValue(null);

    const service = new SwapService();

    expect(service.getSwap('selectedChain')).toBeNull();
    expect(service.getSwap('selectedFromToken')).toBeUndefined();
    expect(service.getSwap('selectedToToken')).toBeUndefined();
  });

  it('clears selection on read when the chain disappears after initialization', () => {
    const arbToken = makeToken('arb', 'arb-token');
    const { SwapService, findChainByEnum } = loadSwapServiceModule({
      selectedChain: CHAINS_ENUM.ARBITRUM as never,
      selectedFromToken: arbToken,
      selectedToToken: arbToken,
    });
    const service = new SwapService();
    expect(service.getSelectedChain()).toBe(CHAINS_ENUM.ARBITRUM);

    findChainByEnum.mockReturnValue(null);

    expect(service.getSelectedChain()).toBeNull();
    expect(service.getSelectedFromToken()).toBeUndefined();
    expect(service.getSelectedToToken()).toBeUndefined();
  });

  it('drops persisted selected tokens that do not belong to selectedChain', () => {
    const ethToken = makeToken('eth', 'eth-token');
    const arbToken = makeToken('arb', 'arb-token');
    const { SwapService } = loadSwapServiceModule({
      selectedChain: CHAINS_ENUM.ARBITRUM as never,
      selectedFromToken: ethToken,
      selectedToToken: arbToken,
      recentToTokens: [],
      openSwapHistoryTs: {},
    });

    const service = new SwapService();

    expect(service.getSelectedChain()).toBe(CHAINS_ENUM.ARBITRUM);
    expect(service.getSelectedFromToken()).toBeUndefined();
    expect(service.getSelectedToToken()).toEqual(arbToken);
  });

  it('clears cached selected tokens when selectedChain changes away from them', () => {
    const ethToken = makeToken('eth', 'eth-token');
    const { SwapService } = loadSwapServiceModule();
    const service = new SwapService();

    service.setSelectedChain(CHAINS_ENUM.ETH as never);
    service.setSelectedFromToken(ethToken);
    service.setSelectedToToken(ethToken);
    service.setSelectedChain(CHAINS_ENUM.ARBITRUM as never);

    expect(service.getSelectedFromToken()).toBeUndefined();
    expect(service.getSelectedToToken()).toBeUndefined();
  });

  it('refuses to persist selected tokens from a different chain', () => {
    const ethToken = makeToken('eth', 'eth-token');
    const arbToken = makeToken('arb', 'arb-token');
    const { SwapService } = loadSwapServiceModule();
    const service = new SwapService();

    service.setSelectedChain(CHAINS_ENUM.ARBITRUM as never);
    service.setSelectedFromToken(ethToken);
    service.setSelectedToToken(ethToken);

    expect(service.getSelectedFromToken()).toBeUndefined();
    expect(service.getSelectedToToken()).toBeUndefined();

    service.setSelectedFromToken(arbToken);
    service.setSelectedToToken(arbToken);

    expect(service.getSelectedFromToken()).toEqual(arbToken);
    expect(service.getSelectedToToken()).toEqual(arbToken);
  });

  describe('postSwap', () => {
    const quoteInfo = {
      quote: {
        pay_token_id: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        pay_token_amount: 100,
        receive_token_id: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        receive_token_amount: 0.03,
        slippage: 0.005,
      },
      dex_id: 'uniswap3',
      fee_rate: 0.0025,
    };
    const tx = { from: '0x9bba7ebC9c69db92950def377d732b91bb22d02f' };

    it('reports a failure under a fixed title with the cause and quote in extra', async () => {
      const { SwapService, Sentry, mockPostSwap } = loadSwapServiceModule();
      const failure = new TypeError('bad quote');
      mockPostSwap.mockRejectedValue(failure);
      const service = new SwapService();

      service.addTx(CHAINS_ENUM.ETH as never, '0xdata', quoteInfo);
      await expect(
        service.postSwap(CHAINS_ENUM.ETH as never, '0xhash', tx as never),
      ).resolves.toBeUndefined();

      expect(mockPostSwap).toHaveBeenCalledWith({
        ...quoteInfo,
        tx,
        tx_id: '0xhash',
      });
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
      const [error, context] = (Sentry.captureException as jest.Mock).mock
        .calls[0];
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('postSwap failed');
      expect(error.cause).toBe(failure);
      // The signed tx carries the user address; only the quote is attached.
      expect(context).toEqual({ extra: quoteInfo });
    });

    it('does not report when the quote was posted', async () => {
      const { SwapService, Sentry, mockPostSwap } = loadSwapServiceModule();
      mockPostSwap.mockResolvedValue({});
      const service = new SwapService();

      service.addTx(CHAINS_ENUM.ETH as never, '0xdata', quoteInfo);
      await service.postSwap(CHAINS_ENUM.ETH as never, '0xhash', tx as never);

      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });
});
