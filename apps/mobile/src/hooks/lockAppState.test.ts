import {
  isAppStateInactive,
  shouldTreatIosAppStateAsBackground,
} from './lockAppState';

describe('isAppStateInactive', () => {
  it('treats inactive and background as inactive states', () => {
    expect(isAppStateInactive('inactive')).toBe(true);
    expect(isAppStateInactive('background')).toBe(true);
  });

  it('does not treat active-like states as inactive', () => {
    expect(isAppStateInactive('active')).toBe(false);
    expect(isAppStateInactive('unknown')).toBe(false);
  });
});

describe('shouldTreatIosAppStateAsBackground', () => {
  it('does not treat cold-start inactive as background before first active', () => {
    expect(shouldTreatIosAppStateAsBackground('inactive', false)).toBe(false);
  });

  it('still treats inactive as background after the app has been active once', () => {
    expect(shouldTreatIosAppStateAsBackground('inactive', true)).toBe(true);
  });

  it('always treats background as background', () => {
    expect(shouldTreatIosAppStateAsBackground('background', false)).toBe(true);
    expect(shouldTreatIosAppStateAsBackground('background', true)).toBe(true);
  });
});
