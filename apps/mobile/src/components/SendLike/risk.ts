import { openapi } from '@/core/request';
import { useMyAccounts } from '@/hooks/account';
import {
  AddrDescResponse,
  ProjectItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PQueue from 'p-queue';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { getAddrDescWithCexLocalCacheSync } from '@/databases/hooks/cex';
import { useSortAddressList } from '@/screens/Address/useSortAddressList';
import { useCreationWithShallowCompare } from '@/hooks/common/useMemozied';

const queue = new PQueue({ intervalCap: 5, concurrency: 5, interval: 1000 });

const waitQueueFinished = (q: PQueue) => {
  return new Promise(resolve => {
    q.on('empty', () => {
      if (q.pending <= 0) {
        resolve(null);
      }
    });
  });
};

export const enum RiskType {
  NEVER_SEND = 1,
  SCAM_ADDRESS = 2,
  CONTRACT_ADDRESS = 3,
  CEX_NO_DEPOSIT = 4,
}
type RiskItem = { type: RiskType; value: string };
export const useRisks = (options: {
  toAddress: string;
  fromAddress?: string;
  cex?: ProjectItem | null;
  onLoadFinished?: (ctx: { risks: Array<RiskItem> }) => void;
}) => {
  const { fromAddress, toAddress, cex, onLoadFinished } = options;
  const [risks, setRisks] = useState<Array<RiskItem>>([]);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(!!toAddress);
  const riskGetRef = useRef(false);

  const [addressDesc, setAddressDesc] = useState<
    AddrDescResponse['desc'] | undefined
  >();

  const hasSend = useMemo(() => {
    return !loading && !risks.some(r => r.type === RiskType.NEVER_SEND);
  }, [loading, risks]);

  const { accounts } = useMyAccounts();
  const sortedAccounts = useSortAddressList(accounts);

  const top10Addresses = useCreationWithShallowCompare(() => {
    return sortedAccounts.slice(0, __DEV__ ? 1 : 10).map(acc => acc.address);
  }, [sortedAccounts]);
  const caredAddresses = useMemo(() => {
    if (fromAddress) return [fromAddress];

    return top10Addresses;
  }, [fromAddress, top10Addresses]);

  const fetchRisks = useCallback(async () => {
    if (!caredAddresses.length || !toAddress) return;
    if (riskGetRef.current) return;
    riskGetRef.current = true;
    setLoading(true);

    const currRisks: Array<RiskItem> = [];
    let addressSent = '';
    let hasError = false;

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 3000);
      });

      const addressDescPromise = getAddrDescWithCexLocalCacheSync(toAddress);

      const checkTransferPromise = new Promise<void>(resolve => {
        caredAddresses.forEach(addr => {
          if (isSameAddress(addr, toAddress)) return;

          queue.add(async () => {
            try {
              if (addressSent || hasError) return;
              const res = await openapi.hasTransferAllChain(addr, toAddress);

              if (res?.has_transfer) {
                addressSent = addr;
              }
            } catch (error) {
              console.error('has_transfer fetch error', error);
              hasError = true;
            }
          });
        });
        waitQueueFinished(queue).then(() => resolve());
      });

      addressDescPromise.then(addressRes => {
        if (!addressRes) {
          return;
        }
        if (cex) {
          if (!addressRes?.cex) {
            addressRes.cex = {
              id: cex.id,
              name: cex.name,
              logo_url: cex.logo_url,
              is_deposit: true,
            };
          } else {
            addressRes.cex.is_deposit = true;
            addressRes.cex.name = cex.name;
            addressRes.cex.logo_url = cex.logo_url;
            addressRes.cex.id = cex.id;
          }
        }
        if (addressRes) {
          setAddressDesc(addressRes);
        }
        if (addressRes?.is_danger || addressRes?.is_scam) {
          currRisks.push({
            type: RiskType.SCAM_ADDRESS,
            value: t('page.confirmAddress.risks.scamAddress'),
          });
        }
        if (addressRes?.cex?.id && !addressRes.cex.is_deposit) {
          currRisks.push({
            type: RiskType.CEX_NO_DEPOSIT,
            value: t('page.confirmAddress.risks.cexNoDeposite'),
          });
        }
        const isContract = Object.keys(addressRes?.contract || {}).length > 0;
        const isSafeAddress = Object.keys(addressRes?.contract || {}).some(
          key => {
            const contract = addressRes?.contract?.[key];
            return !!contract?.multisig;
          },
        );
        if (isContract && !isSafeAddress) {
          currRisks.push({
            type: RiskType.CONTRACT_ADDRESS,
            value: t('page.confirmAddress.risks.contractAddress'),
          });
        }
      });

      await Promise.race([
        Promise.all([addressDescPromise, checkTransferPromise]),
        timeoutPromise,
      ]);

      if (!addressSent) {
        setRisks([
          ...currRisks,
          {
            type: RiskType.NEVER_SEND,
            value: t('page.confirmAddress.risks.noSend'),
          },
        ]);
      } else {
        setRisks(currRisks);
      }
      onLoadFinished?.({ risks: [...currRisks] });
    } catch (error) {
      console.error('check transfer timeout or error', error);
      queue.clear();
      const risks = [
        ...currRisks,
        {
          type: RiskType.NEVER_SEND,
          value: t('page.confirmAddress.risks.noSend'),
        },
      ];
      setRisks(risks);
      onLoadFinished?.({ risks });
    } finally {
      riskGetRef.current = false;
      setLoading(false);
    }
  }, [caredAddresses, toAddress, cex, t, onLoadFinished]);

  useEffect(() => {
    fetchRisks();
  }, [fetchRisks]);

  return {
    risks,
    addressDesc,
    hasSend,
    loading,
    fetchRisks,
  };
};

const riskTypePriority = {
  [RiskType.CEX_NO_DEPOSIT]: 1,
  [RiskType.NEVER_SEND]: 11,
  [RiskType.CONTRACT_ADDRESS]: 111,
  [RiskType.SCAM_ADDRESS]: 1111,
};

export function sortRisksDesc(a: { type: RiskType }, b: { type: RiskType }) {
  return (
    riskTypePriority[b.type as keyof typeof riskTypePriority] -
    riskTypePriority[a.type as keyof typeof riskTypePriority]
  );
}
