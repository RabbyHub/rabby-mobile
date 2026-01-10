import { Text } from '@/components';
import { RootNames } from '@/constant/layout';
import { contactService, preferenceService } from '@/core/services';
import { useTheme2024 } from '@/hooks/theme';
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { Skeleton } from '@rneui/themed';

import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { Card } from '@/components2024/Card';
import { useAccounts } from '@/hooks/account';
import { addressUtils } from '@rabby-wallet/base-utils';
import { RootStackParamsList } from '@/navigation-type';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { matomoRequestEvent } from '@/utils/analytics';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { getKRCategoryByType } from '@/utils/transaction';
import { Button } from '@/components2024/Button';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { ellipsisAddress } from '@/utils/address';
import { createGetStyles2024 } from '@/utils/styles';
import { GnosisSupportChainList } from './ImportSafeAddressScreen2024';
import Lottie from 'lottie-react-native';
import AnimationImportSuccess from '@/assets2024/animations/animation-import-success.json';
import RcIconRightCC from '@/assets2024/icons/common/right-2.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { apiBalance, apiMnemonic } from '@/core/apis';
import { syncMultiAddressesHistory } from '@/databases/hooks/history';
import { toast } from '@/components2024/Toast';
import { splitNumberByStep } from '@/utils/number';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import { syncProtocols } from '@/databases/hooks/assets';
import useTokenList from '@/store/tokens';
import { eventBus } from '@/utils/events';
import { apisHomeTabIndex, resetNavigationTo } from '@/hooks/navigation';
import { apisSingleHome } from '../Home/hooks/singleHome';
import { isNonPublicProductionEnv } from '@/constant';
import { useMount } from 'ahooks';
import {
  accountEvents,
  PerfAccountEventBusListeners,
} from '@/core/apis/account';

type ImportSuccessScreenProps = NativeStackScreenProps<RootStackParamsList>;

const DisMissKBWrapper = ({ children }) => (
  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    {children}
  </TouchableWithoutFeedback>
);

