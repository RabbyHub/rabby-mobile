import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React from 'react';
import { View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '@/components2024/Card';
import { ListItem } from '@/components2024/ListItem/ListItem';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import {
  KEYRING_CATEGORY,
  KEYRING_CLASS,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';
import { useImportKeystone } from '@/components/ConnectKeystone/useImportKeystone';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { apiKeystone } from '@/core/apis';
import { matomoRequestEvent } from '@/utils/analytics';
import { trigger } from 'react-native-haptic-feedback';
import LinearGradient from 'react-native-linear-gradient';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  root: {
    paddingHorizontal: 24,
    marginTop: 34,
  },
  card: {
    alignItems: 'stretch',
    padding: 0,
    paddingVertical: 12,
  },
  item: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
}));

export function ImportHardwareAddressScreen(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const handleLedger = React.useCallback(() => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.CONNECT_LEDGER,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
      },
      onDone: () => {
        setTimeout(() => {
          removeGlobalBottomSheetModal2024(id);
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
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
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

    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.CONNECT_KEYSTONE,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
      },
      onDone: () => {
        setTimeout(() => {
          removeGlobalBottomSheetModal2024(id);
        }, 0);
      },
    });
  }, [goImport]);

  const handleOneKey = React.useCallback(() => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.CONNECT_ONEKEY,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
      },
      onDone: () => {
        setTimeout(() => {
          removeGlobalBottomSheetModal2024(id);
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
    <NormalScreenContainer overwriteStyle={styles.container}>
      <LinearGradient
        colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
        style={{
          width: '100%',
          height: '100%',
        }}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}>
        <View style={styles.root}>
          <Card style={styles.card}>
            <ListItem
              style={styles.item}
              Icon={
                <WalletIcon
                  type={KEYRING_TYPE.LedgerKeyring}
                  borderRadius={20}
                />
              }
              title="Ledger"
              onPress={handleLedger}
            />
            <ListItem
              style={styles.item}
              Icon={
                <WalletIcon
                  type={KEYRING_TYPE.KeystoneKeyring}
                  borderRadius={20}
                />
              }
              title="Keystone"
              onPress={handleKeystone}
            />
            <ListItem
              style={styles.item}
              Icon={
                <WalletIcon
                  type={KEYRING_TYPE.OneKeyKeyring}
                  borderRadius={20}
                />
              }
              title="OneKey"
              onPress={handleOneKey}
            />
          </Card>
        </View>
      </LinearGradient>
    </NormalScreenContainer>
  );
}
