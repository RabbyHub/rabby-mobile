import type { IProtocolItem } from '@/types/assets';
import {
  buildProtocolAssetsIndexResult,
  buildProtocolEntityId,
} from './protocolAssetsIndex';

const makeProtocol = (
  id: string,
  netWorth: number,
  portfolioValue = netWorth,
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

  it('changes the list identity when row order changes', () => {
    const first = buildProtocolAssetsIndexResult([
      makeProtocol('aave', 10),
      makeProtocol('curve', 5),
    ]);
    const second = buildProtocolAssetsIndexResult(
      [makeProtocol('curve', 5), makeProtocol('aave', 10)],
      first,
    );

    expect(second.protocolIds).not.toBe(first.protocolIds);
    expect(second.protocolIds).toEqual(['0xabc:eth:curve', '0xabc:eth:aave']);
  });
});
