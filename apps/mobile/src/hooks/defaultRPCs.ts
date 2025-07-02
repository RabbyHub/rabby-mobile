import { customRPCService } from '@/core/services';
import useInterval from 'react-use/lib/useInterval';

export const useIntervalSyncDDefaultRPCs = () => {
  useInterval(() => {
    customRPCService.syncDefaultRPC(false);
  }, 20 * 60 * 1000); // 30 minutes
};