export const ImportSuccessScreen2024 = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { accounts, fetchAccounts } = useAccounts({ disableAutoFetch: true });
  const navigation = useNavigation<ImportSuccessScreenProps['navigation']>();
  const modalRef =
    useRef<ReturnType<typeof createGlobalBottomSheetModal2024>>();
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

    if (addressList.length === 0) return;
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

  const [loadingBalance, setLoadingBalance] = useState(true);
  const [addressBalances, setAddressBalances] = useState<
    Record<string, number>
  >({});
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

    setLoadingBalance(true);
    Promise.allSettled(
      addresses.map(async address => {
        const res = await apiBalance.getAddressBalance(address, {
          force: true,
        });
        return {
          address,
          balance: res.total_usd_value || 0,
        };
      }),
    )
      .then(results => {
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            setAddressBalances(pre => {
              return {
                ...pre,
                [result.value.address]: result.value.balance,
              };
            });
          }
        });
      })
      .finally(() => {
        setLoadingBalance(false);
      });
    if (
      state.type !== KEYRING_TYPE.WatchAddressKeyring &&
      state.type !== KEYRING_TYPE.GnosisKeyring
    ) {
      const syncAddresses =
        addresses.length > 10 ? addresses.slice(0, 10) : addresses;
      syncAddresses.forEach(address => {
        useTokenList.getState().getTokenList(address);
        syncProtocols(address);
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

  console.log('state', state);

  const Wrapper =
    importAddresses.length > 1 ? KeyboardAvoidingView : DisMissKBWrapper;

  return (
    <Wrapper>
      <View style={styles.container}>
        <View pointerEvents="none" style={styles.animationLayer}>
          <Lottie
            source={AnimationImportSuccess}
            style={[styles.animationLottie]}
            // duration={3000}
            loop={false}
            autoPlay
            {...(__DEV__ &&
              {
                // duration: 5000,
                // loop: true,
              })}
          />
        </View>
        <View style={styles.addressList}>
          {onlyFirstAccount ? (
            <View style={styles.itemContainer}>
              <WalletIcon
                type={state?.type}
                address={importAddresses?.[0]?.address}
                width={100}
                height={100}
                style={styles.icon}
              />
              <Text style={styles.aliasAddress}>
                {importAddresses?.[0]?.aliasName || ''}
              </Text>
              <Text style={styles.importSuccessText}>
                {t('page.syncExtension.importedSuccessfully')}
              </Text>
              {state?.supportChainList?.length ? (
                <GnosisSupportChainList
                  data={state?.supportChainList}
                  style={{ marginBottom: 12 }}
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.scrollList}>
              <ScrollView
                scrollEnabled
                showsVerticalScrollIndicator={false}
                onResponderRelease={() => Keyboard.dismiss()}
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}>
                {importAddresses.map(item => (
                  <Card key={item.address} style={styles.addressItem}>
                    <WalletIcon
                      type={state?.type}
                      address={item.address}
                      width={46}
                      height={46}
                    />
                    <View>
                      <Text style={styles.listInput}>{item.aliasName}</Text>
                      {loadingBalance ? (
                        <Skeleton
                          circle
                          width={102}
                          height={20}
                          animation="wave"
                          LinearGradientComponent={LinearGradient}
                        />
                      ) : (
                        <Text style={styles.balance}>
                          {`$${splitNumberByStep(
                            addressBalances[item.address]?.toFixed(2) || 0,
                          )}`}
                        </Text>
                      )}
                    </View>
                  </Card>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {(state.isFirstImport ||
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
              color={colors2024['blue-default']}
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
          // noShadow={true}
          onPress={handleDone}
        />
      </View>
    </Wrapper>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => {
  const winLayout = Dimensions.get('window');

  return {
    container: {
      width: '100%',
      height: '100%',
      position: 'relative',
      display: 'flex',
      paddingHorizontal: 20,
      backgroundColor: colors2024['neutral-bg-1'],
      marginBottom: 20,
    },
    animationLayer: {
      width: winLayout.width,
      height: '100%',
      minHeight: winLayout.height,
      // ...makeDevOnlyStyle({
      //   backgroundColor: 'blue',
      // }),
      position: 'absolute',
      zIndex: 999,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    animationLottie: {
      width: '100%',
      height: '100%',
    },
    addressList: {
      display: 'flex',
      justifyContent: 'center',
      flex: 1,
      alignItems: 'center',
    },
    scrollList: {
      width: '100%',
      maxHeight: '60%',
    },
    itemContainer: {
      display: 'flex',
      alignItems: 'center',
    },
    icon: {
      borderRadius: 24,
    },
    addressText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '400',
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
    },
    balance: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
    },
    inputContainer: {
      width: '100%',
      height: 72,
      padding: 0,
      margin: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    aliasAddress: {
      width: '100%',
      marginTop: 15,
      textAlignVertical: 'center',
      height: 54,
      padding: 0,
      fontSize: 36,
      borderWidth: 0,
      backgroundColor: 'transparent',
      lineHeight: 42,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      textAlign: 'center',
    },
    importSuccessText: {
      color: colors2024['brand-default'],
      textAlign: 'center',
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      fontStyle: 'normal',
      fontWeight: '800',
      lineHeight: 24,
    },
    resultTip: {
      width: '100%',
      marginTop: 28,
      fontWeight: '800',
      fontSize: 20,
      lineHeight: 24,
      textAlign: 'center',
      fontFamily: 'SF Pro Rounded',
      color: colors2024['brand-default'],
    },
    btnContainer: {
      width: '100%',
      marginBottom: 56,
    },
    addressItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 8,
      marginBottom: 12,
      height: 78,
      borderRadius: 20,
      paddingVertical: 16,
      paddingHorizontal: 20,
      width: '100%',
    },
    listInput: {
      width: '100%',
      textAlignVertical: 'center',
      padding: 0,
      fontSize: 16,
      borderWidth: 0,
      backgroundColor: 'transparent',
      lineHeight: 20,
      fontWeight: '500',
      color: colors2024['neutral-foot'],
      fontFamily: 'SF Pro Rounded',
      textAlign: 'left',
      marginBottom: 4,
    },
    fire: {
      width: 134,
      height: 134,
      position: 'absolute',
      bottom: 149,
      left: '50%',
      transform: [{ translateX: -50 }],
    },
    ledgerButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 25,
    },
    ledgerButtonText: {
      color: colors2024['brand-default'],
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
  };
});
