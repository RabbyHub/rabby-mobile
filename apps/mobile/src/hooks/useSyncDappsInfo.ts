import { syncBasicDappsInfo } from '@/core/apis/dapp';
import { useRequest } from 'ahooks';

export function useSyncDappsInfo(params?: { manual?: boolean }) {
  const { runAsync: runSyncDappInfo } = useRequest(syncBasicDappsInfo, {
    ...params,
    onError(e) {
      console.error('useSyncDappsInfo', e);
    },
  });
  return {
    runSyncDappInfo,
  };
}
