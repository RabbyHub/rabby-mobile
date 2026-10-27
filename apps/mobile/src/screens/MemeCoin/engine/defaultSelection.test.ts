import { pickDefaultPaymentAssets } from './defaultSelection';
import type { ChainGasInfo, MemeTarget, PaymentAsset } from './types';

const meme = (symbol: string, chain: string, marketCap = 1): MemeTarget => ({
  id: `0x${symbol.toLowerCase()}`,
  chain,
  symbol,
  marketCap,
});

const asset = (
  symbol: string,
  chain: string,
  usdValue: number,
  isMainstream: boolean,
): PaymentAsset => ({
  id: `${chain}-${symbol.toLowerCase()}`,
  chain,
  symbol,
  usdValue,
  price: 1,
  isNative: false,
  isMainstream,
});

const okGas: ChainGasInfo = {
  perLegGasUsd: 0,
  nativeBalanceUsd: 100,
  bridgeSupported: true,
};

const pick = (
  assets: PaymentAsset[],
  memes: MemeTarget[],
  amountUsd: number,
  chainGas?: Record<string, ChainGasInfo>,
) =>
  pickDefaultPaymentAssets({
    assets,
    memes,
    amountUsd,
    chainGas: chainGas ?? Object.fromEntries(assets.map(a => [a.chain, okGas])),
    gasAccountBalanceUsd: 0,
  }).map(a => a.symbol);

describe('pickDefaultPaymentAssets', () => {
  it('prefers a same-chain long-tail token over a cross-chain mainstream token', () => {
    expect(
      pick(
        [asset('USDC', 'base', 1000, true), asset('ARB', 'arb', 100, false)],
        [meme('MOG', 'arb')],
        50,
      ),
    ).toEqual(['ARB']);
  });

  it('prefers fewer cross-chain legs within the same-chain group', () => {
    expect(
      pick(
        [asset('BNB', 'bsc', 500, true), asset('USDT', 'eth', 500, true)],
        [meme('PEPE', 'eth'), meme('SHIB', 'eth'), meme('BONK', 'bsc')],
        90,
      ),
    ).toEqual(['USDT']);
  });

  it('prefers mainstream when cross-chain counts tie', () => {
    expect(
      pick(
        [asset('AERO', 'base', 500, false), asset('USDC', 'base', 500, true)],
        [meme('BONK', 'bsc')],
        40,
      ),
    ).toEqual(['USDC']);
  });

  it('prefers fewer mainnet cross-chain legs, then higher value', () => {
    expect(
      pick(
        [asset('USDT', 'eth', 900, true), asset('USDC', 'base', 300, true)],
        [meme('BONK', 'bsc')],
        40,
      ),
    ).toEqual(['USDC']);
    expect(
      pick(
        [asset('USDC', 'base', 300, true), asset('USDT', 'arb', 500, true)],
        [meme('BONK', 'bsc')],
        40,
      ),
    ).toEqual(['USDT']);
  });

  it('adds assets from the largest value down until the batch can pay', () => {
    expect(
      pick(
        [
          asset('ARB', 'arb', 45, false),
          asset('USDC', 'base', 60, true),
          asset('USDT', 'eth', 50, true),
        ],
        [meme('PEPE', 'eth')],
        100,
      ),
    ).toEqual(['USDC', 'USDT']);
  });

  it('picks nothing when even every asset together falls short', () => {
    expect(
      pick(
        [asset('USDC', 'base', 50, true), asset('USDT', 'eth', 30, true)],
        [meme('PEPE', 'eth')],
        100,
      ),
    ).toEqual([]);
  });

  it('skips candidates whose legs have no gas source', () => {
    expect(
      pick([asset('USDC', 'base', 500, true)], [meme('BONK', 'bsc')], 40, {
        base: { perLegGasUsd: 1, nativeBalanceUsd: 0, bridgeSupported: true },
      }),
    ).toEqual([]);
  });
});
