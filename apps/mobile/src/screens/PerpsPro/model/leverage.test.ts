import {
  resolvePerpsProInitialLeverage,
  resolvePerpsProMarginModeDisabledReason,
} from './leverage';

describe('resolvePerpsProInitialLeverage', () => {
  it('uses the existing position before the zero-address baseline', () => {
    expect(
      resolvePerpsProInitialLeverage({
        marginModeConstraint: 'normal',
        maxLeverage: 40,
        position: { type: 'isolated', value: 7 },
        zeroAddressBaseline: { type: 'cross', value: 20 },
      }),
    ).toEqual({ type: 'isolated', value: 7 });
  });

  it('uses the zero-address baseline for a new position', () => {
    expect(
      resolvePerpsProInitialLeverage({
        marginModeConstraint: 'normal',
        maxLeverage: 40,
        zeroAddressBaseline: { type: 'cross', value: 20 },
      }),
    ).toEqual({ type: 'cross', value: 20 });
  });

  it('retains max leverage as the final fallback', () => {
    expect(
      resolvePerpsProInitialLeverage({
        marginModeConstraint: 'normal',
        maxLeverage: 25,
      }),
    ).toEqual({ type: 'isolated', value: 25 });
  });

  it.each(['noCross', 'strictIsolated'] as const)(
    'forces isolated mode for %s without changing the selected value',
    marginModeConstraint => {
      expect(
        resolvePerpsProInitialLeverage({
          marginModeConstraint,
          maxLeverage: 10,
          zeroAddressBaseline: { type: 'cross', value: 20 },
        }),
      ).toEqual({ type: 'isolated', value: 10 });
    },
  );
});

describe('resolvePerpsProMarginModeDisabledReason', () => {
  it.each(['noCross', 'strictIsolated'] as const)(
    'reports only-isolated for the %s metadata constraint',
    marginModeConstraint => {
      expect(
        resolvePerpsProMarginModeDisabledReason({
          hasOpenOrders: false,
          hasPosition: false,
          marginModeConstraint,
        }),
      ).toBe('onlyIsolated');
    },
  );

  it('reports existing exposure only for a normal market', () => {
    expect(
      resolvePerpsProMarginModeDisabledReason({
        hasOpenOrders: false,
        hasPosition: true,
        marginModeConstraint: 'normal',
      }),
    ).toBe('existingExposure');
    expect(
      resolvePerpsProMarginModeDisabledReason({
        hasOpenOrders: true,
        hasPosition: false,
        marginModeConstraint: 'normal',
      }),
    ).toBe('existingExposure');
    expect(
      resolvePerpsProMarginModeDisabledReason({
        hasOpenOrders: false,
        hasPosition: false,
        marginModeConstraint: 'normal',
      }),
    ).toBeNull();
  });
});
