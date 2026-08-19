import {
  dispatchNativeAssetSyncCompletion,
  isNativeAssetSyncRateLimitedError,
  normalizeNativeAssetSyncCompletion,
  registerNativeAssetSyncHandler,
  resetNativeAssetSyncReceiptsForTests,
  waitForNativeAssetSyncCompletion,
  type NativeAssetSyncCompletion,
} from './nativeAssetSyncReceipt';

const completion = (
  overrides: Partial<NativeAssetSyncCompletion> = {},
): NativeAssetSyncCompletion => ({
  schemaVersion: 2,
  requestId: 'request-1',
  kind: 'token',
  success: true,
  outcome: 'complete',
  address: '0xAbC',
  generation: 7,
  committedAt: 1234,
  replacementScope: 'address',
  chainIds: ['eth'],
  failedChainIds: [],
  committedRowCount: 3,
  stage: 'persistence',
  error: '',
  ...overrides,
});

describe('nativeAssetSyncReceipt', () => {
  afterEach(() => {
    jest.useRealTimers();
    resetNativeAssetSyncReceiptsForTests();
  });

  it('normalizes the native boundary and rejects incomplete commits', () => {
    expect(normalizeNativeAssetSyncCompletion(completion())).toEqual(
      expect.objectContaining({
        address: '0xabc',
        committedAt: 1234,
      }),
    );
    expect(() =>
      normalizeNativeAssetSyncCompletion(completion({ committedAt: 0 })),
    ).toThrow('must include committedAt');
    expect(
      normalizeNativeAssetSyncCompletion(
        completion({ kind: 'protocol', chainIds: [] }),
      ),
    ).toEqual(expect.objectContaining({ kind: 'protocol' }));
    expect(
      normalizeNativeAssetSyncCompletion(
        completion({ kind: 'nft', chainIds: [] }),
      ),
    ).toEqual(expect.objectContaining({ kind: 'nft' }));
    expect(() =>
      normalizeNativeAssetSyncCompletion({
        ...completion(),
        kind: 'unsupported',
      }),
    ).toThrow('kind is unsupported');
    expect(() =>
      normalizeNativeAssetSyncCompletion(
        completion({ kind: 'protocol', replacementScope: 'chains' }),
      ),
    ).toThrow('must replace one address');
  });

  it('waits for one request and resolves only after its snapshot is applied', async () => {
    let releaseApply: (() => void) | undefined;
    const apply = jest.fn(
      () =>
        new Promise<void>(resolve => {
          releaseApply = resolve;
        }),
    );
    registerNativeAssetSyncHandler('token', apply);
    const waiting = waitForNativeAssetSyncCompletion('request-1');
    const dispatched = dispatchNativeAssetSyncCompletion(completion());

    await Promise.resolve();
    expect(apply).toHaveBeenCalledTimes(1);
    let settled = false;
    waiting.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    releaseApply?.();
    await expect(dispatched).resolves.toEqual(
      expect.objectContaining({ requestId: 'request-1' }),
    );
    await expect(waiting).resolves.toEqual(
      expect.objectContaining({ requestId: 'request-1' }),
    );
  });

  it('retains an early completion until its caller starts waiting', async () => {
    registerNativeAssetSyncHandler('token', jest.fn());
    await dispatchNativeAssetSyncCompletion(completion());

    await expect(
      waitForNativeAssetSyncCompletion('request-1'),
    ).resolves.toEqual(expect.objectContaining({ generation: 7 }));
  });

  it('applies one committed generation once for joined native requests', async () => {
    const apply = jest.fn();
    registerNativeAssetSyncHandler('token', apply);

    await Promise.all([
      dispatchNativeAssetSyncCompletion(completion()),
      dispatchNativeAssetSyncCompletion(completion({ requestId: 'request-2' })),
    ]);

    expect(apply).toHaveBeenCalledTimes(1);
    await expect(
      waitForNativeAssetSyncCompletion('request-2'),
    ).resolves.toEqual(expect.objectContaining({ requestId: 'request-2' }));
  });

  it('routes each asset kind to its own snapshot handler', async () => {
    const tokenApply = jest.fn();
    const protocolApply = jest.fn();
    const nftApply = jest.fn();
    registerNativeAssetSyncHandler('token', tokenApply);
    registerNativeAssetSyncHandler('protocol', protocolApply);
    registerNativeAssetSyncHandler('nft', nftApply);

    await dispatchNativeAssetSyncCompletion(
      completion({
        requestId: 'protocol-1',
        kind: 'protocol',
        chainIds: [],
      }),
    );
    await dispatchNativeAssetSyncCompletion(
      completion({ requestId: 'nft-1', kind: 'nft', chainIds: [] }),
    );

    expect(tokenApply).not.toHaveBeenCalled();
    expect(protocolApply).toHaveBeenCalledTimes(1);
    expect(nftApply).toHaveBeenCalledTimes(1);
  });

  it('rejects a failed native request without publishing a snapshot', async () => {
    const apply = jest.fn();
    registerNativeAssetSyncHandler('token', apply);
    const failed = completion({
      success: false,
      outcome: 'failed',
      committedAt: 0,
      committedRowCount: 0,
      stage: 'token_lists',
      error: 'HTTP 429',
    });

    const request = dispatchNativeAssetSyncCompletion(failed);
    await expect(request).rejects.toThrow('HTTP 429');
    await request.catch(error => {
      expect(isNativeAssetSyncRateLimitedError(error)).toBe(true);
      expect(error.completion).toEqual({
        ...failed,
        address: failed.address.toLowerCase(),
      });
    });
    await expect(waitForNativeAssetSyncCompletion('request-1')).rejects.toThrow(
      'HTTP 429',
    );
    expect(apply).not.toHaveBeenCalled();
  });

  it('publishes a partial token commit without marking failed chains replaced', async () => {
    const apply = jest.fn();
    registerNativeAssetSyncHandler('token', apply);
    const partial = completion({
      outcome: 'partial',
      replacementScope: 'chains',
      chainIds: ['eth'],
      failedChainIds: ['arb'],
      error: 'token-list request failed for chain arb: HTTP 429',
    });

    await expect(dispatchNativeAssetSyncCompletion(partial)).resolves.toEqual(
      expect.objectContaining({ outcome: 'partial' }),
    );
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        replacementScope: 'chains',
        chainIds: ['eth'],
        failedChainIds: ['arb'],
      }),
    );
  });

  it('times out one waiter without cancelling a late native commit', async () => {
    jest.useFakeTimers();
    const apply = jest.fn();
    registerNativeAssetSyncHandler('token', apply);
    const waiting = waitForNativeAssetSyncCompletion('request-1', 25);

    jest.advanceTimersByTime(25);
    await expect(waiting).rejects.toThrow('Timed out');

    await dispatchNativeAssetSyncCompletion(completion());
    expect(apply).toHaveBeenCalledTimes(1);
    await expect(
      waitForNativeAssetSyncCompletion('request-1'),
    ).resolves.toEqual(expect.objectContaining({ requestId: 'request-1' }));
  });
});
