import {
  PERPS_SPOT_SWAP_COINS,
  resolvePerpsSpotSwapFromOptions,
  resolvePerpsSpotSwapPairAfterSelection,
  resolvePerpsSpotSwapPreset,
} from './perpsSpotSwapPreset';

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

  it('allows every source only for the editable Pro source entry', () => {
    expect(
      resolvePerpsSpotSwapFromOptions({
        editableSource: true,
        toCoin: 'USDT',
      }),
    ).toEqual(PERPS_SPOT_SWAP_COINS);
    expect(
      resolvePerpsSpotSwapFromOptions({
        editableSource: false,
        toCoin: 'USDT',
      }),
    ).toEqual(['USDC']);
    expect(
      resolvePerpsSpotSwapFromOptions({
        editableSource: false,
        toCoin: 'USDC',
      }),
    ).toEqual(['USDT', 'USDH', 'USDE']);
  });

  it.each([
    {
      coin: 'USDE' as const,
      currentFromCoin: 'USDC' as const,
      currentToCoin: 'USDT' as const,
      expected: { fromCoin: 'USDE', toCoin: 'USDC' },
      side: 'from' as const,
    },
    {
      coin: 'USDC' as const,
      currentFromCoin: 'USDE' as const,
      currentToCoin: 'USDC' as const,
      expected: { fromCoin: 'USDC', toCoin: 'USDT' },
      side: 'from' as const,
    },
    {
      coin: 'USDE' as const,
      currentFromCoin: 'USDH' as const,
      currentToCoin: 'USDC' as const,
      expected: { fromCoin: 'USDC', toCoin: 'USDE' },
      side: 'to' as const,
    },
    {
      coin: 'USDC' as const,
      currentFromCoin: 'USDC' as const,
      currentToCoin: 'USDE' as const,
      expected: { fromCoin: 'USDT', toCoin: 'USDC' },
      side: 'to' as const,
    },
  ])(
    'keeps USDC on exactly one side after selecting $coin on $side',
    ({ expected, ...selection }) => {
      expect(resolvePerpsSpotSwapPairAfterSelection(selection)).toEqual(
        expected,
      );
    },
  );
});
