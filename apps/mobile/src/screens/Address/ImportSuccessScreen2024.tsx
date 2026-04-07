import { Text } from '@/components';
import { contactService, preferenceService } from '@/core/services';
import { useTheme2024 } from '@/hooks/theme';
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccounts } from '@/hooks/account';
import { addressUtils } from '@rabby-wallet/base-utils';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { matomoRequestEvent } from '@/utils/analytics';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKRCategoryByType } from '@/utils/transaction';
import { Button } from '@/components2024/Button';
import { ellipsisAddress } from '@/utils/address';
import { createGetStyles2024 } from '@/utils/styles';
import { GnosisSupportChainList } from './ImportSafeAddressScreen2024';
import RcIconRightCC from '@/assets/icons/common/right-2-cc.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import useBalanceStore from '@/store/balance';
import { syncMultiAddressesHistory } from '@/databases/hooks/history';
import { toast } from '@/components2024/Toast';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import useTokenList from '@/store/tokens';
import usePortfolioList from '@/store/protocols';
import { eventBus } from '@/utils/events';
import { apisHomeTabIndex, resetNavigationTo } from '@/hooks/navigation';
import { apisSingleHome } from '../Home/hooks/singleHome';
import { isNonPublicProductionEnv } from '@/constant';
import { useMount } from 'ahooks';
import {
  accountEvents,
  PerfAccountEventBusListeners,
} from '@/core/apis/account';
import {
  WalletSuccessCard,
  AddressItem,
} from '@/components2024/WalletSuccessCard';

type ImportSuccessScreenProps = NativeStackScreenProps<RootStackParamsList>;

