import { openapi } from '@/core/request';
import {
  AddrDescResponse,
  ProjectItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PQueue from 'p-queue';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { getAddrDescWithCexLocalCacheSync } from '@/databases/hooks/cex';
import { getAccountList, sortAccountList } from '@/core/apis/account';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater } from '@/core/utils/store';
import { useMemoizedFn } from 'ahooks';

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

const reqForbiddenTip = async (forbiddenCheck: ForBiddenCheckParams) => {
  const allValuesSet =
    forbiddenCheck?.chain_id &&
    forbiddenCheck?.to_addr &&
    forbiddenCheck?.user_addr &&
    forbiddenCheck?.id;
  if (allValuesSet) {
    return await openapi
      .checkTokenDepositForbidden({
        chain_id: forbiddenCheck?.chain_id || 'eth',
        to_addr: forbiddenCheck?.to_addr || '',
        user_addr: forbiddenCheck?.user_addr || '',
        id: forbiddenCheck?.id || '',
      })
      .then(res => {
        return res?.msg || '';
      })
      .catch(error => {
        console.error('checkTokenDepositForbidden error', error);
        return null;
      });
  } else {
    return null;
  }
};

type ForBiddenCheckParams = {
  user_addr: string;
  id?: string;
  chain_id?: string;
  to_addr: string;
};

export const enum RiskType {
  NEVER_SEND = 1,
  SCAM_ADDRESS = 2,
  CONTRACT_ADDRESS = 3,
  CEX_NO_DEPOSIT = 4,

  FORBIDDEN_TIP = 5,
}
type RiskItem = { type: RiskType; value: string };
const addrRisks = zCreate<{
  [address: string]: {
    loading: boolean;
    addrDesc?:
      | Awaited<ReturnType<typeof getAddrDescWithCexLocalCacheSync>>
      | undefined;
    risks: RiskItem[];
  };
}>(() => ({}));

function setLoading(address: string, loading: boolean) {
  addrRisks.setState(prev => {
    if (prev[address]?.loading === loading) {
      return prev;
    }
    return {
      ...prev,
      [address]: {
        ...(prev[address] || { risks: [] }),
        loading,
      },
    };
  });
}

function setAddressDesc(
  address: string,
  addressDesc: AddrDescResponse['desc'],
) {
  addrRisks.setState(prev => {
    return {
      ...prev,
      [address]: {
        ...(prev[address] || { risks: [] }),
        loading: prev[address]?.loading || false,
        addressDesc,
      },
    };
  });
}

