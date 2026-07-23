import type { KeyringAccountWithAlias } from '@/hooks/account';
import { storeApiAccounts } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '../GlobalBottomSheetModal';
import type { MODAL_ID } from '../GlobalBottomSheetModal/types';
import { MODAL_NAMES } from '../GlobalBottomSheetModal/types';
import { apisAccount } from '@/core/apis';
import { redirectToAddAddressEntry } from '@/utils/navigation';
import type { RefLikeObject } from '@/utils/type';
import { bindKeyringEventOnce } from '@/core/serviceApi/keyring';

const modalIdRef: RefLikeObject<MODAL_ID | null> = { current: null };

const removeWalletConnect = async (accounts: KeyringAccountWithAlias[]) => {
  await Promise.allSettled([
    ...accounts.map(async account => {
      if (account.type === KEYRING_TYPE.WalletConnectKeyring) {
        await storeApiAccounts.removeAccount(account);
      }
    }),
  ]);

  const hasRestAccounts = await apisAccount.hasVisibleAccounts();
  if (!hasRestAccounts) {
    redirectToAddAddressEntry({ action: 'resetTo' });
  }
};

export const trimNoLongerSupportsOnUnlock = () => {
  void bindKeyringEventOnce('unlock', async () => {
    if (modalIdRef.current) return;

    const accounts = await storeApiAccounts.fetchAccounts();

    if (
      !accounts?.some(
        account => account.type === KEYRING_TYPE.WalletConnectKeyring,
      )
    ) {
      return;
    }

    modalIdRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.NO_LONGER_SUPPORTS,
      bottomSheetModalProps: {
        onDismiss: () => {
          removeWalletConnect(accounts);
        },
      },
      onDone() {
        removeWalletConnect(accounts);
        removeGlobalBottomSheetModal2024(modalIdRef.current);
      },
    });
  }).catch(console.error);
};
