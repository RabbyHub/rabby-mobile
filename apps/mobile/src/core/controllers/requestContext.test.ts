jest.mock('@/utils/chain', () => ({
  findChain: jest.fn(({ id }) => (id ? { id } : null)),
}));

import {
  buildProviderRequestContext,
  normalizeProviderRequestChainId,
} from './requestContext';
import type { ProviderRequest } from './type';

const makeRequest = (overrides: Partial<ProviderRequest> = {}) =>
  ({
    data: {
      method: 'eth_chainId',
      params: [],
      ...overrides.data,
    },
    session: {
      origin: 'https://example.com',
      name: 'Example',
      icon: '',
      ...overrides.session,
    },
    account: overrides.account,
    requestContext: overrides.requestContext,
  } as ProviderRequest);

describe('provider request context', () => {
  it('normalizes supported chain id formats', () => {
    expect(normalizeProviderRequestChainId(1)).toBe(1);
    expect(normalizeProviderRequestChainId('1')).toBe(1);
    expect(normalizeProviderRequestChainId('0x1')).toBe(1);
    expect(normalizeProviderRequestChainId('eip155:1')).toBe(1);
    expect(normalizeProviderRequestChainId('bad')).toBeUndefined();
  });

  it('uses explicit request context chain and source', () => {
    const ctx = buildProviderRequestContext(
      makeRequest({
        requestContext: {
          origin: 'https://dapp.example',
          source: 'walletconnect',
          chainId: 137,
          accountAddress: '0xabc',
        },
      }),
    );

    expect(ctx).toEqual({
      origin: 'https://dapp.example',
      source: 'walletconnect',
      chainId: 137,
      accountAddress: '0xabc',
    });
  });

  it('falls back to session origin and dapp source for normal requests', () => {
    const ctx = buildProviderRequestContext(makeRequest());

    expect(ctx).toMatchObject({
      origin: 'https://example.com',
      source: 'dapp',
    });
    expect(ctx.chainId).toBeUndefined();
  });

  it('derives walletconnect source from mobile context without exposing wc details to approval', () => {
    const ctx = buildProviderRequestContext(
      makeRequest({
        data: {
          method: 'personal_sign',
          params: [],
          $ctx: {
            chainId: 56,
          },
        },
        session: {
          origin: 'https://example.com',
          name: 'Example',
          icon: '',
          $mobileCtx: {
            isFromWalletConnect: true,
          },
        },
      }),
    );

    expect(ctx).toMatchObject({
      origin: 'https://example.com',
      source: 'walletconnect',
      chainId: 56,
    });
  });
});
