import {
  decidePerpsMarketRefresh,
  fetchPerpsRemoteList,
} from './marketDataRefresh';

describe('Perps market data refresh policy', () => {
  it('uses a non-empty remote list as the authoritative result', async () => {
    const remote = [{ name: 'BTC' }];

    await expect(
      fetchPerpsRemoteList({
        fallback: [{ name: 'DEFAULT' }],
        label: 'top assets',
        memory: [{ name: 'MEMORY' }],
        request: async () => remote,
      }),
    ).resolves.toEqual({ error: null, items: remote, source: 'remote' });
  });

  it('uses the last successful memory list when a remote list is empty', async () => {
    const memory = [{ name: 'BTC' }];
    const result = await fetchPerpsRemoteList({
      fallback: [{ name: 'DEFAULT' }],
      label: 'top assets',
      memory,
      request: async () => [],
    });

    expect(result).toMatchObject({ items: memory, source: 'memory' });
    expect(result.error).toEqual(expect.any(Error));
  });

  it('uses the static default only when remote and memory data are unavailable', async () => {
    const fallback = [{ name: 'DEFAULT' }];
    const failure = new Error('network unavailable');
    const result = await fetchPerpsRemoteList({
      fallback,
      label: 'top assets',
      memory: [],
      request: async () => {
        throw failure;
      },
    });

    expect(result).toEqual({
      error: failure,
      items: fallback,
      source: 'default',
    });
  });

  it('publishes and persists a fully remote catalogue', () => {
    expect(
      decidePerpsMarketRefresh({
        categoriesSource: 'remote',
        hasCurrentMarketData: true,
        hasFormattedMarketData: true,
        topAssetsSource: 'remote',
      }),
    ).toEqual({ persist: true, publish: true, status: 'success' });
  });

  it('does not publish or persist when no catalogue item matches SDK metadata', () => {
    expect(
      decidePerpsMarketRefresh({
        categoriesSource: 'remote',
        hasCurrentMarketData: true,
        hasFormattedMarketData: false,
        topAssetsSource: 'remote',
      }),
    ).toEqual({ persist: false, publish: false, status: 'error' });
  });

  it('publishes fresh markets but keeps retrying stale categories', () => {
    expect(
      decidePerpsMarketRefresh({
        categoriesSource: 'memory',
        hasCurrentMarketData: true,
        hasFormattedMarketData: true,
        topAssetsSource: 'remote',
      }),
    ).toEqual({ persist: true, publish: true, status: 'error' });
  });

  it('does not replace current data with a degraded top-assets fallback', () => {
    expect(
      decidePerpsMarketRefresh({
        categoriesSource: 'remote',
        hasCurrentMarketData: true,
        hasFormattedMarketData: true,
        topAssetsSource: 'default',
      }),
    ).toEqual({ persist: false, publish: false, status: 'error' });
  });

  it('allows a degraded list only as first-render data and never persists it', () => {
    expect(
      decidePerpsMarketRefresh({
        categoriesSource: 'default',
        hasCurrentMarketData: false,
        hasFormattedMarketData: true,
        topAssetsSource: 'default',
      }),
    ).toEqual({ persist: false, publish: true, status: 'error' });
  });
});
