import { customRPCService } from '../services/shared';

import { findChain } from '@/utils/chain';

class ApiCustomRPC {
  setCustomRPC = customRPCService.setRPC;
  removeCustomRPC = customRPCService.removeCustomRPC;
  getAllCustomRPC = customRPCService.getAllRPC;
  getCustomRpcByChain = customRPCService.getRPCByChain;
  pingCustomRPC = customRPCService.ping;
  setRPCEnable = customRPCService.setRPCEnable;
  validateRPC = async (url: string, chainId: number) => {
    const chain = findChain({
      id: chainId,
    });
    if (!chain) {
      throw new Error(`ChainId ${chainId} is not supported`);
    }
    const [_, rpcChainId] = await Promise.all([
      customRPCService.ping(chain.enum),
      customRPCService.request(url, 'eth_chainId', []),
    ]);
    return chainId === Number(rpcChainId);
  };

  hasCustomRPC = customRPCService.hasCustomRPC;
}

export const apiCustomRPC = new ApiCustomRPC();
