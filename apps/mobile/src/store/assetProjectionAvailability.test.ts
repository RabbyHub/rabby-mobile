import {
  hasConfirmedAssetProjectionSources,
  markAssetSourceSnapshotsReady,
  resolveAssetProjectionAvailability,
  resolveAssetProjectionViewState,
} from './assetProjectionAvailability';

describe('asset projection availability', () => {
  it('keeps a new projection unresolved until every source is known', () => {
    expect(
      hasConfirmedAssetProjectionSources(['0xA', '0xB'], {
        '0xa': true,
      }),
    ).toBe(false);
    expect(
      resolveAssetProjectionAvailability({
        hasProjection: true,
        hasData: false,
        hasCompleteSource: false,
      }),
    ).toBe('unresolved');
  });

  it('does not confuse an in-memory empty list with a confirmed snapshot', () => {
    const readiness = markAssetSourceSnapshotsReady({}, ['0xA']);

    expect(hasConfirmedAssetProjectionSources(['0xA'], readiness)).toBe(true);
    expect(hasConfirmedAssetProjectionSources(['0xB'], readiness)).toBe(false);
  });

  it('distinguishes a restore in progress from a confirmed empty result', () => {
    expect(
      resolveAssetProjectionAvailability({
        hasProjection: true,
        hasData: false,
        hasCompleteSource: false,
        isRestoring: true,
      }),
    ).toBe('restoring');
    expect(
      resolveAssetProjectionAvailability({
        hasProjection: true,
        hasData: false,
        hasCompleteSource: true,
      }),
    ).toBe('ready');
  });

  it('does not treat a complete source as ready before its projection exists', () => {
    expect(
      resolveAssetProjectionAvailability({
        hasProjection: false,
        hasData: false,
        hasCompleteSource: true,
      }),
    ).toBe('unresolved');
  });

  it('keeps usable data visible regardless of background readiness', () => {
    expect(
      resolveAssetProjectionViewState({
        availability: 'restoring',
        hasData: true,
      }),
    ).toBe('data');
  });

  it('shows loading before resolution and empty only after resolution', () => {
    expect(
      resolveAssetProjectionViewState({
        availability: 'unresolved',
        hasData: false,
      }),
    ).toBe('loading');
    expect(
      resolveAssetProjectionViewState({
        availability: 'ready',
        hasData: false,
      }),
    ).toBe('empty');
  });
});
