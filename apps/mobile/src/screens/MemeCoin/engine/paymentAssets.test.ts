import { buildPaymentAssetList, type WalletToken } from './paymentAssets';

const token = (over: Partial<WalletToken>): WalletToken => ({
  id: 'tk',
  chain: 'eth',
  symbol: 'TK',
  price: 1,
  usdValue: 10,
  isNative: false,
  isStable: true,
  ...over,
});

const base = {
  memeTokenKeys: new Set(['eth:0xpepe', 'bsc:0xbonk']),
  memeChains: new Set(['eth', 'bsc']),
  swapSupportedChains: new Set(['eth', 'bsc', 'base', 'arb']),
  bridgeSupportedChains: new Set(['eth', 'bsc', 'base', 'arb']),
};

describe('buildPaymentAssetList', () => {
  it('excludes held or targeted memes by chain + lowercase id', () => {
    const list = buildPaymentAssetList({
      ...base,
      tokens: [
        token({ id: '0xPEPE', symbol: 'PEPE' }),
        token({ id: '0xusdt', symbol: 'USDT' }),
      ],
    });
    expect(list.map(a => a.symbol)).toEqual(['USDT']);
  });

  it('excludes zero-price tokens but keeps tiny balances', () => {
    const list = buildPaymentAssetList({
      ...base,
      tokens: [
        token({ id: 'a', symbol: 'NOPRICE', price: 0 }),
        token({ id: 'b', symbol: 'DUST', usdValue: 0.01 }),
      ],
    });
    expect(list.map(a => a.symbol)).toEqual(['DUST']);
  });

  it('excludes tokens on chains that cannot produce any leg', () => {
    const list = buildPaymentAssetList({
      ...base,
      bridgeSupportedChains: new Set(['eth', 'bsc']),
      tokens: [
        token({ id: 'x', chain: 'zora', symbol: 'ZORA' }),
        token({ id: 'y', chain: 'base', symbol: 'USDC' }),
        token({ id: 'z', chain: 'eth', symbol: 'USDT' }),
      ],
    });
    expect(list.map(a => a.symbol)).toEqual(['USDT']);
  });

  it('keeps a token on a swap-supported meme chain even without bridge support', () => {
    const list = buildPaymentAssetList({
      ...base,
      bridgeSupportedChains: new Set(['bsc']),
      tokens: [token({ id: 'u', chain: 'eth', symbol: 'USDT' })],
    });
    expect(list).toHaveLength(1);
  });

  it('sorts by usd value desc, then chain and symbol', () => {
    const list = buildPaymentAssetList({
      ...base,
      tokens: [
        token({ id: '1', chain: 'base', symbol: 'USDC', usdValue: 5000 }),
        token({
          id: '2',
          chain: 'bsc',
          symbol: 'BNB',
          usdValue: 50,
          isNative: true,
        }),
        token({ id: '3', chain: 'eth', symbol: 'USDT', usdValue: 300 }),
        token({ id: '4', chain: 'arb', symbol: 'ARB', usdValue: 300 }),
        token({ id: '5', chain: 'base', symbol: 'AERO', usdValue: 300 }),
      ],
    });
    expect(list.map(a => `${a.chain}:${a.symbol}`)).toEqual([
      'base:USDC',
      'arb:ARB',
      'base:AERO',
      'eth:USDT',
      'bsc:BNB',
    ]);
  });

  it('keeps only native tokens and stablecoins', () => {
    const list = buildPaymentAssetList({
      ...base,
      tokens: [
        token({
          id: 'native',
          symbol: 'ETH',
          usdValue: 30,
          isNative: true,
          isStable: false,
        }),
        token({ id: 'stable', symbol: 'USDT', usdValue: 20 }),
        token({ id: 'weth', symbol: 'WETH', usdValue: 10, isStable: false }),
        token({ id: 'link', symbol: 'LINK', usdValue: 5, isStable: false }),
      ],
    });
    expect(list.map(a => a.symbol)).toEqual(['ETH', 'USDT']);
  });
});
