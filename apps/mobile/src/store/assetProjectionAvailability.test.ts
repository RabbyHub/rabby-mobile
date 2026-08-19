import {
  hasConfirmedAssetProjectionSources,
  markAssetSourceSnapshotsReady,
  resolveAssetProjectionAvailability,
  resolveAssetProjectionPresentation,
  resolveAssetProjectionViewState,
} from './assetProjectionAvailability';
import type { AssetReadModelEntry } from './assetReadModel';

const createReadModel = (
  overrides: Partial<AssetReadModelEntry> = {},
): AssetReadModelEntry => ({
  kind: 'token',
  scene: 'multi-address',
  runtimeKey: 'projection-key',
  phase: 'ready',
  source: 'database',
  hasSnapshot: true,
  hasData: true,
  sourceComplete: true,
  rowCount: 2,
  revision: 1,
  ...overrides,
});

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

  it('does not leave an unresolved projection loading after its request settles', () => {
    expect(
      resolveAssetProjectionViewState({
        availability: 'unresolved',
        hasData: false,
        hasSettledRequest: true,
      }),
    ).toBe('empty');
    expect(
      resolveAssetProjectionViewState({
        availability: 'restoring',
        hasData: false,
        hasSettledRequest: true,
      }),
    ).toBe('loading');
  });

  it('does not treat hidden asset variants as visible projection data', () => {
    const hasHiddenLpTokens = true;
    const visibleProjectedTokenCount = 0;

    expect(hasHiddenLpTokens).toBe(true);
    expect(
      resolveAssetProjectionViewState({
        availability: 'restoring',
        hasData: visibleProjectedTokenCount > 0,
      }),
    ).toBe('loading');
  });

  it('keeps visible snapshot rows while a background refresh runs', () => {
    expect(
      resolveAssetProjectionPresentation({
        readModel: createReadModel({ phase: 'refreshing' }),
        availability: 'restoring',
        hasData: true,
      }),
    ).toEqual({
      viewState: 'data',
      isRefreshing: true,
      isStale: false,
    });
  });

  it('keeps a confirmed empty snapshot empty during background refresh', () => {
    expect(
      resolveAssetProjectionPresentation({
        readModel: createReadModel({
          phase: 'refreshing',
          hasData: false,
          rowCount: 0,
        }),
        availability: 'restoring',
        hasData: false,
      }).viewState,
    ).toBe('empty');
  });

  it('shows loading while the first refresh has no usable snapshot', () => {
    expect(
      resolveAssetProjectionPresentation({
        readModel: createReadModel({
          phase: 'refreshing',
          source: 'none',
          hasSnapshot: false,
          hasData: false,
          sourceComplete: false,
          rowCount: 0,
        }),
        availability: 'unresolved',
        hasData: false,
      }).viewState,
    ).toBe('loading');
  });

  it('marks stale snapshots without hiding their visible rows', () => {
    expect(
      resolveAssetProjectionPresentation({
        readModel: createReadModel({ phase: 'stale' }),
        availability: 'ready',
        hasData: true,
      }),
    ).toEqual({
      viewState: 'data',
      isRefreshing: false,
      isStale: true,
    });
  });

  it('settles a failed first request instead of leaving a permanent skeleton', () => {
    expect(
      resolveAssetProjectionPresentation({
        readModel: createReadModel({
          phase: 'error',
          source: 'none',
          hasSnapshot: false,
          hasData: false,
          sourceComplete: false,
          rowCount: 0,
        }),
        availability: 'unresolved',
        hasData: false,
      }).viewState,
    ).toBe('empty');
  });

  it('preserves the legacy availability fallback before a read model exists', () => {
    expect(
      resolveAssetProjectionPresentation({
        availability: 'restoring',
        hasData: false,
        hasSettledRequest: true,
      }).viewState,
    ).toBe('loading');
  });
});
