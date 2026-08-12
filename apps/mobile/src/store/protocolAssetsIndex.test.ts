import type { IProtocolItem } from '@/types/assets';
import {
  buildProtocolAssetsIndexResult,
  buildProtocolEntityId,
} from './protocolAssetsIndex';

const makeProtocol = (
  id: string,
  netWorth: number,
  portfolioValue = netWorth,
  overrides: Partial<IProtocolItem> = {},
): IProtocolItem => ({
  id,
  name: id,
  chain: 'eth',
  owner_addr: '0xABC',
  netWorth,
  _portfolios: [
    {
      id: `${id}-portfolio`,
      netWorth: portfolioValue,
      _sumTokenRealUsdValue: portfolioValue,
      _originPortfolio: {} as never,
    },
  ],
  ...overrides,
});

describe('protocol asset index', () => {
  it('builds a stable identity from owner, chain and protocol id', () => {
    expect(buildProtocolEntityId(makeProtocol('Aave', 10))).toBe(
      '0xabc:eth:aave',
    );
  });

  it('reuses the complete result when only source object identities change', () => {
    const first = buildProtocolAssetsIndexResult([
      makeProtocol('aave', 10),
      makeProtocol('curve', 1),
    ]);
    const second = buildProtocolAssetsIndexResult(
      [makeProtocol('aave', 10), makeProtocol('curve', 1)],
      first,
    );

    expect(second).toBe(first);
  });

  it('keeps the id array stable when entity values change without reordering', () => {
    const first = buildProtocolAssetsIndexResult([
      makeProtocol('aave', 10),
      makeProtocol('curve', 1),
    ]);
    const second = buildProtocolAssetsIndexResult(
      [makeProtocol('aave', 11), makeProtocol('curve', 2)],
      first,
    );

    expect(second).toBe(first);
    expect(second.protocolIds).toBe(first.protocolIds);
  });

  it('orders protocols by net worth regardless of source order', () => {
    const first = buildProtocolAssetsIndexResult([
      makeProtocol('aave', 10),
      makeProtocol('curve', 5),
    ]);
    const second = buildProtocolAssetsIndexResult(
      [makeProtocol('curve', 15), makeProtocol('aave', 10)],
      first,
    );

    expect(second.protocolIds).not.toBe(first.protocolIds);
    expect(second.protocolIds).toEqual(['0xabc:eth:curve', '0xabc:eth:aave']);
  });

  it('preserves source order for equal net worth values', () => {
    const result = buildProtocolAssetsIndexResult([
      makeProtocol('second', 10),
      makeProtocol('first', 10),
    ]);

    expect(result.protocolIds).toEqual(['0xabc:eth:second', '0xabc:eth:first']);
  });

  it('keeps equal protocols isolated across owners', () => {
    const result = buildProtocolAssetsIndexResult([
      makeProtocol('aave', 10, 10, { owner_addr: '0xAAA' }),
      makeProtocol('aave', 20, 20, { owner_addr: '0xBBB' }),
    ]);

    expect(result.protocolIds).toEqual(['0xbbb:eth:aave', '0xaaa:eth:aave']);
  });

  it('keeps regular and AppChain protocols in the same ordered projection', () => {
    const result = buildProtocolAssetsIndexResult([
      makeProtocol('aave', 30),
      makeProtocol('app', 50, 50, {
        chain: 'RABBY_APP_CHAIN_app',
      }),
    ]);

    expect(result.protocolIds).toEqual([
      '0xabc:rabby_app_chain_app:app',
      '0xabc:eth:aave',
    ]);
  });
});
