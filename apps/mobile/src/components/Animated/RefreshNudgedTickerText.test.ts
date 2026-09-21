import {
  nudgeLastVisibleDigitText,
  shouldNudgeRefreshText,
} from './RefreshNudgedTickerText.utils';

describe('RefreshNudgedTickerText', () => {
  it('nudges the last visible digit while preserving suffix text', () => {
    expect(nudgeLastVisibleDigitText('$1.26B', 16)).toBe('$1.25B');
    expect(nudgeLastVisibleDigitText('$1,260,000', 16)).toBe('$1,260,001');
  });

  it('nudges within maxLength instead of hidden trailing text', () => {
    expect(nudgeLastVisibleDigitText('1234567890', 5)).toBe('1234467890');
  });

  it('nudges up when the last visible digit is 0 through 3', () => {
    expect(nudgeLastVisibleDigitText('$10.01', 16)).toBe('$10.02');
    expect(nudgeLastVisibleDigitText('$10.03', 16)).toBe('$10.04');
  });

  it('nudges down when the last visible digit is 4 through 9', () => {
    expect(nudgeLastVisibleDigitText('$10.04', 16)).toBe('$10.03');
    expect(nudgeLastVisibleDigitText('$10.09', 16)).toBe('$10.08');
  });

  it('keeps text without visible digits unchanged', () => {
    expect(nudgeLastVisibleDigitText('******', 16)).toBe('******');
  });

  it('only nudges when refresh text is unchanged', () => {
    expect(shouldNudgeRefreshText('$1,260,000', '$1,260,000', 16)).toBe(true);
    expect(shouldNudgeRefreshText('$1,260,000', '$1,260,001', 16)).toBe(false);
    expect(shouldNudgeRefreshText('', '', 16)).toBe(false);
  });

  it('skips zero-only visible values regardless of currency symbol', () => {
    expect(shouldNudgeRefreshText('$0', '$0', 16)).toBe(false);
    expect(shouldNudgeRefreshText('¥0.00', '¥0.00', 16)).toBe(false);
    expect(shouldNudgeRefreshText('AED 0', 'AED 0', 16)).toBe(false);
    expect(shouldNudgeRefreshText('0', '0', 16)).toBe(false);
    expect(shouldNudgeRefreshText('€0.01', '€0.01', 16)).toBe(false);
  });

  it('skips values less than or equal to 10', () => {
    expect(shouldNudgeRefreshText('$9.99', '$9.99', 16)).toBe(false);
    expect(shouldNudgeRefreshText('$10', '$10', 16)).toBe(false);
    expect(shouldNudgeRefreshText('¥10.00', '¥10.00', 16)).toBe(false);
    expect(shouldNudgeRefreshText('AED 10.01', 'AED 10.01', 16)).toBe(true);
  });

  it('checks only the visible numeric portion and ignores suffix units', () => {
    expect(shouldNudgeRefreshText('$1.26B', '$1.26B', 16)).toBe(false);
    expect(shouldNudgeRefreshText('0.01 BTC', '0.01 BTC', 16)).toBe(false);
    expect(shouldNudgeRefreshText('$12.01B', '$12.01B', 16)).toBe(true);
  });

  it('checks the minimum value only inside the visible range', () => {
    expect(shouldNudgeRefreshText('000001', '000001', 5)).toBe(false);
    expect(shouldNudgeRefreshText('000011', '000011', 6)).toBe(true);
  });
});
