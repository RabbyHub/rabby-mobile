import { useMemoizedFn, useRequest } from 'ahooks';
import { openapi } from '@/core/request';
import { useEffect, useMemo, useState } from 'react';
import {
  TokenItem,
  TokenItemWithEntity,
} from '@rabby-wallet/rabby-api/dist/types';
import { patchSingleToken } from '@/databases/sync/assets';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { TokenItemEntity } from '@/databases/entities/tokenitem';

export const useTokenDetail = (
  chain: string,
  tokenId: string,
  addresses: string[],
  fromAddress?: { address: string; amount: number }[],
  isSingleAddress?: boolean,
) => {
  const [loading, setLoading] = useState(false);
  const [tokensByAddress, setTokensByAddress] = useState<
    Record<string, TokenItem>
  >({});
  const [failedAddresses, setFailedAddresses] = useState<string[]>([]);

  const fetchSingleToken = useMemoizedFn(async (address: string) => {
    try {
      const res = (await openapi.getToken(
        address,
        chain,
        tokenId,
      )) as TokenItemWithEntity;
      const cex_ids = res.identity?.cex_list?.map(item => item.id);
      res.cex_ids = cex_ids || [];
      return res;
    } catch (error) {
      console.error(`Failed to fetch token for address ${address}:`, error);
      throw error;
    }
  });

  const fetchAllAddressTokens = useMemoizedFn(async () => {
    try {
      if (addresses.length === 0 || isSingleAddress) {
        return;
      }

      console.log('fetchAllAddressTokens exe', addresses);

      setLoading(true);
      setFailedAddresses([]);

      const results = await Promise.allSettled(
        addresses.map(async address => {
          const token = await fetchSingleToken(address);
          const fromAddressItem = fromAddress?.find(item =>
            isSameAddress(item.address, address),
          );
          if (fromAddressItem && fromAddressItem.amount !== token.amount) {
            // only patch when amount is different
            patchSingleToken(address, token);
          }
          return { address, token };
        }),
      );

      const tokenTempObj: Record<string, TokenItem> = {};
      const failedAddressList: string[] = [];

      results.forEach((result, index) => {
        const address = addresses[index];

        if (result.status === 'fulfilled' && result.value.token) {
          if (result.value.token.amount) {
            tokenTempObj[address] = result.value.token;
          }
        } else {
          failedAddressList.push(address);
          if (result.status === 'rejected') {
            console.error(
              `Failed to fetch token for ${address}:`,
              result.reason,
            );
          }
        }
      });

      setTokensByAddress(tokenTempObj);
      setFailedAddresses(failedAddressList);

      console.log('fetchAllAddressTokens done');
      return {
        success: Object.keys(tokenTempObj).length,
        failed: failedAddressList.length,
        total: addresses.length,
      };
    } catch (error) {
      console.error('Unexpected error in fetchAllAddressTokens:', error);
      setFailedAddresses(addresses);
      throw error;
    } finally {
      setLoading(false);
    }
  });

  const isReady = useMemo(() => {
    return !loading && failedAddresses.length === 0;
  }, [loading, failedAddresses]);

  useEffect(() => {
    fetchAllAddressTokens();
  }, [fetchAllAddressTokens]);

  return {
    isReady,
    loading,
    tokensByAddress,
    failedAddresses,
    refetch: fetchAllAddressTokens,
  };
};
