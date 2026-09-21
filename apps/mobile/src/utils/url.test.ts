import {
  formatDappOriginToShow,
  isPossibleDomain,
  isValidateUrl,
  withHttp,
} from './url';

describe('url utils', () => {
  it('checks whether a string looks like a domain', () => {
    expect(isPossibleDomain('rabby.io')).toBe(true);
    expect(isPossibleDomain('app.rabby.io')).toBe(true);
    expect(isPossibleDomain('localhost')).toBe(false);
  });

  it('only strips the https prefix in formatDappOriginToShow', () => {
    expect(formatDappOriginToShow('https://app.rabby.io')).toBe('app.rabby.io');
    expect(formatDappOriginToShow('http://app.rabby.io')).toBe(
      'http://app.rabby.io',
    );
  });

  it('adds a default protocol when needed and keeps existing protocols untouched', () => {
    expect(withHttp('rabby.io')).toBe('https://rabby.io');
    expect(withHttp('rabby.io', 'http')).toBe('http://rabby.io');
    expect(withHttp('ftp://rabby.io')).toBe('ftp://rabby.io');
  });

  it('validates localhost and non-whitespace hosts with http-like protocols', () => {
    expect(isValidateUrl('https://rabby.io')).toBe(true);
    expect(isValidateUrl('http://localhost:3000')).toBe(true);
    expect(isValidateUrl('rabby.io')).toBe(false);
  });
});
