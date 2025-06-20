import React, { useCallback, useEffect } from 'react';
import { Linking, View } from 'react-native';
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
import { apiKeystone, apiTrezor } from '@/core/apis';
import { matomoRequestEvent } from '@/utils/analytics';
import { trigger } from 'react-native-haptic-feedback';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { keyringService, preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import { useFocusEffect } from '@react-navigation/native';
import TrezorConnect, {
  BLOCKCHAIN_EVENT,
  DEVICE_EVENT,
  TRANSPORT_EVENT,
} from '@trezor/connect-mobile';
import { toast } from '@/components2024/Toast';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useAtom } from 'jotai';
import { settingAtom } from '@/components/HDSetting/MainContainer';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { useShowImportMoreAddressPopup } from '@/hooks/useShowImportMoreAddressPopup';

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
  const [hasAccounts, setHasAccounts] = React.useState(false);

  const initAccounts = useCallback(async () => {
    try {
      const accounts = await keyringService.getAllVisibleAccountsArray();
      setHasAccounts(!!accounts.length);
    } catch (err) {
      console.error(err);
    }
  }, [setHasAccounts]);

  useFocusEffect(
    useCallback(() => {
      initAccounts();
    }, [initAccounts]),
  );

  const handleLedger = React.useCallback(() => {
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
    !hasAccounts &&
      preferenceService.setReportActionTs(
        REPORT_TIMEOUT_ACTION_KEY.CLICK_LEDGER_CONNECT,
      );
  }, [hasAccounts]);

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

  const [_2, setSetting] = useAtom(settingAtom);
  const { showImportMorePopup } = useShowImportMoreAddressPopup();

  const importFirstAddress = React.useCallback(async () => {
    const address = await apiTrezor.importFirstAddress({});

    if (address) {
      navigate(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess2024,
        params: {
          type: KEYRING_TYPE.TrezorKeyring,
          brandName: KEYRING_CLASS.HARDWARE.TREZOR,
          address,
          isFirstImport: true,
        },
      });
      // onDone?.();
    } else {
      setSetting({
        startNumber: 1,
        hdPath: LedgerHDPathType.BIP44,
      });
      // navigate(RootNames.StackAddress, {
      //   screen: RootNames.ImportMoreAddress,
      //   params: {
      //     type: KEYRING_TYPE.OneKeyKeyring,
      //   },
      // });
      showImportMorePopup({
        type: KEYRING_TYPE.TrezorKeyring,
        brand: KEYRING_CLASS.HARDWARE.TREZOR,
      });
      // onDone?.();
    }
  }, [setSetting, showImportMorePopup]);

  const handleTrezor = React.useCallback(async () => {
    // const result = await TrezorConnect.ethereumGetAddress({
    //   bundle: Array.from({ length: 50 }).map((_, idx) => ({
    //     path: `m/44'/60'/${idx}'/0/0`,
    //     showOnTrezor: false,
    //   })),
    // });

    console.log('test 123');

    try {
      importFirstAddress();
    } catch (error) {
      console.log('error', error);
    }
  }, [importFirstAddress]);

  // useEffect(() => {
  //   TrezorConnect.on(DEVICE_EVENT, event => {
  //     toast.info(`TrezorConnect event: ${JSON.stringify(event)}`);
  //     console.debug('TrezorConnect event', event);
  //   });

  //   TrezorConnect.on(BLOCKCHAIN_EVENT, event => {
  //     toast.info(`TrezorConnect BLOCKCHAIN_EVENT: ${JSON.stringify(event)}`);
  //     console.debug('TrezorConnect BLOCKCHAIN_EVENT', event);
  //   });

  //   TrezorConnect.on(TRANSPORT_EVENT, event => {
  //     toast.info(`TrezorConnect TRANSPORT_EVENT: ${JSON.stringify(event)}`);
  //     console.debug('TrezorConnect TRANSPORT_EVENT', event);
  //   });
  // }, []);

  return (
    <NormalScreenContainer2024>
      <View style={styles.root}>
        <Card style={styles.card}>
          <ListItem
            style={styles.item}
            Icon={
              <WalletIcon type={KEYRING_TYPE.LedgerKeyring} borderRadius={20} />
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
              <WalletIcon type={KEYRING_TYPE.OneKeyKeyring} borderRadius={20} />
            }
            title="OneKey"
            onPress={handleOneKey}
          />
          <ListItem
            style={styles.item}
            Icon={
              <WalletIcon type={KEYRING_TYPE.TrezorKeyring} borderRadius={20} />
            }
            title="Trezor"
            onPress={handleTrezor}
          />
        </Card>
      </View>
    </NormalScreenContainer2024>
  );
}
