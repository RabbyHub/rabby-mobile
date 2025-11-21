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
export const useRisks = (
  address: string,
  options?: {
    cex?: ProjectItem | null;
    onLoadFinished?: (ctx: { risks: Array<RiskItem> }) => void;
  },
) => {
  const { cex, onLoadFinished } = options || {};
  const [risks, setRisks] = useState<Array<RiskItem>>([]);
  const { t } = useTranslation();
  const { accounts } = useMyAccounts();
  const sortedAccounts = useSortAddressList(accounts);
  const [loading, setLoading] = useState(!!address);
  const riskGetRef = useRef(false);

  const [addressDesc, setAddressDesc] = useState<
    AddrDescResponse['desc'] | undefined
  >();

  const hasSend = useMemo(() => {
    return !loading && !risks.some(r => r.type === RiskType.NEVER_SEND);
  }, [loading, risks]);

  const fetchRisks = useCallback(async () => {
    if (!address) return;
    if (riskGetRef.current) return;
    riskGetRef.current = true;
    setLoading(true);

    const currRisks: Array<RiskItem> = [];
    let hasSent = false;
    let hasError = false;

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 3000);
      });

      const addressDescPromise = getAddrDescWithCexLocalCacheSync(address);

      const checkTransferPromise = new Promise<void>(resolve => {
        sortedAccounts.slice(0, 10).forEach(acc => {
          if (isSameAddress(acc.address, address)) {
            return;
          }
          queue.add(async () => {
            try {
              if (hasSent || hasError) {
                return;
              }
              const res = await openapi.hasTransferAllChain(
                acc.address,
                address,
              );

              if (res?.has_transfer) {
                hasSent = true;
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

      if (!hasSent) {
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
  }, [address, cex, sortedAccounts, t, onLoadFinished]);

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
