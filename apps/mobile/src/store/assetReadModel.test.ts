import {
  beginAssetReadModelRefresh,
  beginAssetReadModelRestore,
  failAssetReadModel,
  getAssetReadModel,
  publishAssetReadModel,
  resetAssetReadModels,
  useAssetReadModelStore,
} from './assetReadModel';

const IDENTITY = {
  kind: 'token' as const,
  scene: 'multi-address' as const,
  runtimeKey: 'top-20',
};

describe('asset read model', () => {
  beforeEach(() => {
    resetAssetReadModels();
  });

  it('exists before storage or remote data is ready', () => {
    expect(getAssetReadModel(IDENTITY)).toEqual(
      expect.objectContaining({
        phase: 'uninitialized',
        hasSnapshot: false,
        hasData: false,
        source: 'none',
      }),
    );
  });

  it('distinguishes a confirmed empty snapshot from unresolved data', () => {
    beginAssetReadModelRestore(IDENTITY);
    expect(getAssetReadModel(IDENTITY).phase).toBe('restoring');

    publishAssetReadModel(IDENTITY, {
      source: 'database',
      rowCount: 0,
      sourceComplete: true,
      generation: 4,
      committedAt: 100,
    });

    expect(getAssetReadModel(IDENTITY)).toEqual(
      expect.objectContaining({
        phase: 'ready',
        hasSnapshot: true,
        hasData: false,
        sourceComplete: true,
        generation: 4,
        committedAt: 100,
      }),
    );
  });

  it('keeps usable data while a refresh is running or fails', () => {
    publishAssetReadModel(IDENTITY, {
      source: 'database',
      rowCount: 3,
      sourceComplete: true,
      generation: 2,
    });
    beginAssetReadModelRefresh(IDENTITY, 'refresh-1');

    expect(getAssetReadModel(IDENTITY)).toEqual(
      expect.objectContaining({
        phase: 'refreshing',
        hasData: true,
        rowCount: 3,
      }),
    );

    failAssetReadModel(IDENTITY, new Error('HTTP 429'), 'refresh-1');
    expect(getAssetReadModel(IDENTITY)).toEqual(
      expect.objectContaining({
        phase: 'stale',
        hasData: true,
        rowCount: 3,
        lastError: 'HTTP 429',
      }),
    );
  });

  it('rejects completion from a superseded refresh', () => {
    beginAssetReadModelRefresh(IDENTITY, 'refresh-1');
    beginAssetReadModelRefresh(IDENTITY, 'refresh-2');

    expect(
      publishAssetReadModel(IDENTITY, {
        source: 'remote',
        rowCount: 8,
        sourceComplete: true,
        requestId: 'refresh-1',
      }),
    ).toBe(false);
    expect(getAssetReadModel(IDENTITY).activeRequestId).toBe('refresh-2');

    expect(
      publishAssetReadModel(IDENTITY, {
        source: 'remote',
        rowCount: 9,
        sourceComplete: true,
        requestId: 'refresh-2',
      }),
    ).toBe(true);
    expect(getAssetReadModel(IDENTITY)).toEqual(
      expect.objectContaining({
        phase: 'ready',
        rowCount: 9,
        revision: 1,
      }),
    );

    expect(
      publishAssetReadModel(IDENTITY, {
        source: 'remote',
        rowCount: 10,
        sourceComplete: true,
        requestId: 'refresh-2',
      }),
    ).toBe(false);
    expect(getAssetReadModel(IDENTITY).rowCount).toBe(9);
  });

  it('does not publish a new revision for an identical snapshot', () => {
    publishAssetReadModel(IDENTITY, {
      source: 'database',
      rowCount: 3,
      sourceComplete: true,
      generation: 2,
      committedAt: 100,
    });

    const revision = getAssetReadModel(IDENTITY).revision;
    const notify = jest.fn();
    const unsubscribe = useAssetReadModelStore.subscribe(notify);

    expect(
      publishAssetReadModel(IDENTITY, {
        source: 'database',
        rowCount: 3,
        sourceComplete: true,
        generation: 2,
        committedAt: 100,
      }),
    ).toBe(true);

    expect(getAssetReadModel(IDENTITY).revision).toBe(revision);
    expect(notify).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('uses an error state when no usable snapshot exists', () => {
    beginAssetReadModelRefresh(IDENTITY, 'refresh-1');
    failAssetReadModel(IDENTITY, 'offline', 'refresh-1');

    expect(getAssetReadModel(IDENTITY)).toEqual(
      expect.objectContaining({
        phase: 'error',
        hasSnapshot: false,
        lastError: 'offline',
      }),
    );
  });
});