export const ImportSuccessScreen2024 = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { top, bottom } = useSafeAreaInsets();
  const { accounts, fetchAccounts } = useAccounts({ disableAutoFetch: true });
  const navigation = useNavigation<ImportSuccessScreenProps['navigation']>();
  const modalRef =
    useRef<ReturnType<typeof createGlobalBottomSheetModal2024>>(undefined);
  const { t } = useTranslation();

  const route =
    useRoute<
      GetNestedScreenRouteProp<'AddressNavigatorParamList', 'ImportSuccess2024'>
    >();
  const state = route.params;

  if (!state) {
    throw new Error('[ImportSuccess2024] route.params is undefined');
  }

  useMount(() => {
    const addressList = (
      Array.isArray(state.address) ? state.address : [state.address]
    ).filter(Boolean);

    if (addressList.length === 0) {
      return;
    }
    const record = (
      scene: Parameters<
        PerfAccountEventBusListeners['ACCOUNT_ADDED']
      >[0]['scene'] &
        string,
    ) => {
      accountEvents.emit('ACCOUNT_ADDED', {
        accounts: addressList.map(address => ({
          address,
          brandName: state.brandName,
          type: state.type,
        })),
        scene: scene,
      });
    };

    switch (state.type) {
      case KEYRING_TYPE.HdKeyring: {
        record('memonics');
        break;
      }
      case KEYRING_TYPE.SimpleKeyring: {
        record('privateKey');
        break;
      }
      case KEYRING_TYPE.LedgerKeyring:
      case KEYRING_TYPE.KeystoneKeyring:
      case KEYRING_TYPE.OneKeyKeyring:
      case KEYRING_TYPE.TrezorKeyring: {
        record('hardware');
        break;
      }
      case KEYRING_TYPE.GnosisKeyring:
      case KEYRING_TYPE.WatchAddressKeyring:
      default:
        if (isNonPublicProductionEnv) {
          console.warn(
            `[ImportSuccessScreen2024] Non recored newly added keyring type: ${state.type}`,
          );
        }
    }
  });

  const [importAddresses, setImportAddresses] = React.useState<
    {
      address: string;
      aliasName: string;
    }[]
  >([]);

  const saveFirstAddressAlias = React.useCallback(() => {
    importAddresses.forEach(item => {
      contactService.setAlias({
        address: item.address,
        alias: item.aliasName || ellipsisAddress(item.address), // for empty inputText
      });
    });
  }, [importAddresses]);

  const onlyFirstAccount = useMemo(() => {
    return importAddresses.length === 1
      ? {
          ...importAddresses[0]!,
          brandName: state?.brandName,
          type: state?.type,
        }
      : null;
  }, [importAddresses, state?.brandName, state?.type]);
  const handleDone = React.useCallback(() => {
    saveFirstAddressAlias();
    Keyboard.dismiss();

    preferenceService.setReportActionTs(
      REPORT_TIMEOUT_ACTION_KEY.ADD_NEW_ADDRESS_DONE,
    );

    if (onlyFirstAccount) {
      apisSingleHome.navigateToSingleHome(onlyFirstAccount, { replace: true });
    } else {
      resetNavigationTo(navigation, 'Home');
    }
    apisHomeTabIndex.setTabIndex(0);
  }, [onlyFirstAccount, navigation, saveFirstAddressAlias]);

  const isFocus = useIsFocused();

  React.useEffect(() => {
    const addresses = Array.isArray(state?.address)
      ? state?.address
      : [state?.address];
    toast.success(
      `${t('page.importSuccess.addressCount', { count: addresses.length })} ${t(
        'page.importSuccess.success',
        {
          type: state?.isFirstCreate ? 'Created' : 'Imported',
        },
      )}`,
      {
        delay: 500,
        duration: 3000,
      },
    );

    setImportAddresses(
      addresses.map(address => ({
        address,
        aliasName:
          state?.alias ||
          contactService.getAliasByAddress(address)?.alias ||
          ellipsisAddress(address || '') ||
          '',
      })),
    );

    matomoRequestEvent({
      category: 'Import Address',
      action: `Success_Import_${getKRCategoryByType(state?.type)}`,
      label: state?.brandName,
    });

    useBalanceStore.getState().batchGetTotalBalance(addresses, true);
    if (
      state.type !== KEYRING_TYPE.WatchAddressKeyring &&
      state.type !== KEYRING_TYPE.GnosisKeyring
    ) {
      const syncAddresses =
        addresses.length > 10 ? addresses.slice(0, 10) : addresses;
      syncAddresses.forEach(address => {
        useTokenList.getState().getTokenList(address);
        usePortfolioList.getState().getProtocols(address);
      });
      syncMultiAddressesHistory(syncAddresses);
      eventBus.emit('PERPS_ADD_ADDRESSES', syncAddresses);
    }
  }, [state, t]);
  React.useEffect(() => {
    setTimeout(() => fetchAccounts(), 0);
  }, [fetchAccounts]);

  React.useEffect(() => {
    if (!importAddresses.length) {
      return;
    }
    const lastAddress = importAddresses[importAddresses.length - 1]!.address;
    if (isFocus) {
      const targetAccount = accounts.find(
        a =>
          a.brandName === state?.brandName &&
          addressUtils.isSameAddress(a.address, lastAddress),
      );
      const currentAccount = preferenceService.getFallbackAccount();
      if (targetAccount) {
        if (
          !currentAccount ||
          targetAccount.brandName !== currentAccount.brandName ||
          !addressUtils.isSameAddress(currentAccount.address, lastAddress)
        ) {
          preferenceService.setCurrentAccount(targetAccount);
        }
      }
    }
  }, [isFocus, state, accounts, importAddresses]);

  const handleImportMore = async () => {
    Keyboard.dismiss();
    if (modalRef.current) {
      return;
    }

    saveFirstAddressAlias();

    const params = {
      type: state.type,
      mnemonics: state.mnemonics,
      passphrase: state.passphrase,
      keyringId: state.keyringId,
      brandName: state.brandName,
    };

    const firstAddr = importAddresses[0]?.address;
    if (params.type === KEYRING_TYPE.HdKeyring && firstAddr) {
      if (!params.mnemonics) {
        throw new Error(
          '[ImportSuccessScreen2024] mnemonics is required for HdKeyring',
        );
      }
    }

    modalRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.IMPORT_MORE_ADDRESS,
      params: params,
      bottomSheetModalProps: {
        onDismiss: () => {
          modalRef.current = undefined;
        },
      },
      onCancel: () => {
        if (modalRef.current) {
          removeGlobalBottomSheetModal2024(modalRef.current);
        }
      },
    });
  };

  const addressItems: AddressItem[] = useMemo(
    () =>
      importAddresses.map(item => ({
        address: item.address,
        brandName: state?.type || '',
        showBalance: true,
      })),
    [importAddresses, state?.type],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardAvoidingView}>
      <View style={[styles.container, { paddingTop: top }]}>
        <WalletSuccessCard
          style={{ flex: 1 }}
          title={
            onlyFirstAccount
              ? t('page.importSuccess.titleSingle')
              : t('page.importSuccess.titleMultiple', {
                  count: importAddresses.length,
                })
          }
          addresses={addressItems}
        />
      </View>

      <View style={[styles.footer, { paddingBottom: bottom + 20 }]}>
        {state?.supportChainList?.length ? (
          <GnosisSupportChainList
            data={state.supportChainList}
            style={styles.supportChainList}
          />
        ) : null}

        {state.mnemonics &&
          (state.isFirstImport ||
            state.brandName === KEYRING_TYPE.HdKeyring) && (
            <TouchableOpacity
              onPress={handleImportMore}
              style={styles.ledgerButton}>
              <Text style={styles.ledgerButtonText}>
                {t('page.importSuccess.importMore')}
              </Text>
              <RcIconRightCC
                width={16}
                height={16}
                color={colors2024['neutral-secondary']}
              />
            </TouchableOpacity>
          )}

        <Button
          containerStyle={styles.btnContainer}
          type="primary"
          title={
            onlyFirstAccount
              ? t('page.importSuccess.viewAddress')
              : t('global.Done')
          }
          onPress={handleDone}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-1'],
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  supportChainList: {
    marginBottom: 12,
  },
  ledgerButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  ledgerButtonText: {
    color: colors2024['neutral-secondary'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  btnContainer: {
    width: '100%',
  },
}));
