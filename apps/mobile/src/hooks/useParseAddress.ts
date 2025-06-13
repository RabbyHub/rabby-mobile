import { useState, useMemo } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { Chain } from '@/constant/chains';
import { isValidAddress } from 'ethereumjs-util';
import { AddressType } from '../utils/address';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { formatTxExplainAbiData } from '../utils/transaction';
import { apiProvider } from '@/core/apis';
import { openapi as mainnetOpenApi, testOpenapi } from '@/core/request';
import { Account } from '@/core/services/preference';

export function useCheckAddressType(
  addr: string,
  chain: Pick<Chain, 'serverId' | 'enum'> | null,
  account: Account,
) {
  const [addressType, setAddressType] = useState<AddressType>(
    AddressType.UNKNOWN,
  );

  useAsync(async () => {
    if (!chain || !addr || !isValidAddress(addr)) {
      setAddressType(AddressType.UNKNOWN);
      return;
    }

    try {
      const code = await apiProvider.requestETHRpc(
        {
          method: 'eth_getCode',
          params: [addr, 'latest'],
        },
        chain.serverId,
        account,
      );

      if (code === '0x' || code === '0x0') {
        setAddressType(AddressType.EOA);
      } else {
        setAddressType(AddressType.CONTRACT);
      }
    } catch (e) {
      setAddressType(AddressType.UNKNOWN);
    }
  }, [addr, chain?.serverId]);

  return {
    addressType,
  };
}

export function useParseContractAddress(
  input?: {
    contractAddress?: string;
    userAddress?: string | null;
    chain: Chain | null;
    inputDataHex?: string | null;
    account;
  } | null,
  opts?: {
    isTestnet?: boolean;
  },
) {
  const { contractAddress, userAddress, chain, inputDataHex, account } =
    input || {};

  const {
    value: explain,
    loading: isLoadingExplain,
    error: loadingExplainError,
  } = useAsync(async () => {
    if (
      !userAddress ||
      !contractAddress ||
      !chain?.network ||
      !inputDataHex ||
      !account
    ) {
      return null;
    }

    try {
      const nonce = await apiProvider.getRecommendNonce({
        from: userAddress,
        chainId: chain.id,
        account,
      });

      const openapi = opts?.isTestnet ? testOpenapi : mainnetOpenApi;

      const res = await openapi.preExecTx({
        tx: {
          chainId: Number(chain.id),
          from: userAddress,
          to: contractAddress,
          data: inputDataHex || '0x',
          // value: `0x${Number(inputDataHex).toString(16)}`,
          value: inputDataHex,
          nonce,
          gasPrice: '0x0',
          gas: '0x0',
        },
        origin: INTERNAL_REQUEST_ORIGIN,
        address: userAddress,
        updateNonce: false,
        pending_tx_list: [],
      });

      return res;
    } catch (error) {
      console.error(error);
      return null;
    }
  }, [chain, contractAddress, inputDataHex]);

  const contractCallPlainText = useMemo(() => {
    if (!explain?.abi?.func) return '';
    // if (loadingExplainError) return '';

    return formatTxExplainAbiData(explain.abi);
  }, [explain]);

  return {
    explain,
    isLoadingExplain,
    loadingExplainError,

    contractCallPlainText,
  };
}
