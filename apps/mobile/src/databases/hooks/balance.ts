import { openapi } from '@/core/request';
import { BalanceEntity } from '../entities/balance';
import { runOnJS } from 'react-native-reanimated';
import { syncBalance } from '../sync/assets';

type Parameters<T extends (...args: any) => any> = T extends (
  ...args: infer P
) => any
  ? P
  : never;
type FirstParameter<T extends (...args: any) => any> = Parameters<T>[0];

type ReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => infer R
  ? R
  : any;

export const batchBalanceWithLocalCache = async (
  params: FirstParameter<typeof openapi.getTotalBalanceV2>,
  force?: boolean,
  onlySync?: boolean,
): Promise<ReturnType<typeof openapi.getTotalBalanceV2>> => {
  const { address, isCore } = params;
  const isExpired = await BalanceEntity.isExpired(address, isCore);
  if (force || isExpired) {
    const balance = await openapi.getTotalBalanceV2(params);
    runOnJS(syncBalance)(address, isCore, balance);
    return balance;
  } else {
    return onlySync
      ? { total_usd_value: 0, chain_list: [] }
      : BalanceEntity.queryBalance(address, isCore);
  }
};
