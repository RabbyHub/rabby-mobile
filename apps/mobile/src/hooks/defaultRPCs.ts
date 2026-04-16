import { customRPCService } from '@/core/services';

export function startSyncDefaultRPCs() {
  setInterval(() => {
    customRPCService.syncDefaultRPC(false);
  }, 20 * 60 * 1000);
}
