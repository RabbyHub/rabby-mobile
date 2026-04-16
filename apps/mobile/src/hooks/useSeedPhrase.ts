import { useCallback, useMemo } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { keyringService } from '@/core/services';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { TypeKeyringGroup, useWalletTypeData } from './useWalletTypeData';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';
import { apiMnemonic } from '@/core/apis';
import { activeAndPersistAccountsByMnemonics } from '@/core/apis/mnemonic';
import { navigateDeprecated, replaceToFirst } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useTranslation } from 'react-i18next';
import { ellipsisAddress } from '@/utils/address';
import { contactService } from '@/core/services';

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
  const { t } = useTranslation();

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
        navigateDeprecated(RootNames.StackAddress, {
          screen: RootNames.ImportMoreAddress,
          params: {
            type: KEYRING_TYPE.HdKeyring,
            mnemonics: data.mnemonic!,
            passphrase: data.passphrase!,
            keyringId,
          },
        });
      }
    },
    [invokeEnterPassphrase],
  );

  const handleAddSeedPhraseAddress2024 = useCallback(
    async (publicKey: string, accounts: string[]) => {
      if (!publicKey) {
        return;
      }
      const data = await apiMnemonic.getMnemonicKeyring('publickey', publicKey);
      const mnemonics = data.mnemonic as string;
      const passphrase = data.passphrase || '';

      const MAX_ACCOUNT_COUNT = 50;
      const api = apiMnemonic.getKeyringByMnemonic(mnemonics, passphrase);
      let newAddress = '';
      let accountsToCreate: any[] = [];
      for (let i = 0; i < MAX_ACCOUNT_COUNT; i++) {
        const res = await api?.getAddresses(i, i + 1);
        const idx = accounts.findIndex(item => item === res?.[0].address);
        if (idx === -1 && res) {
          accountsToCreate = res;
          newAddress = res?.[0]?.address;
          break;
        }
      }

      if (!newAddress) {
        return;
      }

      contactService.setAlias({
        address: newAddress,
        alias: '',
      });
      await activeAndPersistAccountsByMnemonics(
        mnemonics,
        passphrase,
        accountsToCreate,
        false,
      );

      replaceToFirst(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess2024,
        params: {
          type: KEYRING_TYPE.HdKeyring,
          brandName: KEYRING_CLASS.MNEMONIC,
          isFirstCreate: true,
          address: [newAddress],
          mnemonics,
          passphrase,
          isExistedKR: false,
          alias: ellipsisAddress(newAddress),
        },
      });
    },
    [],
  );

  const seedPhraseList = useMemo(() => {
    if (accountGroup && value) {
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
        .sort((a, b) => {
          const getTotalValue = (item: typeof a) =>
            (item.list || []).reduce((pre, now) => {
              return pre + (now.balance || 0);
            }, 0);
          const aValue = getTotalValue(a);
          const bValue = getTotalValue(b);
          if (aValue === bValue) {
            return (b.list.length || 0) - (a.list.length || 0);
          }
          return bValue - aValue;
        })
        .map((e, index) => ({ ...e, index: index })) as TypeKeyringGroup[];
    }
    return [];
  }, [accountGroup, value]);

  return {
    seedPhraseList,
    handleAddSeedPhraseAddress,
    handleAddSeedPhraseAddress2024,
  };
};

export const useHadSeedPhrase = () => {
  const { value, loading } = useGetHdKeys();
  return !loading && !!value && value?.length > 0;
};
