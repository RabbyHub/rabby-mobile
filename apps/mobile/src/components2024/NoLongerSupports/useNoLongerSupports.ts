import { KeyringAccountWithAlias, storeApiAccounts } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '../GlobalBottomSheetModal';
import { MODAL_ID, MODAL_NAMES } from '../GlobalBottomSheetModal/types';
import { apisAccount } from '@/core/apis';
import { redirectToAddAddressEntry } from '@/utils/navigation';
import { RefLikeObject } from '@/utils/type';
import { keyringService } from '@/core/services';

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
  keyringService.once('unlock', async () => {
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
  });
};
