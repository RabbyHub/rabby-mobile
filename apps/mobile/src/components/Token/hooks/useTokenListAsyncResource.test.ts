import {
  beginTokenListRequest,
  createTokenListResourceState,
  failTokenListRequest,
  LatestAsyncRequest,
  resolveTokenListRequest,
  selectTokenListResource,
} from './useTokenListAsyncResource';

describe('token list async resource', () => {
  it('exposes loading instead of an empty result before the first request', () => {
    const state = createTokenListResourceState<string>();
    const selected = selectTokenListResource(state, true, 'first');

    expect(selected.data).toEqual([]);
    expect(selected.isLoading).toBe(true);
    expect(selected.isSettled).toBe(false);
    expect(selected.status).toBe('idle');
  });

  it('does not treat a deliberately deferred request as an empty result', () => {
    const state = createTokenListResourceState<string>();
    const selected = selectTokenListResource(state, false, 'first');

    expect(selected.isLoading).toBe(false);
    expect(selected.isSettled).toBe(false);
  });

  it('keeps ready data visible while refreshing the same request', () => {
    const ready = resolveTokenListRequest('same', ['cached']);
    const refreshing = beginTokenListRequest(ready, 'same');
    const selected = selectTokenListResource(refreshing, true, 'same');

    expect(selected.data).toEqual(['cached']);
    expect(selected.isLoading).toBe(false);
    expect(selected.isRefreshing).toBe(true);
    expect(selected.isSettled).toBe(true);
  });

  it('treats a failed current request as settled', () => {
    const loading = beginTokenListRequest(
      createTokenListResourceState<string>(),
      'failed',
    );
    const failed = failTokenListRequest(loading, 'failed', new Error('failed'));
    const selected = selectTokenListResource(failed, true, 'failed');

    expect(selected.isLoading).toBe(false);
    expect(selected.isSettled).toBe(true);
    expect(selected.status).toBe('error');
  });

  it('does not expose data belonging to a previous request identity', () => {
    const ready = resolveTokenListRequest('first', ['stale']);
    const next = beginTokenListRequest(ready, 'second');
    const selected = selectTokenListResource(next, true, 'second');

    expect(selected.data).toEqual([]);
    expect(selected.isLoading).toBe(true);
  });

  it('rejects commits from an invalidated request', () => {
    const requests = new LatestAsyncRequest();
    const first = requests.next();
    const second = requests.next();

    expect(requests.isCurrent(first)).toBe(false);
    expect(requests.isCurrent(second)).toBe(true);

    requests.invalidate();
    expect(requests.isCurrent(second)).toBe(false);
  });
});
