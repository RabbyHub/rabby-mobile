import { getTokenIcon, SYMBOL_MAP } from './tokenIcon';

describe('tokenIcon', () => {
  it('returns the default icon when symbol is missing', () => {
    expect(getTokenIcon('')).toContain('default.');
  });

  it('uses SYMBOL_MAP aliases before resolving icons', () => {
    expect(SYMBOL_MAP['DAI.e']).toBe('DAI');
    expect(getTokenIcon('DAI.e')).toContain('/dai/');
  });

  it('falls back to the default icon for unknown symbols', () => {
    expect(getTokenIcon('NOT_A_REAL_TOKEN')).toContain('default.');
  });
});
