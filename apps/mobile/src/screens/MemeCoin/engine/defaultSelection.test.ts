import { pickDefaultPaymentAsset } from './defaultSelection';
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
  pickDefaultPaymentAsset({
    assets,
    memes,
    amountUsd,
    chainGas: chainGas ?? Object.fromEntries(assets.map(a => [a.chain, okGas])),
    gasAccountBalanceUsd: 0,
  });

describe('pickDefaultPaymentAsset', () => {
  it('returns null when no single asset can pay everything', () => {
    expect(
      pick(
        [asset('USDC', 'base', 80, true), asset('USDT', 'eth', 30, true)],
        [meme('PEPE', 'eth')],
        100,
      ),
    ).toBeNull();
  });

  it('prefers a same-chain long-tail token over a cross-chain mainstream token', () => {
    const result = pick(
      [asset('USDC', 'base', 1000, true), asset('ARB', 'arb', 100, false)],
      [meme('MOG', 'arb')],
      50,
    );
    expect(result?.symbol).toBe('ARB');
  });

  it('prefers fewer cross-chain legs within the same-chain group', () => {
    const result = pick(
      [asset('BNB', 'bsc', 500, true), asset('USDT', 'eth', 500, true)],
      [meme('PEPE', 'eth'), meme('SHIB', 'eth'), meme('BONK', 'bsc')],
      90,
    );
    expect(result?.symbol).toBe('USDT');
  });

  it('prefers mainstream when cross-chain counts tie', () => {
    const result = pick(
      [asset('AERO', 'base', 500, false), asset('USDC', 'base', 500, true)],
      [meme('BONK', 'bsc')],
      40,
    );
    expect(result?.symbol).toBe('USDC');
  });

  it('prefers fewer mainnet cross-chain legs, then higher value', () => {
    expect(
      pick(
        [asset('USDT', 'eth', 900, true), asset('USDC', 'base', 300, true)],
        [meme('BONK', 'bsc')],
        40,
      )?.symbol,
    ).toBe('USDC');
    expect(
      pick(
        [asset('USDC', 'base', 300, true), asset('USDT', 'arb', 500, true)],
        [meme('BONK', 'bsc')],
        40,
      )?.symbol,
    ).toBe('USDT');
  });

  it('skips candidates whose legs have no gas source', () => {
    const result = pick(
      [asset('USDC', 'base', 500, true)],
      [meme('BONK', 'bsc')],
      40,
      { base: { perLegGasUsd: 1, nativeBalanceUsd: 0, bridgeSupported: true } },
    );
    expect(result).toBeNull();
  });
});
