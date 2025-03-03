import { openapi } from '@/core/request';
import { AddrDescResponse } from '@rabby-wallet/rabby-api/dist/types';
import { useEffect, useLayoutEffect, useState } from 'react';

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
      if (addressDesc?.is_danger) {
        currRisks.push({
          type: RiskType.SCAM_ADDRESS,
          value: 'danger address',
        });
      }
      if (addressDesc?.cex && !addressDesc.cex.is_deposit) {
        currRisks.push({
          type: RiskType.CEX_NO_DEPOSITE,
          value: 'This is an Exchange address but not a depostite address',
        });
      }
      if (addressDesc?.contract) {
        currRisks.push({
          type: RiskType.CONTRACT_ADDRESS,
          value: 'This is a contract address',
        });
      }
      setRisks(currRisks);
      console.log('🔍 CUSTOM_LOGGER:=>: address', address);
      const hasSended = await false;
      if (!hasSended) {
        setRisks([
          ...currRisks,
          { type: RiskType.NEVER_SEND, value: 'you have not send' },
        ]);
      }
    })();
  }, [
    address,
    addressDesc?.cex,
    addressDesc?.contract,
    addressDesc?.is_danger,
  ]);
  return {
    risks,
    addressDesc,
  };
};
