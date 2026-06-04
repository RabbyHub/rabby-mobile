import { sortTokenWithSymbol } from '../utils';

const makeToken = (symbol: string, id = symbol) => ({
  id,
  symbol,
  amount: 1,
  price: 1,
  usd_value: 1,
});

describe('TokenDetail Market utils', () => {
  it('sorts exact symbol matches before wrapped and partial matches', () => {
    const tokens = [
      makeToken('DAI'),
      makeToken('WETH'),
      makeToken('stETH'),
      makeToken('ETH'),
      makeToken('RETH'),
    ];

    expect(
      sortTokenWithSymbol(tokens, 'ETH').map(token => token.symbol),
    ).toEqual(['ETH', 'WETH', 'stETH', 'RETH', 'DAI']);
  });

  it('matches symbols case-insensitively and keeps stable order within the same rank', () => {
    const tokens = [
      makeToken('eth', 'a'),
      makeToken('ETH', 'b'),
      makeToken('weth', 'c'),
      makeToken('WETH', 'd'),
      makeToken('DAI', 'e'),
    ];

    expect(sortTokenWithSymbol(tokens, 'eTh').map(token => token.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('preserves original order when the target symbol is empty', () => {
    const tokens = [makeToken('DAI'), makeToken('USDC'), makeToken('ETH')];

    expect(sortTokenWithSymbol(tokens, '').map(token => token.symbol)).toEqual([
      'DAI',
      'USDC',
      'ETH',
    ]);
  });
});
