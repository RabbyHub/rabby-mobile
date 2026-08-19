jest.mock('@/constant', () => ({
  isNonPublicProductionEnv: true,
}));

jest.mock('@/databases/sync/abort', () => ({
  registerSyncAbortHandler: jest.fn(),
}));

jest.mock('@/store/tokens', () => ({
  hydrateCommittedNativeTokenSnapshot: jest.fn(),
}));

jest.mock('./RNHelpers', () => ({
  __esModule: true,
  default: {
    runNativeOpenApiDiagnostic: jest.fn(),
    getNativeAssetSyncSchedulerDiagnostics: jest.fn(),
    runNativeTokenCacheSyncDiagnostic: jest.fn(),
    runNativeTokenCacheWriteDiagnostic: jest.fn(),
    cancelAllNativeTokenCacheSyncs: jest.fn(),
  },
}));

import { registerSyncAbortHandler } from '@/databases/sync/abort';
import { hydrateCommittedNativeTokenSnapshot } from '@/store/tokens';
import RNHelpers from './RNHelpers';
import {
  diffNativeAssetSyncSchedulerDiagnostics,
  getNativeAssetSyncSchedulerDiagnostics,
  runNativeTokenCacheSyncDiagnostic,
  runNativeTokenCacheWriteDiagnostic,
} from './nativeOpenApiDiagnostic';

const mockRunNativeTokenCacheSyncDiagnostic = jest.mocked(
  RNHelpers.runNativeTokenCacheSyncDiagnostic,
);
const mockGetNativeAssetSyncSchedulerDiagnostics = jest.mocked(
  RNHelpers.getNativeAssetSyncSchedulerDiagnostics,
);
const mockCancelAllNativeTokenCacheSyncs = jest.mocked(
  RNHelpers.cancelAllNativeTokenCacheSyncs,
);
const mockRunNativeTokenCacheWriteDiagnostic = jest.mocked(
  RNHelpers.runNativeTokenCacheWriteDiagnostic,
);
const mockHydrateCommittedNativeTokenSnapshot = jest.mocked(
  hydrateCommittedNativeTokenSnapshot,
);
const mockRegisterSyncAbortHandler = jest.mocked(registerSyncAbortHandler);
const registeredAbortHandler = mockRegisterSyncAbortHandler.mock.calls[0]?.[0];

const successfulResult = {
  success: true,
  address: '0x1111111111111111111111111111111111111111',
  generation: 3,
  stage: 'persistence',
  chainCount: 2,
  sourceTokenCount: 4,
  filteredTokenCount: 1,
  committedRowCount: 3,
  committedAtMs: 1234,
  durationMs: 25,
  error: '',
};

describe('native OpenAPI diagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hydrates the committed address only after native persistence succeeds', async () => {
    mockRunNativeTokenCacheSyncDiagnostic.mockResolvedValue(successfulResult);
    mockHydrateCommittedNativeTokenSnapshot.mockResolvedValue(3);
    jest.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(112);

    await expect(
      runNativeTokenCacheSyncDiagnostic(successfulResult.address),
    ).resolves.toEqual({
      ...successfulResult,
      hydrated: true,
      hydratedTokenCount: 3,
      hydrationDurationMs: 12,
    });
    expect(mockRunNativeTokenCacheSyncDiagnostic).toHaveBeenCalledWith(
      successfulResult.address,
      true,
    );
    expect(mockHydrateCommittedNativeTokenSnapshot).toHaveBeenCalledWith(
      successfulResult.address,
    );
  });

  it('does not hydrate when the native transaction fails', async () => {
    mockRunNativeTokenCacheSyncDiagnostic.mockResolvedValue({
      ...successfulResult,
      success: false,
      stage: 'token_lists',
      error: 'HTTP 429',
    });

    await expect(
      runNativeTokenCacheSyncDiagnostic(successfulResult.address, false),
    ).resolves.toMatchObject({
      success: false,
      hydrated: false,
      hydratedTokenCount: 0,
      hydrationDurationMs: 0,
    });
    expect(mockRunNativeTokenCacheSyncDiagnostic).toHaveBeenCalledWith(
      successfulResult.address,
      false,
    );
    expect(mockHydrateCommittedNativeTokenSnapshot).not.toHaveBeenCalled();
  });

  it('cancels all native syncs through the shared abort lifecycle', () => {
    expect(registeredAbortHandler).toEqual(expect.any(Function));
    registeredAbortHandler('clear-app-cache');

    expect(mockCancelAllNativeTokenCacheSyncs).toHaveBeenCalledTimes(1);
  });

  it('runs the fixed native write-and-rollback diagnostic', async () => {
    const result = {
      success: true,
      stage: 'rolled_back',
      attemptedRowCount: 1,
      durationMs: 4,
      error: '',
    };
    mockRunNativeTokenCacheWriteDiagnostic.mockResolvedValue(result);

    await expect(runNativeTokenCacheWriteDiagnostic()).resolves.toEqual(result);
    expect(mockRunNativeTokenCacheWriteDiagnostic).toHaveBeenCalledWith();
  });

  it('reports scheduler work as a bounded before-and-after delta', async () => {
    const before = {
      realRequestDispatchCount: 10,
      completedRequestCount: 8,
      http429ResponseCount: 1,
      queuedSynthetic429Count: 2,
      cooldownSynthetic429Count: 3,
      activeRequestCount: 2,
      queuedRequestCount: 4,
      queuedProcessingTaskCount: 1,
      cooldownRemainingMs: 500,
    };
    const after = {
      realRequestDispatchCount: 16,
      completedRequestCount: 14,
      http429ResponseCount: 2,
      queuedSynthetic429Count: 5,
      cooldownSynthetic429Count: 7,
      activeRequestCount: 0,
      queuedRequestCount: 0,
      queuedProcessingTaskCount: 0,
      cooldownRemainingMs: 100,
    };
    mockGetNativeAssetSyncSchedulerDiagnostics.mockResolvedValue(before);

    await expect(getNativeAssetSyncSchedulerDiagnostics()).resolves.toEqual(
      before,
    );
    expect(diffNativeAssetSyncSchedulerDiagnostics(before, after)).toEqual({
      realRequestDispatchCount: 6,
      completedRequestCount: 6,
      http429ResponseCount: 1,
      queuedSynthetic429Count: 3,
      cooldownSynthetic429Count: 4,
      activeRequestCount: 0,
      queuedRequestCount: 0,
      queuedProcessingTaskCount: 0,
      cooldownRemainingMsBefore: 500,
      cooldownRemainingMsAfter: 100,
    });
  });
});
