const mockOpenapiGetComplexProtocolList = jest.fn();
const mockTestOpenapiGetComplexProtocolList = jest.fn();
const mockOpenapiGetProtocol = jest.fn();
const mockTestOpenapiGetProtocol = jest.fn();
const mockPQueueAdd = jest.fn((fn: () => unknown) => fn());

jest.mock('@/core/request', () => ({
  openapi: {
    getComplexProtocolList: (...args: unknown[]) =>
      mockOpenapiGetComplexProtocolList(...args),
    getProtocol: (...args: unknown[]) => mockOpenapiGetProtocol(...args),
  },
  testOpenapi: {
    getComplexProtocolList: (...args: unknown[]) =>
      mockTestOpenapiGetComplexProtocolList(...args),
    getProtocol: (...args: unknown[]) => mockTestOpenapiGetProtocol(...args),
  },
}));

jest.mock('@/core/utils/concurrency', () => ({
  makeSWRKeyAsyncFunc: (fn: (...args: unknown[]) => unknown) => fn,
}));

jest.mock('@/utils/requestQueue', () => ({
  pQueue: {
    size: 2,
    pending: 3,
    add: (...args: unknown[]) => mockPQueueAdd(...args),
  },
}));

import {
  batchLoadProjects,
  loadPortfolioSnapshot,
  loadTestnetPortfolioSnapshot,
} from './portfolio';

describe('core/apis/portfolio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockOpenapiGetComplexProtocolList.mockResolvedValue(['mainnet-snapshot']);
    mockTestOpenapiGetComplexProtocolList.mockResolvedValue([
      'testnet-snapshot',
    ]);
    mockOpenapiGetProtocol.mockImplementation(({ id }) =>
      Promise.resolve({ id, network: 'mainnet' }),
    );
    mockTestOpenapiGetProtocol.mockImplementation(({ id }) =>
      Promise.resolve({ id, network: 'testnet' }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads mainnet and testnet portfolio snapshots through the shared queue', async () => {
    await expect(loadPortfolioSnapshot('0xabc')).resolves.toEqual([
      'mainnet-snapshot',
    ]);
    await expect(loadTestnetPortfolioSnapshot('0xabc')).resolves.toEqual([
      'testnet-snapshot',
    ]);

    expect(mockPQueueAdd).toHaveBeenCalledTimes(2);
    expect(mockOpenapiGetComplexProtocolList).toHaveBeenCalledWith('0xabc');
    expect(mockTestOpenapiGetComplexProtocolList).toHaveBeenCalledWith('0xabc');
  });

  it('reports queue and request phases without exposing the address', async () => {
    const observer = jest.fn();

    await loadPortfolioSnapshot('0xprivate', observer);

    expect(observer.mock.calls.map(([phase]) => phase)).toEqual([
      'queue-entered',
      'request-started',
      'request-fulfilled',
    ]);
    expect(observer).toHaveBeenNthCalledWith(1, 'queue-entered', {
      queueSize: 2,
      pendingCount: 3,
    });
    expect(observer.mock.calls.flat().join('|')).not.toContain('0xprivate');
  });

  it('reports rejected portfolio requests before rethrowing', async () => {
    const observer = jest.fn();
    mockOpenapiGetComplexProtocolList.mockRejectedValueOnce(
      new Error('network failed'),
    );

    await expect(loadPortfolioSnapshot('0xprivate', observer)).rejects.toThrow(
      'network failed',
    );

    expect(observer.mock.calls.map(([phase]) => phase)).toEqual([
      'queue-entered',
      'request-started',
      'request-rejected',
    ]);
  });

  it('loads mainnet project details in queue order', async () => {
    await expect(
      batchLoadProjects('0xabc', ['aave', 'curve']),
    ).resolves.toEqual([
      {
        id: 'aave',
        network: 'mainnet',
      },
      {
        id: 'curve',
        network: 'mainnet',
      },
    ]);

    expect(mockOpenapiGetProtocol).toHaveBeenCalledWith({
      addr: '0xabc',
      id: 'aave',
    });
    expect(mockOpenapiGetProtocol).toHaveBeenCalledWith({
      addr: '0xabc',
      id: 'curve',
    });
    expect(mockTestOpenapiGetProtocol).not.toHaveBeenCalled();
  });

  it('loads testnet project details when requested', async () => {
    await expect(
      batchLoadProjects('0xabc', ['test-protocol'], true),
    ).resolves.toEqual([
      {
        id: 'test-protocol',
        network: 'testnet',
      },
    ]);

    expect(mockTestOpenapiGetProtocol).toHaveBeenCalledWith({
      addr: '0xabc',
      id: 'test-protocol',
    });
  });

  it('returns null for failed single project loads only when ignoreSingleError is enabled', async () => {
    mockOpenapiGetProtocol.mockImplementation(({ id }) => {
      if (id === 'bad') {
        return Promise.reject(new Error('bad project'));
      }
      return Promise.resolve({ id, network: 'mainnet' });
    });

    await expect(
      batchLoadProjects('0xabc', ['good', 'bad'], false, true),
    ).resolves.toEqual([
      {
        id: 'good',
        network: 'mainnet',
      },
      null,
    ]);

    await expect(
      batchLoadProjects('0xabc', ['bad'], false, false),
    ).rejects.toThrow('bad project');
  });
});
