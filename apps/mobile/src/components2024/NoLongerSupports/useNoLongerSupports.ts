import { useAccounts, useRemoveAccount } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import React from 'react';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '../GlobalBottomSheetModal';
import { MODAL_ID, MODAL_NAMES } from '../GlobalBottomSheetModal/types';
import { apisAccount } from '@/core/apis';
import { redirectToAddAddressEntry } from '@/utils/navigation';

export const useNoLongerSupports = () => {
  const { accounts } = useAccounts({
    disableAutoFetch: false,
  });
  const modalIdRef = React.useRef<MODAL_ID>();
  const removeAccount = useRemoveAccount();

  const removeWalletConnect = React.useCallback(async () => {
    await Promise.allSettled([
      ...accounts.map(async account => {
        if (account.type === KEYRING_TYPE.WalletConnectKeyring) {
          await removeAccount(account);
        }
      }),
    ]);

    const hasRestAccounts = await apisAccount.hasVisibleAccounts();
    if (!hasRestAccounts) {
      redirectToAddAddressEntry({ action: 'resetTo' });
    }
  }, [accounts, removeAccount]);

  React.useEffect(() => {
    setTimeout(() => {
      if (modalIdRef.current) {
        return;
      }

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
            removeWalletConnect();
          },
        },
        onDone() {
          removeWalletConnect();
          removeGlobalBottomSheetModal2024(modalIdRef.current);
        },
      });
    }, 100);
  }, [accounts, removeWalletConnect]);
};
