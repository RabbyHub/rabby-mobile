import { openapi } from '@/core/request';
import { useMyAccounts } from '@/hooks/account';
import { AddrDescResponse } from '@rabby-wallet/rabby-api/dist/types';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PQueue from 'p-queue';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

const queue = new PQueue({ intervalCap: 10, concurrency: 10, interval: 1000 });

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
  CEX_NO_DEPOSITE = 4,
}
export const useRisks = (address: string) => {
  const [risks, setRisks] = useState<Array<{ type: RiskType; value: string }>>(
    [],
  );
  const { t } = useTranslation();
  const { accounts } = useMyAccounts();
  const [loading, setLoading] = useState(true);
  const riskGetRef = useRef(false);

  const [addressDesc, setAddressDesc] = useState<
    AddrDescResponse['desc'] | undefined
  >();

  const hasSend = useMemo(() => {
    return !loading && !risks.some(r => r.type === RiskType.NEVER_SEND);
  }, [loading, risks]);

  useLayoutEffect(() => {
    riskGetRef.current = false;
    openapi.addrDesc(address).then(res => {
      if (res.desc) {
        setAddressDesc(res.desc);
      }
    });
  }, [address]);
  useEffect(() => {
    if (riskGetRef.current && !addressDesc) {
      return;
    }
    riskGetRef.current = true;
    (async () => {
      setLoading(true);
      const currRisks: Array<{ type: RiskType; value: string }> = [];
      if (addressDesc?.is_danger || addressDesc?.is_scam) {
        currRisks.push({
          type: RiskType.SCAM_ADDRESS,
          value: t('page.confirmAddress.risks.scamAddress'),
        });
      }
      if (addressDesc?.cex?.id && !addressDesc.cex.is_deposit) {
        currRisks.push({
          type: RiskType.CEX_NO_DEPOSITE,
          value: t('page.confirmAddress.risks.dexNoDeposite'),
        });
      }
      if (Object.keys(addressDesc?.contract || {}).length) {
        currRisks.push({
          type: RiskType.CONTRACT_ADDRESS,
          value: t('page.confirmAddress.risks.contractAddress'),
        });
      }
      let hasSended = false;
      accounts.forEach(acc => {
        if (isSameAddress(acc.address, address)) {
          return;
        }
        queue.add(async () => {
          try {
            const res = await openapi.hasTransferAllChain(acc.address, address);
            // TODO: check res property
            if (res?.['_has_transfer'] || res?.['has_transfer']) {
              hasSended = true;
            }
          } catch (error) {
            console.error('_has_transfer fetch error', error);
          }
        });
      });
      await waitQueueFinished(queue);
      if (!hasSended) {
        setRisks([
          ...currRisks,
          {
            type: RiskType.NEVER_SEND,
            value: t('page.confirmAddress.risks.noSend'),
          },
        ]);
      }
      setLoading(false);
    })();
  }, [
    accounts,
    address,
    addressDesc,
    addressDesc?.cex,
    addressDesc?.contract,
    addressDesc?.is_danger,
    addressDesc?.is_scam,
    t,
  ]);
  return {
    risks,
    addressDesc,
    hasSend,
  };
};
