import { filterRbiSource } from './ga-event';

describe('filterRbiSource', () => {
  it('accepts the currently whitelisted sources for each case', () => {
    expect(filterRbiSource('sendToken', 'dashboard')).toBe('dashboard');
    expect(filterRbiSource('sendToken', 'contact')).toBe('contact');
    expect(filterRbiSource('sendNFT', 'nftdetail')).toBe('nftdetail');
    expect(filterRbiSource('Receive', 'tokendetail')).toBe('tokendetail');
  });

  it('returns null for unsupported sources', () => {
    expect(filterRbiSource('sendToken', 'nftdetail')).toBeNull();
    expect(filterRbiSource('sendNFT', 'dashboard')).toBeNull();
    expect(filterRbiSource('Receive', 'contact')).toBeNull();
  });
});
