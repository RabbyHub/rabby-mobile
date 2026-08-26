import type { TokenSnapshotPersistence } from '@rabby-wallet/asset-sync-worker-core';
import NativeModules from 'react-native/Libraries/BatchedBridge/NativeModules';

type WorkerAssetStoreNativeModule = {
  commitTokenSnapshot(
    address: string,
    syncTimestamp: number,
    rows: Parameters<
      TokenSnapshotPersistence['commitTokenSnapshot']
    >[0]['rows'],
  ): Promise<{ rowCount: number; applied: boolean }>;
};

const WorkerAssetStore = (NativeModules as unknown as Record<string, unknown>)
  .WorkerAssetStore as WorkerAssetStoreNativeModule | null;

export const workerTokenSnapshotPersistence: TokenSnapshotPersistence = {
  async commitTokenSnapshot({ address, syncTimestamp, rows }) {
    if (!WorkerAssetStore?.commitTokenSnapshot) {
      throw new Error('worker_asset_store_unavailable');
    }
    return WorkerAssetStore.commitTokenSnapshot(address, syncTimestamp, rows);
  },
};
