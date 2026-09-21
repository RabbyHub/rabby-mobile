import { customRPCServiceApi } from '@/core/serviceApi/customRPC';

import { findChain } from '@/utils/chain';

class ApiCustomRPC {
  setCustomRPC = customRPCServiceApi.setRPC;
  removeCustomRPC = customRPCServiceApi.removeCustomRPC;
  getAllCustomRPC = customRPCServiceApi.getAllRPC;
  getCustomRpcByChain = customRPCServiceApi.getRPCByChain;
  pingCustomRPC = customRPCServiceApi.ping;
  setRPCEnable = customRPCServiceApi.setRPCEnable;
  validateRPC = async (url: string, chainId: number) => {
    const chain = findChain({
      id: chainId,
    });
    if (!chain) {
      throw new Error(`ChainId ${chainId} is not supported`);
    }
    const [_, rpcChainId] = await Promise.all([
      customRPCServiceApi.ping(chain.enum),
      customRPCServiceApi.request(url, 'eth_chainId', []),
    ]);
    return chainId === Number(rpcChainId);
  };

  hasCustomRPC = customRPCServiceApi.hasCustomRPC;
}

export const apiCustomRPC = new ApiCustomRPC();
