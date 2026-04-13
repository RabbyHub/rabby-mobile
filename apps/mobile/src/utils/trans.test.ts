import { GAS_LEVEL_TEXT, getGasLevelI18nKey } from './trans';

describe('trans utils', () => {
  it('keeps the current gas level text mapping', () => {
    expect(GAS_LEVEL_TEXT.slow).toBe('Standard');
    expect(GAS_LEVEL_TEXT.normal).toBe('Fast');
    expect(GAS_LEVEL_TEXT.fast).toBe('Instant');
  });

  it('falls back to the unknown key for unsupported levels', () => {
    expect(getGasLevelI18nKey('slow')).toBe(
      'page.sendToken.GasSelector.level.slow',
    );
    expect(getGasLevelI18nKey('unknown-level')).toBe(
      'page.sendToken.GasSelector.level.$unknown',
    );
  });
});