function setRisksForAddress(address: string, risks: RiskItem[]) {
  addrRisks.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev[address]?.risks || [],
      risks,
      {
        strict: true,
      },
    );
    if (!changed) return prev;

    return {
      ...prev,
      [address]: {
        ...(prev[address] || { loading: false }),
        risks: newVal,
      },
    };
  });
}
export const useRisks = (options: {
  toAddress: string;
  fromAddress?: string;
  forbiddenCheck?: ForBiddenCheckParams;
  cex?: ProjectItem | null;
  onLoadFinished?: (ctx: { risks: Array<RiskItem> }) => void;
}) => {
  const {
    fromAddress,
    toAddress,
    forbiddenCheck: input_forbiddenCheck,
    cex,
    onLoadFinished: prop_onLoadFinished,
  } = options;
  const { t } = useTranslation();
  const riskGetRef = useRef(false);

  const onLoadFinished = useMemoizedFn(prop_onLoadFinished || (() => {}));

  const defaultRisks = useMemo(() => [], []);
  const risks = addrRisks(s =>
    !toAddress ? defaultRisks : s[toAddress]?.risks || defaultRisks,
  );
  const loading = addrRisks(s =>
    !toAddress ? false : s[toAddress]?.loading || false,
  );
  const addressDesc = addrRisks(s =>
    !toAddress ? undefined : s[toAddress]?.addrDesc,
  );
  const hasSend = useMemo(() => {
    return !loading && !risks.some(r => r.type === RiskType.NEVER_SEND);
  }, [loading, risks]);

  const memoForbiddenCheck = useMemo(() => {
    return {
      chain_id: input_forbiddenCheck?.chain_id,
      id: input_forbiddenCheck?.id,
      user_addr: input_forbiddenCheck?.user_addr || '',
      to_addr: input_forbiddenCheck?.to_addr || '',
    };
  }, [
    input_forbiddenCheck?.chain_id,
    input_forbiddenCheck?.id,
    input_forbiddenCheck?.user_addr,
    input_forbiddenCheck?.to_addr,
  ]);

  // const forbiddenCheck = useDebouncedValue(memoForbiddenCheck, 300);
  const forbiddenCheck = memoForbiddenCheck;

  const fetchRisks = useCallback(async () => {
    if (!toAddress) return;
    const top10Addresses = (await getAccountList({ filter: 'onlyMine' }))
      .sortedAccounts;

    if (!top10Addresses.length) return;
    if (riskGetRef.current) return;
    riskGetRef.current = true;
    setLoading(toAddress, true);

    const curRisks: Array<RiskItem> = [];
    let addressSent = '';
    let hasError = false;

    try {
      const timeoutPromise = new Promise<void>((resolve, reject) => {
        // setTimeout(() => reject(new Error('timeout')), 5000);
        setTimeout(() => resolve(), 5000);
      });

      const addressDescPromise = getAddrDescWithCexLocalCacheSync(toAddress);

      function updateRisksAP() {
        setRisksForAddress(toAddress, curRisks);
      }

      const caredAddresses = fromAddress
        ? [fromAddress]
        : top10Addresses.map(acc => acc.address);

      const checkTransferPromise = Promise.race([
        new Promise<void>(resolve => {
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
        }),
        timeoutPromise,
      ]).then(() => {
        if (!addressSent) {
          curRisks.push({
            type: RiskType.NEVER_SEND,
            value: t('page.confirmAddress.risks.noSend'),
          });
          updateRisksAP();
        }
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
          setAddressDesc(toAddress, addressRes);
        }
        if (addressRes?.is_danger || addressRes?.is_scam) {
          curRisks.push({
            type: RiskType.SCAM_ADDRESS,
            value: t('page.confirmAddress.risks.scamAddress'),
          });
          updateRisksAP();
        }
        if (addressRes?.cex?.id && !addressRes.cex.is_deposit) {
          curRisks.push({
            type: RiskType.CEX_NO_DEPOSIT,
            value: t('page.confirmAddress.risks.cexNoDeposite'),
          });
          updateRisksAP();
        }
        const isContract = Object.keys(addressRes?.contract || {}).length > 0;
        const isSafeAddress = Object.keys(addressRes?.contract || {}).some(
          key => {
            const contract = addressRes?.contract?.[key];
            return !!contract?.multisig;
          },
        );
        if (isContract && !isSafeAddress) {
          curRisks.push({
            type: RiskType.CONTRACT_ADDRESS,
            value: t('page.confirmAddress.risks.contractAddress'),
          });
          updateRisksAP();
        }
      });

      const forbiddenTipPromise = reqForbiddenTip(forbiddenCheck).then(tip => {
        if (tip) {
          curRisks.push({
            type: RiskType.FORBIDDEN_TIP,
            value: tip,
          });
        }
      });

      await Promise.allSettled([
        addressDescPromise,
        checkTransferPromise,
        forbiddenTipPromise,
      ]);

      setRisksForAddress(toAddress, curRisks);
      onLoadFinished?.({ risks: [...curRisks] });
    } catch (error) {
      console.error('check risks timeout or error', error);
      queue.clear();
      setRisksForAddress(toAddress, curRisks);
      onLoadFinished?.({ risks: [...curRisks] });
    } finally {
      riskGetRef.current = false;
      setLoading(toAddress, false);
    }
  }, [fromAddress, toAddress, forbiddenCheck, cex, t, onLoadFinished]);

  useEffect(() => {
    fetchRisks();
  }, [fetchRisks]);

  return {
    risks,
    addressDesc,
    hasSend,
    loading: loading && risks.length === 0,
    fetchRisks,
  };
};

const riskTypePriority = {
  [RiskType.CEX_NO_DEPOSIT]: 10e-1,
  [RiskType.NEVER_SEND]: 10,
  [RiskType.CONTRACT_ADDRESS]: 10e1,
  [RiskType.SCAM_ADDRESS]: 10e3,
  [RiskType.FORBIDDEN_TIP]: 10e4,
};

export function sortRisksDesc(a: { type: RiskType }, b: { type: RiskType }) {
  return (
    riskTypePriority[b.type as keyof typeof riskTypePriority] -
    riskTypePriority[a.type as keyof typeof riskTypePriority]
  );
}
