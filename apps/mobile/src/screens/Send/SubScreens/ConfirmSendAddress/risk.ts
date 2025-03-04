import { openapi } from '@/core/request';
import { AddrDescResponse } from '@rabby-wallet/rabby-api/dist/types';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

  const [addressDesc, setAddressDesc] = useState<
    AddrDescResponse['desc'] | undefined
  >();
  useLayoutEffect(() => {
    openapi.addrDesc(address).then(res => {
      if (res.desc) {
        setAddressDesc(res.desc);
      }
    });
  }, [address]);
  useEffect(() => {
    (async () => {
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
      setRisks(currRisks);
      const hasSended = await false;
      if (!hasSended) {
        setRisks([
          ...currRisks,
          {
            type: RiskType.NEVER_SEND,
            value: t('page.confirmAddress.risks.noSend'),
          },
        ]);
      }
    })();
  }, [
    address,
    addressDesc?.cex,
    addressDesc?.contract,
    addressDesc?.is_danger,
    addressDesc?.is_scam,
    t,
  ]);
  return {
    risks,
    addressDesc,
  };
};
