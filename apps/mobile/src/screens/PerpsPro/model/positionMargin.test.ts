import {
  buildPositionMarginRange,
  buildPositionMarginRiskProjection,
  calculatePositionMarginDelta,
  formatPositionMarginTarget,
  projectPositionLiquidationPrice,
  resolvePositionMarginAvailable,
  validatePositionMarginTarget,
} from './positionMargin';

const tiers = [
  {
    lowerBound: '0',
    maintenanceDeduction: '0',
    maintenanceMarginRate: '0.05',
    maxLeverage: 10,
  },
  {
    lowerBound: '1000',
    maintenanceDeduction: '50',
    maintenanceMarginRate: '0.1',
    maxLeverage: 5,
  },
];

describe('positionMargin', () => {
  it('resolves DEX withdrawable for standard accounts and clamps negatives', () => {
    const base = {
      accountFactsReady: true,
      dexWithdrawable: '12.34',
      isSpotStateReady: false,
      quoteAsset: 'USDT' as const,
      tokenToAvailableAfterMaintenance: null,
      userAbstraction: 'default',
      userAbstractionReady: true,
    };
    expect(resolvePositionMarginAvailable(base)).toBe('12.34');
    expect(
      resolvePositionMarginAvailable({ ...base, dexWithdrawable: '-1' }),
    ).toBe('0');
  });

  it('resolves the exact quote token for unified and portfolio accounts', () => {
    const base = {
      accountFactsReady: true,
      dexWithdrawable: '99',
      isSpotStateReady: true,
      quoteAsset: 'USDT' as const,
      tokenToAvailableAfterMaintenance: [
        [0, '1'],
        [268, '7.5'],
      ] as const,
      userAbstractionReady: true,
    };
    expect(
      resolvePositionMarginAvailable({
        ...base,
        userAbstraction: 'unifiedAccount',
      }),
    ).toBe('7.5');
    expect(
      resolvePositionMarginAvailable({
        ...base,
        userAbstraction: 'portfolioMargin',
      }),
    ).toBe('7.5');
    expect(
      resolvePositionMarginAvailable({
        ...base,
        isSpotStateReady: false,
        userAbstraction: 'unifiedAccount',
      }),
    ).toBeNull();
  });

  it('builds a removable normal range with conservative two-decimal bounds', () => {
    expect(
      buildPositionMarginRange({
        available: '5.009',
        currentMargin: '20.005',
        leverage: '20',
        marginModeConstraint: 'normal',
        markPrice: '100',
        positionSize: '1',
      }),
    ).toEqual({
      addOnly: false,
      current: '20.005',
      hasRepresentableRange: true,
      max: '25.01',
      min: '10.1',
      rawMax: '25.014',
      rawMin: '10.1',
    });
  });

  it('uses the absolute signed size for short-position ranges', () => {
    expect(
      buildPositionMarginRange({
        available: '5',
        currentMargin: '20',
        leverage: '10',
        marginModeConstraint: 'normal',
        markPrice: '100',
        positionSize: '-1',
      }),
    ).toMatchObject({ max: '25', min: '10.1' });
  });

  it.each([null, undefined, 'noCross', 'strictIsolated'] as const)(
    'fails closed to add-only for %s metadata',
    marginModeConstraint => {
      expect(
        buildPositionMarginRange({
          available: '5',
          currentMargin: '20.005',
          leverage: '20',
          marginModeConstraint,
          markPrice: '100',
          positionSize: '1',
        })?.min,
      ).toBe('20.01');
    },
  );

  it('reports target boundaries and no-op separately', () => {
    const range = buildPositionMarginRange({
      available: '5',
      currentMargin: '20',
      leverage: '20',
      marginModeConstraint: 'normal',
      markPrice: '100',
      positionSize: '1',
    });
    expect(validatePositionMarginTarget({ range, target: '' })).toBe('empty');
    expect(validatePositionMarginTarget({ range, target: '10' })).toBe(
      'belowMin',
    );
    expect(validatePositionMarginTarget({ range, target: '26' })).toBe(
      'aboveMax',
    );
    expect(validatePositionMarginTarget({ range, target: '20' })).toBe(
      'noChange',
    );
    expect(validatePositionMarginTarget({ range, target: '15' })).toBe('valid');
  });

  it('keeps targets on two decimals and signed deltas on six decimals', () => {
    expect(formatPositionMarginTarget('1.239')).toBe('1.24');
    expect(
      calculatePositionMarginDelta({
        currentMargin: '1.2345674',
        targetMargin: '2',
      }),
    ).toBe('0.765433');
    expect(
      calculatePositionMarginDelta({
        currentMargin: '2',
        targetMargin: '1.5',
      }),
    ).toBe('-0.5');
  });

  it('finds a self-consistent maintenance tier for long and short', () => {
    const long = projectPositionLiquidationPrice({
      direction: 'long',
      margin: '20',
      markPrice: '100',
      positionSize: '1',
      tiers,
    });
    const short = projectPositionLiquidationPrice({
      direction: 'short',
      margin: '20',
      markPrice: '100',
      positionSize: '1',
      tiers,
    });
    expect(Number(long)).toBeLessThan(100);
    expect(Number(short)).toBeGreaterThan(100);
    expect(
      buildPositionMarginRiskProjection({
        direction: 'long',
        margin: '20',
        markPrice: '100',
        positionSize: '1',
        tiers,
      }),
    ).toMatchObject({ liquidationPrice: long });
  });

  it('fails closed for malformed or non-self-consistent tier facts', () => {
    expect(
      projectPositionLiquidationPrice({
        direction: 'long',
        margin: '20',
        markPrice: '100',
        positionSize: '1',
        tiers: [{ ...tiers[0], lowerBound: '1000' }],
      }),
    ).toBeNull();
  });
});
