jest.mock('@/core/request', () => ({
  openapi: { source: 'mainnet' },
  testOpenapi: { source: 'testnet' },
}));

import {
  openapi as mockOpenapi,
  testOpenapi as mockTestOpenapi,
} from '@/core/request';
import {
  requestOpenApiMultipleNets,
  requestOpenApiWithChainId,
} from './openapi';

describe('openapi utils', () => {
  it('requests mainnet only by default', async () => {
    const request = jest.fn(({ openapi }) => Promise.resolve(openapi.source));

    await expect(
      requestOpenApiMultipleNets(request, {
        fallbackValues: {
          mainnet: 'fallback-mainnet',
          testnet: 'fallback-testnet',
        },
      }),
    ).resolves.toBe('mainnet');

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({
      openapi: mockOpenapi,
    });
  });

  it('provides fallback values for rejected requests and passes both results to processResults', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce('mainnet-ok')
      .mockRejectedValueOnce(new Error('boom'));
    const processResults = jest.fn(ctx => ctx);

    await expect(
      requestOpenApiMultipleNets(request, {
        needTestnetResult: true,
        fallbackValues: {
          mainnet: 'fallback-mainnet',
          testnet: 'fallback-testnet',
        },
        processResults,
      }),
    ).resolves.toEqual({
      mainnet: 'mainnet-ok',
      testnet: 'fallback-testnet',
    });

    expect(request).toHaveBeenNthCalledWith(1, {
      openapi: mockOpenapi,
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      openapi: mockTestOpenapi,
      isTestnetTask: true,
    });
    expect(processResults).toHaveBeenCalledWith({
      mainnet: 'mainnet-ok',
      testnet: 'fallback-testnet',
    });
  });

  it('switches between mainnet and testnet openapi by isTestnet', async () => {
    const request = jest.fn(({ openapi }) => Promise.resolve(openapi.source));

    await expect(
      requestOpenApiWithChainId(request, {
        isTestnet: false,
      }),
    ).resolves.toBe('mainnet');
    await expect(
      requestOpenApiWithChainId(request, {
        isTestnet: true,
      }),
    ).resolves.toBe('testnet');

    expect(request).toHaveBeenNthCalledWith(1, {
      openapi: mockOpenapi,
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      openapi: mockTestOpenapi,
    });
  });
});
