import { useCallback, useMemo } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { hdKeyringService, keyringService } from '@/core/services';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { TypeKeyringGroup, useWalletTypeData } from './useWalletTypeData';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';
import { apiMnemonic } from '@/core/apis';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';

const useGetHdKeys = () => {
  return useAsync(async () => {
    const allClassAccounts = await keyringService.getAllTypedAccounts();
    return allClassAccounts.filter(
      item => item.type === KEYRING_TYPE.HdKeyring,
    );
  });
};

export const useSeedPhrase = () => {
  const { accountGroup } = useWalletTypeData();
  const { value } = useGetHdKeys();

  const invokeEnterPassphrase = useEnterPassphraseModal('publickey');

  const handleAddSeedPhraseAddress = useCallback(
    async (publicKey: string) => {
      if (publicKey) {
        await invokeEnterPassphrase(publicKey);
        const keyringId =
          apiMnemonic.getMnemonicKeyRingIdFromPublicKey(publicKey);
        const data = await apiMnemonic.getMnemonicKeyring(
          'publickey',
          publicKey,
        );

        navigate(RootNames.ImportMoreAddress, {
          type: KEYRING_TYPE.HdKeyring,
          mnemonics: data.mnemonic!,
          passphrase: data.passphrase!,
          keyringId,
        });
      }
    },
    [invokeEnterPassphrase],
  );

  const seedPhraseList = useMemo(() => {
    const timeStores = hdKeyringService.getStore();
    if (accountGroup && value && timeStores) {
      const publicKeys = value.map(e => e.publicKey!);
      const pbMappings = Object.values(accountGroup[0]).reduce((pre, cur) => {
        if (cur.type === KEYRING_TYPE.HdKeyring) {
          pre[cur.publicKey || ''] = cur;
        }
        return pre;
      }, {} as Record<string, TypeKeyringGroup>);

      return publicKeys
        .map(e => pbMappings[e])
        .filter(e => !!e)
        .map((e, index) => ({ ...e, index: index }))
        .sort((a, b) => {
          const aTime = timeStores?.[a.publicKey!] || 0;
          const bTime = timeStores?.[b.publicKey!] || 0;

          return bTime - aTime;
        }) as TypeKeyringGroup[];
    }
    return [];
  }, [accountGroup, value]);

  return {
    seedPhraseList,
    handleAddSeedPhraseAddress,
  };
};

export const useHadSeedPhrase = () => {
  const { value, loading } = useGetHdKeys();
  return !loading && !!value && value?.length > 0;
};
