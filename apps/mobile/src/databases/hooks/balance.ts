import { openapi } from '@/core/request';
import { BalanceEntity } from '../entities/balance';
import { runOnJS } from 'react-native-reanimated';
import { syncBalance } from '../sync/assets';
import { TotalBalanceResponse } from '@rabby-wallet/rabby-api/dist/types';

export type EvmTotalBalanceResponse = TotalBalanceResponse & {
  evm_usd_value?: number;
};

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

export const getAppChainUsdValue = async (
  address: string,
  excludeProtocolIds: string[],
) => {
  let appChainTotalNetWorth = 0;
  try {
    const { apps } = await openapi.getAppChainList(address);
    const lowerCasePortocolIds = excludeProtocolIds?.map(app =>
      app?.toLowerCase(),
    );
    apps?.forEach(app => {
      if (lowerCasePortocolIds?.includes(app?.id?.toLowerCase())) {
        return;
      }
      app?.portfolio_item_list?.forEach(item => {
        appChainTotalNetWorth += item.stats.net_usd_value;
      });
    });
  } catch (error) {
    // just ignore appChain data
  }
  return appChainTotalNetWorth;
};

export const batchBalanceWithLocalCache = async (
  params: FirstParameter<typeof openapi.getTotalBalanceV2>,
  force?: boolean,
  onlySync?: boolean,
  needAppChainUsdValue?: boolean,
): Promise<EvmTotalBalanceResponse> => {
  const { address, isCore } = params;
  const isExpired = await BalanceEntity.isExpired(address, isCore);
  if (force || isExpired) {
    const balance = await openapi.getTotalBalanceV2(params);
    const formatBalance: EvmTotalBalanceResponse = {
      ...balance,
      evm_usd_value: balance.total_usd_value,
    };
    if (needAppChainUsdValue) {
      const appChainUsdValue = await getAppChainUsdValue(
        address,
        params.excluded_protocol_ids,
      );
      formatBalance.total_usd_value += appChainUsdValue;
    }
    syncBalance(address, isCore, formatBalance);
    return formatBalance;
  } else {
    return onlySync
      ? { total_usd_value: 0, chain_list: [] }
      : BalanceEntity.queryBalance(address, isCore);
  }
};
