import { ellipsisOverflowedText } from './text';

describe('ellipsisOverflowedText', () => {
  it('returns an empty string for falsy input', () => {
    expect(ellipsisOverflowedText(undefined)).toBe('');
    expect(ellipsisOverflowedText('')).toBe('');
  });

  it('returns the original string when it fits within the limit', () => {
    expect(ellipsisOverflowedText('hello', 5)).toBe('hello');
    expect(ellipsisOverflowedText('hey', 5)).toBe('hey');
  });

  it('truncates and appends an ellipsis when the string is too long', () => {
    expect(ellipsisOverflowedText('hello world', 5)).toBe('hello...');
  });

  it('trims a trailing comma from the truncated chunk when requested', () => {
    expect(ellipsisOverflowedText('abc,def', 4, true)).toBe('abc...');
    expect(ellipsisOverflowedText('abc,def', 4, false)).toBe('abc,...');
  });
});
