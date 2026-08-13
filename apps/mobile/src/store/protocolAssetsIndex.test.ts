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
    const first = buildProtocolAssetsIndexResult({
      unFold: [makeProtocol('aave', 10)],
      fold: [makeProtocol('curve', 1)],
    });
    const second = buildProtocolAssetsIndexResult(
      {
        unFold: [makeProtocol('aave', 10)],
        fold: [makeProtocol('curve', 1)],
      },
      first,
    );

    expect(second).toBe(first);
  });

  it('keeps id arrays stable when only the folded value changes', () => {
    const first = buildProtocolAssetsIndexResult({
      unFold: [makeProtocol('aave', 10)],
      fold: [makeProtocol('curve', 1)],
    });
    const second = buildProtocolAssetsIndexResult(
      {
        unFold: [makeProtocol('aave', 10)],
        fold: [makeProtocol('curve', 2)],
      },
      first,
    );

    expect(second).not.toBe(first);
    expect(second.unFoldIds).toBe(first.unFoldIds);
    expect(second.foldIds).toBe(first.foldIds);
    expect(second.foldDeFiValue).not.toBe(first.foldDeFiValue);
  });

  it('changes the list identity when row order changes', () => {
    const first = buildProtocolAssetsIndexResult({
      unFold: [makeProtocol('aave', 10), makeProtocol('curve', 5)],
      fold: [],
    });
    const second = buildProtocolAssetsIndexResult(
      {
        unFold: [makeProtocol('curve', 5), makeProtocol('aave', 10)],
        fold: [],
      },
      first,
    );

    expect(second.unFoldIds).not.toBe(first.unFoldIds);
    expect(second.unFoldIds).toEqual(['0xabc:eth:curve', '0xabc:eth:aave']);
  });
});
