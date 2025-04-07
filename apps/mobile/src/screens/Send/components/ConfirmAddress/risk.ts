import { openapi } from '@/core/request';
import { useMyAccounts } from '@/hooks/account';
import { AddrDescResponse } from '@rabby-wallet/rabby-api/dist/types';
import { useEffect, useMemo, useRef, useState } from 'react';
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
export const useRisks = (address: string) => {
  const [risks, setRisks] = useState<Array<{ type: RiskType; value: string }>>(
    [],
  );
  const { t } = useTranslation();
  const { accounts } = useMyAccounts();
  const sortedAccounts = useSortAddressList(accounts);
  const [loading, setLoading] = useState(true);
  const riskGetRef = useRef(false);

  const [addressDesc, setAddressDesc] = useState<
    AddrDescResponse['desc'] | undefined
  >();

  const hasSend = useMemo(() => {
    return !loading && !risks.some(r => r.type === RiskType.NEVER_SEND);
  }, [loading, risks]);

  useEffect(() => {
    if (riskGetRef.current) {
      return;
    }
    riskGetRef.current = true;
    (async () => {
      setLoading(true);
      const currRisks: Array<{ type: RiskType; value: string }> = [];
      let hasSended = false;
      let hasError = false;

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 2000);
      });

      const addressDescPromise = getAddrDescWithCexLocalCacheSync(address);

      const checkTransferPromise = new Promise<void>(resolve => {
        sortedAccounts.slice(0, 10).forEach(acc => {
          if (isSameAddress(acc.address, address)) {
            return;
          }
          queue.add(async () => {
            try {
              if (hasSended || hasError) {
                return;
              }
              const res = await openapi.hasTransferAllChain(
                acc.address,
                address,
              );
              if (res?.has_transfer) {
                hasSended = true;
              }
            } catch (error) {
              console.error('has_transfer fetch error', error);
              hasError = true;
            }
          });
        });
        waitQueueFinished(queue).then(() => resolve());
      });

      try {
        const [addressRes] = (await Promise.race([
          Promise.all([addressDescPromise, checkTransferPromise]),
          timeoutPromise,
        ])) as [AddrDescResponse['desc']];
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
            value: t('page.confirmAddress.risks.dexNoDeposite'),
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

        if (!hasSended && !hasError) {
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
      } catch (error) {
        console.error('check transfer timeout or error', error);
        queue.clear();
        setRisks(currRisks);
      }
      setLoading(false);
    })();
  }, [address, sortedAccounts, t]);
  return {
    risks,
    addressDesc,
    hasSend,
    loading,
  };
};
