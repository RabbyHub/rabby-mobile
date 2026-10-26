import { customRPCServiceApi } from '@/core/serviceApi/customRPC';

export function startSyncDefaultRPCs() {
  setInterval(() => {
    customRPCServiceApi.syncDefaultRPC(false).catch(error => {
      console.error(error);
    });
  }, 20 * 60 * 1000);
}
