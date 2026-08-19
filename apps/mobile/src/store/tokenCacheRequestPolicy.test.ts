import {
  selectTokenCacheApplicableAddresses,
  selectTokenCacheRequestAddresses,
} from './tokenCacheRequestPolicy';

describe('token cache request policy', () => {
  const addresses = ['missing', 'empty', 'retained', 'confirmed'];
  const snapshots = {
    empty: [],
    retained: [{ id: 'retained-token' }],
    confirmed: [],
  };
  const confirmedLocalAddresses = new Set(['confirmed']);

  it('requests only snapshots that the cache can improve', () => {
    expect(
      selectTokenCacheRequestAddresses(
        addresses,
        snapshots,
        confirmedLocalAddresses,
      ),
    ).toEqual(['missing', 'empty']);
  });

  it('publishes an empty cache result only for a previously missing snapshot', () => {
    expect(
      selectTokenCacheApplicableAddresses(
        addresses,
        snapshots,
        {
          missing: [],
          empty: [],
          retained: [{ id: 'stale-token' }],
          confirmed: [{ id: 'ignored-token' }],
        },
        new Set(addresses),
        confirmedLocalAddresses,
      ),
    ).toEqual(['missing']);
  });

  it('fills an empty snapshot without replacing retained or confirmed data', () => {
    expect(
      selectTokenCacheApplicableAddresses(
        addresses,
        snapshots,
        {
          missing: [{ id: 'missing-token' }],
          empty: [{ id: 'empty-token' }],
          retained: [{ id: 'stale-token' }],
          confirmed: [{ id: 'ignored-token' }],
        },
        new Set(addresses),
        confirmedLocalAddresses,
      ),
    ).toEqual(['missing', 'empty']);
  });

  it('ignores cache requests that failed', () => {
    expect(
      selectTokenCacheApplicableAddresses(
        addresses,
        snapshots,
        {
          missing: [{ id: 'missing-token' }],
          empty: [{ id: 'empty-token' }],
        },
        new Set(['missing']),
        confirmedLocalAddresses,
      ),
    ).toEqual(['missing']);
  });
});
