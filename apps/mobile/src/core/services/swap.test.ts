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

  const mockCreatePersistStore = jest.fn((config: { template: unknown }) => {
    return persistedStore || config.template;
  });

  jest.doMock('@rabby-wallet/persist-store', () => ({
    __esModule: true,
    default: (...args: unknown[]) => mockCreatePersistStore(...args),
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
    findChainByEnum: (chain: string) => {
      if (chain === CHAINS_ENUM.ARBITRUM) {
        return { enum: CHAINS_ENUM.ARBITRUM, serverId: 'arb' };
      }
      if (chain === CHAINS_ENUM.ETH) {
        return { enum: CHAINS_ENUM.ETH, serverId: 'eth' };
      }
      return null;
    },
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
  jest.doMock('../request', () => ({
    openapi: {
      postSwap: jest.fn(),
    },
  }));
  jest.doMock('@/utils/tempo', () => ({
    getTxMatchData: jest.fn(() => '0xdata'),
  }));

  const { SwapService } = require('./swap') as typeof import('./swap');

  return {
    SwapService,
    mocks: {
      mockCreatePersistStore,
    },
  };
}

describe('core/services/swap', () => {
  afterEach(() => {
    jest.resetModules();
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
    expect(service.getSelectedToToken()).toBe(arbToken);
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

    expect(service.getSelectedFromToken()).toBe(arbToken);
    expect(service.getSelectedToToken()).toBe(arbToken);
  });
});
