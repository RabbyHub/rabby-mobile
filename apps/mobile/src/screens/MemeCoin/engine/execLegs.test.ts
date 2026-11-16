import { toBuyExecLegs, toSellExecLegs } from './execLegs';
import type { PlannedLeg } from './types';

describe('execLegs', () => {
  it('keeps planned buy legs and spends planned amounts', () => {
    const planned: PlannedLeg = {
      key: 'k',
      kind: 'bridge',
      pay: { id: 'usdc', chain: 'base', symbol: 'USDC' },
      receive: { id: '0xbonk', chain: 'bsc', symbol: 'BONK' },
      amountUsd: 22,
      gasPayer: 'native',
    };
    expect(toBuyExecLegs([planned])).toEqual([
      {
        key: 'k',
        kind: 'bridge',
        pay: planned.pay,
        receive: planned.receive,
        amountUsd: 22,
        payAll: false,
      },
    ]);
  });

  it('sells each holding fully into its chain native token, larger first', () => {
    const legs = toSellExecLegs([
      {
        meme: { id: '0xa', chain: 'eth', symbol: 'A' },
        valueUsd: 10,
        nativeToken: { id: 'eth', chain: 'eth', symbol: 'ETH' },
      },
      {
        meme: { id: '0xb', chain: 'bsc', symbol: 'B' },
        valueUsd: 30,
        nativeToken: { id: 'bsc', chain: 'bsc', symbol: 'BNB' },
      },
    ]);
    expect(
      legs.map(l => [l.pay.symbol, l.receive.symbol, l.kind, l.payAll]),
    ).toEqual([
      ['B', 'BNB', 'swap', true],
      ['A', 'ETH', 'swap', true],
    ]);
  });
});
