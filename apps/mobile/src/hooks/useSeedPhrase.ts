import { useCallback, useEffect, useMemo, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import {
  bindKeyringMemStore,
  getKeyringMemStoreStateSnapshot,
  keyringServiceApi,
} from '@/core/serviceApi/keyring';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { isEqual } from 'lodash';
import { useAccounts, usePinAddresses } from './account';
import {
  buildSeedPhraseGroups,
  selectPublicHdKeyrings,
} from './seedPhraseGroups';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';
import { apiMnemonic } from '@/core/apis';
import { activeAndPersistAccountsByMnemonics } from '@/core/apis/mnemonic';
import { navigateDeprecated, replaceToFirst } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useTranslation } from 'react-i18next';
import { ellipsisAddress } from '@/utils/address';
import { contactServiceApi } from '@/core/serviceApi/contact';
import { ensureWalletUnlockedForAction } from '@/utils/walletUnlock';
import * as SecretVault from '@/core/utils/secretVault';

const useGetHdKeys = () => {
  return useAsync(async () => {
    const allClassAccounts = await keyringServiceApi.getAllTypedAccounts();
    return allClassAccounts.filter(
      item => item.type === KEYRING_TYPE.HdKeyring,
    );
  });
};

export const useSeedPhrase = () => {
  const { accounts: visibleAccounts } = useAccounts({ disableAutoFetch: true });
  const { pinAddresses } = usePinAddresses({ disableAutoFetch: true });
  const [hdKeyrings, setHdKeyrings] = useState(() =>
    selectPublicHdKeyrings(getKeyringMemStoreStateSnapshot()),
  );
  const { t } = useTranslation();

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    bindKeyringMemStore(snapshot => {
      if (!disposed) {
        const next = selectPublicHdKeyrings(snapshot);
        setHdKeyrings(previous => (isEqual(previous, next) ? previous : next));
      }
    })
      .then(cleanup => {
        if (disposed) {
          cleanup();
        } else {
          unsubscribe = cleanup;
        }
      })
      .catch(console.error);
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);

  const invokeEnterPassphrase = useEnterPassphraseModal('publickey');

  const handleAddSeedPhraseAddress = useCallback(
    async (publicKey: string) => {
      if (publicKey) {
        if (!(await ensureWalletUnlockedForAction())) {
          return;
        }

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
            mnemonicsVaultId: SecretVault.storeMnemonicsPayload({
              mnemonics: data.mnemonic!,
              passphrase: data.passphrase || '',
            }),
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
      if (!(await ensureWalletUnlockedForAction())) {
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

      await contactServiceApi.setAlias({
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
          mnemonicsVaultId: SecretVault.storeMnemonicsPayload({
            mnemonics,
            passphrase,
          }),
          isExistedKR: false,
          alias: ellipsisAddress(newAddress),
        },
      });
    },
    [],
  );

  const seedPhraseList = useMemo(
    () =>
      buildSeedPhraseGroups(
        hdKeyrings,
        visibleAccounts,
        pinAddresses,
        t('page.manageAddress.seed-phrase'),
      ),
    [hdKeyrings, visibleAccounts, pinAddresses, t],
  );

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
