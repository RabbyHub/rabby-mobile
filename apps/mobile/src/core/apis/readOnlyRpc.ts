import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { CHAINS_ENUM } from '@/constant/chains';
import { customRPCService } from '@/core/services/customRPCService';
import { customTestnetService } from '@/core/services/customTestnetService';
import RpcCache from '@/core/services/rpcCache';
import type { Account } from '@/types/account';
import { findChain } from '@/utils/chain';

type ReadOnlyRPCRequest = {
  method: string;
  params: any[];
};

export const requestReadOnlyETHRpc = <T = any>(
  data: ReadOnlyRPCRequest,
  chainServerId: string,
  account?: Account | null,
): Promise<T> => {
  const { method, params } = data;
  const currentAddress = account?.address.toLowerCase() || '0x';
  const cache = RpcCache.get(currentAddress, {
    method,
    params,
    chainId: chainServerId,
  });
  if (cache) {
    return Promise.resolve(cache as T);
  }

  const chain =
    findChain({
      serverId: chainServerId,
    }) || findChain({ enum: CHAINS_ENUM.ETH })!;

  const promise = !chain.isTestnet
    ? customRPCService.hasCustomRPC(chain.enum)
      ? customRPCService.requestCustomRPC(chain.enum, method, params)
      : customRPCService.defaultEthRPC({
          chainServerId,
          origin: INTERNAL_REQUEST_SESSION.origin,
          method,
          params,
        })
    : customTestnetService
        .getClient(chain.id)
        .request({ method: method as any, params: params as any });

  const cachedPromise = promise.then(result => {
    RpcCache.set(currentAddress, {
      method,
      params,
      result,
      chainId: chainServerId,
    });
    return result as T;
  });

  RpcCache.set(currentAddress, {
    method,
    params,
    result: cachedPromise,
    chainId: chainServerId,
  });

  return cachedPromise;
};
