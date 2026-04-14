import { openapi } from '@/core/request';
import { TotalBalanceResponse } from '@rabby-wallet/rabby-api/dist/types';
import addressBalanceStore from '@/store/balance';

export type EvmTotalBalanceResponse = TotalBalanceResponse & {
  evm_usd_value?: number;
};

type Parameters<T extends (...args: any) => any> = T extends (
  ...args: infer P
) => any
  ? P
  : never;
type FirstParameter<T extends (...args: any) => any> = Parameters<T>[0];

export const batchBalanceWithLocalCache = async (
  params: FirstParameter<typeof openapi.getTotalBalanceV2>,
  force?: boolean,
  onlySync?: boolean,
): Promise<EvmTotalBalanceResponse> => {
  const { address } = params;
  const lowerAddress = address.toLowerCase();

  if (onlySync) {
    return { total_usd_value: 0, chain_list: [] };
  }

  // 通过 addressBalance resource 获取数据（内部已处理缓存和过期逻辑）
  await addressBalanceStore.getTotalBalance(address, force, {
    scene: 'Database',
    requester: 'batchBalanceWithLocalCache',
    endpoint: 'openapi.getTotalBalanceV2',
  });

  const balance = addressBalanceStore.getAddressValue(lowerAddress);
  const chainList = addressBalanceStore.getAddressChainList(lowerAddress);

  return {
    total_usd_value: balance?.totalBalance ?? 0,
    evm_usd_value: balance?.evmBalance ?? 0,
    chain_list: chainList || [],
  };
};
