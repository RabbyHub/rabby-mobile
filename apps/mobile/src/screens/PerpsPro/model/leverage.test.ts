import { resolvePerpsProInitialLeverage } from './leverage';

describe('resolvePerpsProInitialLeverage', () => {
  it('uses the existing position before the recommendation', () => {
    expect(
      resolvePerpsProInitialLeverage({
        maxLeverage: 40,
        onlyIsolated: false,
        position: { type: 'isolated', value: 7 },
        recommended: { type: 'cross', value: 20 },
      }),
    ).toEqual({ type: 'isolated', value: 7 });
  });

  it('uses the zero-address recommendation for a new position', () => {
    expect(
      resolvePerpsProInitialLeverage({
        maxLeverage: 40,
        onlyIsolated: false,
        recommended: { type: 'cross', value: 20 },
      }),
    ).toEqual({ type: 'cross', value: 20 });
  });

  it('retains max leverage as the final fallback', () => {
    expect(
      resolvePerpsProInitialLeverage({
        maxLeverage: 25,
        onlyIsolated: false,
      }),
    ).toEqual({ type: 'isolated', value: 25 });
  });

  it('forces isolated mode without changing the selected value', () => {
    expect(
      resolvePerpsProInitialLeverage({
        maxLeverage: 10,
        onlyIsolated: true,
        recommended: { type: 'cross', value: 20 },
      }),
    ).toEqual({ type: 'isolated', value: 10 });
  });
});
