import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WalletHeadline } from './WalletHeadline';
import { WalletItem } from './WalletItem';
import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import OneKeySVG from '@/assets/icons/wallet/onekey.svg';
import KeystoneSVG from '@/assets/icons/wallet/keystone.svg';
import { HardwareSVG } from '@/assets/icons/address';
import { toast } from '@/components/Toast';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import { matomoRequestEvent } from '@/utils/analytics';
import { KEYRING_CATEGORY, KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { apiKeystone } from '@/core/apis';
import { useImportKeystone } from '@/components/ConnectKeystone/useImportKeystone';

const styles = StyleSheet.create({
  walletItem: {
    marginBottom: 8,
  },
  walletItemDisabled: {
    opacity: 0.6,
  },
});

export const HardwareDeviceList = () => {
  const handleLedger = React.useCallback(() => {
    const id = createGlobalBottomSheetModal({
      name: MODAL_NAMES.CONNECT_LEDGER,
      onDone: () => {
        setTimeout(() => {
          removeGlobalBottomSheetModal(id);
        }, 0);
      },
    });
    matomoRequestEvent({
      category: 'Import Address',
      action: `Begin_Import_${KEYRING_CATEGORY.Hardware}`,
      label: KEYRING_CLASS.HARDWARE.LEDGER,
    });
  }, []);

  const goImport = useImportKeystone();

  const handleKeystone = React.useCallback(async () => {
    matomoRequestEvent({
      category: 'Import Address',
      action: `Begin_Import_${KEYRING_CATEGORY.Hardware}`,
      label: KEYRING_CLASS.HARDWARE.KEYSTONE,
    });

    const isReady = await apiKeystone.isReady();
    if (isReady) {
      goImport();
      return;
    }

    const id = createGlobalBottomSheetModal({
      name: MODAL_NAMES.CONNECT_KEYSTONE,
      onDone: () => {
        setTimeout(() => {
          removeGlobalBottomSheetModal(id);
        }, 0);
      },
    });
  }, [goImport]);

  const handleOneKey = React.useCallback(() => {
    const id = createGlobalBottomSheetModal({
      name: MODAL_NAMES.CONNECT_ONEKEY,
      onDone: () => {
        setTimeout(() => {
          removeGlobalBottomSheetModal(id);
        }, 0);
      },
    });
    matomoRequestEvent({
      category: 'Import Address',
      action: `Begin_Import_${KEYRING_CATEGORY.Hardware}`,
      label: KEYRING_CLASS.HARDWARE.ONEKEY,
    });
  }, []);

  return (
    <View>
      <WalletHeadline Icon={HardwareSVG}>Hardware Wallets</WalletHeadline>
      <WalletItem
        style={styles.walletItem}
        Icon={LedgerSVG}
        title="Ledger"
        onPress={handleLedger}
      />
      <WalletItem
        style={StyleSheet.flatten([styles.walletItem])}
        Icon={KeystoneSVG}
        title="Keystone"
        onPress={handleKeystone}
      />
      <WalletItem
        style={StyleSheet.flatten([styles.walletItem])}
        Icon={OneKeySVG}
        title="OneKey"
        onPress={handleOneKey}
      />
    </View>
  );
};
