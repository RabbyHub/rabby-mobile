import { isNonPublicProductionEnv } from '@/constant';
import { registerSyncAbortHandler } from '@/databases/sync/abort';
import RNHelpers from './RNHelpers';

export type NativeOpenApiDiagnosticResult = Awaited<
  ReturnType<typeof RNHelpers.runNativeOpenApiDiagnostic>
>;

export function runNativeOpenApiDiagnostic(address: string) {
  if (!isNonPublicProductionEnv) {
    return Promise.reject(
      new Error('Native OpenAPI diagnostics are disabled in production builds'),
    );
  }
  return RNHelpers.runNativeOpenApiDiagnostic(address);
}

export type NativeAssetSyncSchedulerDiagnostics = Awaited<
  ReturnType<typeof RNHelpers.getNativeAssetSyncSchedulerDiagnostics>
>;

export function getNativeAssetSyncSchedulerDiagnostics() {
  if (!isNonPublicProductionEnv) {
    return Promise.reject(
      new Error(
        'Native asset sync diagnostics are disabled in production builds',
      ),
    );
  }
  return RNHelpers.getNativeAssetSyncSchedulerDiagnostics();
}

export function diffNativeAssetSyncSchedulerDiagnostics(
  before: NativeAssetSyncSchedulerDiagnostics,
  after: NativeAssetSyncSchedulerDiagnostics,
) {
  return {
    realRequestDispatchCount:
      after.realRequestDispatchCount - before.realRequestDispatchCount,
    completedRequestCount:
      after.completedRequestCount - before.completedRequestCount,
    http429ResponseCount:
      after.http429ResponseCount - before.http429ResponseCount,
    queuedSynthetic429Count:
      after.queuedSynthetic429Count - before.queuedSynthetic429Count,
    cooldownSynthetic429Count:
      after.cooldownSynthetic429Count - before.cooldownSynthetic429Count,
    activeRequestCount: after.activeRequestCount,
    queuedRequestCount: after.queuedRequestCount,
    queuedProcessingTaskCount: after.queuedProcessingTaskCount,
    cooldownRemainingMsBefore: before.cooldownRemainingMs,
    cooldownRemainingMsAfter: after.cooldownRemainingMs,
  };
}

export type NativeTokenCacheSyncDiagnosticResult = Awaited<
  ReturnType<typeof RNHelpers.runNativeTokenCacheSyncDiagnostic>
> & {
  hydrated: boolean;
  hydratedTokenCount: number;
  hydrationDurationMs: number;
};

export type NativeTokenCacheWriteDiagnosticResult = Awaited<
  ReturnType<typeof RNHelpers.runNativeTokenCacheWriteDiagnostic>
>;

export function runNativeTokenCacheWriteDiagnostic() {
  if (!isNonPublicProductionEnv) {
    return Promise.reject(
      new Error(
        'Native token cache write diagnostics are disabled in production builds',
      ),
    );
  }
  return RNHelpers.runNativeTokenCacheWriteDiagnostic();
}

export async function runNativeTokenCacheSyncDiagnostic(
  address: string,
  replaceExisting = true,
): Promise<NativeTokenCacheSyncDiagnosticResult> {
  if (!isNonPublicProductionEnv) {
    throw new Error(
      'Native token sync diagnostics are disabled in production builds',
    );
  }

  const result = await RNHelpers.runNativeTokenCacheSyncDiagnostic(
    address,
    replaceExisting,
  );
  if (!result.success) {
    return {
      ...result,
      hydrated: false,
      hydratedTokenCount: 0,
      hydrationDurationMs: 0,
    };
  }

  const hydrationStartedAt = Date.now();
  const { hydrateCommittedNativeTokenSnapshot } = await import(
    '@/store/tokens'
  );
  const hydratedTokenCount = await hydrateCommittedNativeTokenSnapshot(
    result.address,
  );
  return {
    ...result,
    hydrated: true,
    hydratedTokenCount,
    hydrationDurationMs: Date.now() - hydrationStartedAt,
  };
}

if (isNonPublicProductionEnv) {
  registerSyncAbortHandler(() => {
    RNHelpers.cancelAllNativeTokenCacheSyncs();
  });
}
