import { resolvePerpsSpotSwapPreset } from './perpsSpotSwapPreset';

describe('resolvePerpsSpotSwapPreset', () => {
  it('keeps the existing fixed-target preset', () => {
    expect(resolvePerpsSpotSwapPreset({ targetAsset: 'USDE' })).toEqual({
      fromCoin: 'USDC',
      toCoin: 'USDE',
    });
  });

  it('opens the Pro USDC entry with a valid editable default pair', () => {
    expect(resolvePerpsSpotSwapPreset({ sourceAsset: 'USDC' })).toEqual({
      fromCoin: 'USDC',
      toCoin: 'USDT',
    });
  });

  it('leaves the existing balance-driven Simple preset untouched', () => {
    expect(resolvePerpsSpotSwapPreset({})).toBeNull();
  });
});
