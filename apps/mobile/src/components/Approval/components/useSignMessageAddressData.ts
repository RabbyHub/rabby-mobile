import { useEffect, useMemo, useRef, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

import { apiContact, apiKeyring, apisAddress } from '@/core/apis';
import { whitelistServiceApi } from '@/core/serviceApi/whitelist';
import { openapi, testOpenapi } from '@/core/request';
import type { Chain } from '@/constant/chains';
import { sortAccountByPriority } from '@/utils/account';
import type { SignMessageHighlightToken } from './signMessageTokenizer';
import {
  getSignMessageAddressDataRequestKey,
  resolveSignMessageAddressData,
  type SignMessageAddressDataMap,
  type SignMessageAddressDataProvider,
} from './signMessageAddressData';

const EMPTY_ADDRESS_DATA: SignMessageAddressDataMap = {};

type AddressDataRequest = {
  key: string | null;
  data: SignMessageAddressDataMap;
};

export const useSignMessageAddressData = ({
  tokens,
  chain,
  accountAddress,
}: {
  tokens: SignMessageHighlightToken[];
  chain?: Chain;
  accountAddress: string;
}) => {
  const provider = useMemo<SignMessageAddressDataProvider>(() => {
    const apiProvider = chain?.isTestnet ? testOpenapi : openapi;
    return {
      getAlias: async address =>
        apiContact.getAliasName(address, { keepEmptyIfNotFound: true }),
      getWhitelist: async () => whitelistServiceApi.getWhitelist(),
      getAccountsByPriority: async () =>
        (await apisAddress.getAllAccounts()).sort(sortAccountByPriority),
      getAddressSource: async address => {
        const keyringType = await apiKeyring.hasPrivateKeyInWallet(address);
        if (keyringType === KEYRING_TYPE.SimpleKeyring) return 'private-key';
        if (keyringType === KEYRING_TYPE.HdKeyring) return 'seed-phrase';
        return null;
      },
      getAddressDesc: async address =>
        (await apiProvider.addrDesc(address)).desc,
      getContractInfo: (address, chainServerId) =>
        apiProvider.getContractInfo(address, chainServerId),
      hasInteraction: async (account, chainServerId, address) =>
        (await apiProvider.hasInteraction(account, chainServerId, address))
          .has_interaction,
      hasTransfer: async (chainServerId, account, address) =>
        (await apiProvider.hasTransfer(chainServerId, account, address))
          .has_transfer,
      getToken: (account, chainServerId, address) =>
        apiProvider.getToken(account, chainServerId, address),
    };
  }, [chain?.isTestnet]);
  const requestKey = useMemo(
    () =>
      getSignMessageAddressDataRequestKey(
        tokens,
        chain?.serverId,
        accountAddress,
      ),
    [accountAddress, chain?.serverId, tokens],
  );
  const [request, setRequest] = useState<AddressDataRequest>({
    key: null,
    data: EMPTY_ADDRESS_DATA,
  });
  const requestKeyRef = useRef(requestKey);
  requestKeyRef.current = requestKey;

  useEffect(() => {
    setRequest({ key: requestKey, data: EMPTY_ADDRESS_DATA });
  }, [provider, requestKey]);

  useAsync(async () => {
    if (!chain || !requestKey) {
      return;
    }

    await resolveSignMessageAddressData({
      tokens,
      chain,
      accountAddress,
      provider,
      onAddressResolved: (key, data) => {
        setRequest(current =>
          requestKeyRef.current !== requestKey
            ? current
            : {
                key: requestKey,
                data: {
                  ...(current.key === requestKey
                    ? current.data
                    : EMPTY_ADDRESS_DATA),
                  [key]: data,
                },
              },
        );
      },
    });
  }, [provider, requestKey]);

  return request.key === requestKey ? request.data : EMPTY_ADDRESS_DATA;
};
