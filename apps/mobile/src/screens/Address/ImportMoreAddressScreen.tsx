import { RootNames } from '@/constant/layout';
import { AppColorsVariants } from '@/constant/theme';
import {
  apiKeyring,
  apiKeystone,
  apiLedger,
  apiMnemonic,
  apiOneKey,
  apiTrezor,
} from '@/core/apis';
import { useThemeColors } from '@/hooks/theme';
import { navigateDeprecated } from '@/utils/navigation';
import {
  HARDWARE_KEYRING_TYPES,
  KEYRING_CLASS,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { toast } from '@/components/Toast';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import { useAtom } from 'jotai';
import { settingAtom } from '@/components/HDSetting/MainContainer';
import { Radio } from '@/components/Radio';
import { addressUtils } from '@rabby-wallet/base-utils';
import { getAccountBalance } from '@/components/HDSetting/util';
import { formatUsdValue } from '@/utils/number';
import { isNumber } from 'lodash';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { useTranslation } from 'react-i18next';
import { Spin } from '@/components/Spin';
import { Skeleton } from '@rneui/themed';
import { ledgerErrorHandler, LEDGER_ERROR_CODES } from '@/hooks/ledger/error';
import { useRoute } from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { activeAndPersistAccountsByMnemonics } from '@/core/apis/mnemonic';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { AddressAndCopy } from '@/components/Address/AddressAndCopy';

const { isSameAddress } = addressUtils;

export const MAX_ACCOUNT_COUNT = 50;

type LedgerAccount = {
  address: string;
  index: number;
  balance?: number | null;
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    root: {
      height: '100%',
      position: 'relative',
      backgroundColor: colors['neutral-bg-2'],
    },
    main: {
      flex: 1,
      paddingHorizontal: 20,
    },
    item: {
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,
      paddingVertical: 18,
      paddingHorizontal: 10,
      justifyContent: 'space-between',
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors['neutral-card-1'],
      height: 60,
    },
    list: {
      rowGap: 12,
      marginTop: 20,
    },
    radio: {
      padding: 0,
      margin: 0,
    },
    itemLeft: {
      columnGap: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    itemIndex: {
      color: colors['neutral-foot'],
      fontSize: 13,
    },
    itemAddress: {
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontWeight: '500',
    },
    itemRight: {
      columnGap: 6,
      flexDirection: 'row',
      alignItems: 'center',
    },
    itemBalance: {
      color: colors['neutral-body'],
      fontSize: 15,
      lineHeight: 24,
    },
    footerButtonTitle: {
      fontWeight: '600',
      fontSize: 16,
    },
    radioIcon: {
      width: 24,
      height: 24,
    },
    radioIconUncheck: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors['neutral-foot'],
    },
    isSelected: {
      borderColor: colors['blue-default'],
      backgroundColor: colors['blue-light-1'],
    },
    footerButtonDisabled: {
      backgroundColor: colors['blue-disable'],
    },
  });

export const ImportMoreAddressScreen = () => {
  const route =
    useRoute<
      GetNestedScreenRouteProp<'AddressNavigatorParamList', 'ImportMoreAddress'>
    >();
  const state = route.params;

  if (!state) {
    throw new Error('[ImportMoreAddressScreen] state is undefined');
  }

  const apiHD = React.useMemo(() => {
    switch (state.type) {
      case KEYRING_TYPE.LedgerKeyring:
        return apiLedger;
      case KEYRING_TYPE.OneKeyKeyring:
        return apiOneKey;
      case KEYRING_TYPE.KeystoneKeyring:
        return apiKeystone;
      case KEYRING_TYPE.TrezorKeyring:
        return apiTrezor;
      default:
        return null;
    }
  }, [state]);

  const hdType = React.useMemo(() => {
    switch (state.type) {
      case KEYRING_TYPE.LedgerKeyring:
        return KEYRING_TYPE.LedgerKeyring;
      case KEYRING_TYPE.OneKeyKeyring:
        return KEYRING_TYPE.OneKeyKeyring;
      case KEYRING_TYPE.HdKeyring:
        return KEYRING_TYPE.HdKeyring;
      default:
        return HARDWARE_KEYRING_TYPES.Keystone.type;
    }
  }, [state.type]) as KEYRING_TYPE;
  const hdBrandName = React.useMemo(() => {
    switch (state.type) {
      case KEYRING_TYPE.LedgerKeyring:
        return KEYRING_CLASS.HARDWARE.LEDGER;
      case KEYRING_TYPE.OneKeyKeyring:
        return KEYRING_CLASS.HARDWARE.ONEKEY;
      case KEYRING_TYPE.HdKeyring:
        return KEYRING_CLASS.MNEMONIC;
      default:
        return HARDWARE_KEYRING_TYPES.Keystone.brandName;
    }
  }, [state.type]);
  const [accounts, setAccounts] = React.useState<LedgerAccount[]>([]);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [setting, setSetting] = useAtom(settingAtom);
  const stoppedRef = React.useRef(true);
  const exitRef = React.useRef(false);
  const startNumberRef = React.useRef((setting?.startNumber || 1) - 1);
  const [currentAccounts, setCurrentAccounts] = React.useState<LedgerAccount[]>(
    [],
  );
  const { t } = useTranslation();
  const [selectedAccounts, setSelectedAccounts] = React.useState<
    LedgerAccount[]
  >([]);
  const [importing, setImporting] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const maxCountRef = React.useRef(MAX_ACCOUNT_COUNT);

  const mnemonicKeyringRef = React.useRef<
    ReturnType<typeof apiMnemonic.getKeyringByMnemonic> | undefined
  >(undefined);
  const getMnemonicKeyring = React.useCallback(() => {
    if (state.type === KEYRING_TYPE.HdKeyring && state.mnemonics) {
      if (!mnemonicKeyringRef.current) {
        mnemonicKeyringRef.current = apiMnemonic.getKeyringByMnemonic(
          state.mnemonics!,
          state.passphrase!,
        );
      }
      return mnemonicKeyringRef.current;
    }
    return undefined;
  }, [state.mnemonics, state.passphrase, state.type]);

  const loadAddress = React.useCallback(
    async (index: number) => {
      const res =
        state.type === KEYRING_TYPE.HdKeyring
          ? await apiKeyring.requestKeyring(
              KEYRING_TYPE.HdKeyring,
              'getAddresses',
              state?.keyringId ?? null,
              index,
              index + 1,
            )
          : (await apiHD?.getAddresses(index, index + 1)) || [];

      if (res[0]) {
        // avoid blocking the UI thread
        await new Promise(resolve => setTimeout(resolve, 1));
        const balance = await getAccountBalance(res[0].address);
        if (stoppedRef.current) {
          return;
        }
        setAccounts(prev => {
          return [
            ...prev,
            {
              address: res[0].address,
              index: res[0].index,
              balance,
            },
          ];
        });
      }
    },
    [apiHD, state?.keyringId, state.type],
  );

  const handleLoadAddress = React.useCallback(async () => {
    setLoading(true);
    stoppedRef.current = false;
    const start = startNumberRef.current;
    let i = start;
    try {
      maxCountRef.current =
        (await apiHD?.getMaxAccountLimit()) ?? MAX_ACCOUNT_COUNT;

      for (; i < start + maxCountRef.current; ) {
        if (stoppedRef.current) {
          break;
        }
        await loadAddress(i);
        i++;
      }
    } catch (err: any) {
      const errorCode = ledgerErrorHandler(err);
      let errMessage = err.message;
      if (errorCode === LEDGER_ERROR_CODES.LOCKED_OR_NO_ETH_APP) {
        errMessage = t('page.newAddress.ledger.error.lockedOrNoEthApp');
      } else if (errorCode === LEDGER_ERROR_CODES.UNKNOWN) {
        errMessage = t('page.newAddress.ledger.error.unknown');
      }
      if (errMessage) {
        toast.show(errMessage);
      }
    }
    stoppedRef.current = true;
    setLoading(false);
    if (exitRef.current) {
      return;
    }

    if (i !== start + maxCountRef.current) {
      handleLoadAddress();
    }
  }, [apiHD, loadAddress, t]);

  const handleSelectIndex = React.useCallback(
    async (address, index) => {
      setSelectedAccounts(prev => {
        if (prev.length >= maxCountRef.current) {
          toast.info(t('page.newAddress.seedPhrase.maxAccountCount'));
          return prev;
        }
        if (prev.some(a => isSameAddress(a.address, address))) {
          return prev.filter(a => !isSameAddress(a.address, address));
        }
        return [
          ...prev,
          {
            address,
            index,
          },
        ];
      });
    },
    [t],
  );

  React.useEffect(() => {
    startNumberRef.current = (setting?.startNumber || 1) - 1;
  }, [setting?.startNumber]);

  React.useEffect(() => {
    setAccounts([]);
    if (stoppedRef.current) {
      handleLoadAddress();
    } else {
      stoppedRef.current = true;
    }
  }, [handleLoadAddress, setting]);

  React.useEffect(() => {
    if (state.type === KEYRING_TYPE.HdKeyring) {
      const api = getMnemonicKeyring();
      api?.getAccounts().then(res => {
        if (res) {
          const accounts = res.map((address, idx) => {
            return {
              address,
              index: api?.getInfoByAddress(address)?.index ?? idx,
            };
          });
          setCurrentAccounts(accounts);
        }
      });
    } else {
      apiHD?.getCurrentAccounts().then(res => {
        if (res) {
          setCurrentAccounts(res);
        }
      });
    }
  }, [apiHD, getMnemonicKeyring, state.type]);

  React.useEffect(() => {
    return () => {
      exitRef.current = true;
      stoppedRef.current = true;
    };
  }, []);

  React.useEffect(() => {
    if (state.type === KEYRING_TYPE.HdKeyring) {
      setSetting({ hdPath: LedgerHDPathType.BIP44, startNumber: 1 });
    }
  }, [setSetting, state.type]);

  const importToastHiddenRef = React.useRef<() => void>(() => {});

  const handleConfirm = React.useCallback(async () => {
    setImporting(true);
    importToastHiddenRef.current = toast.show('Importing...', {
      duration: 100000,
    });

    if (state.type === KEYRING_TYPE.HdKeyring) {
      setTimeout(() => {
        activeAndPersistAccountsByMnemonics(
          state.mnemonics!,
          state.passphrase || '',
          selectedAccounts as any,
          true,
        )
          .then(() => {
            navigateDeprecated(RootNames.StackAddress, {
              screen: RootNames.ImportSuccess,
              params: {
                type: hdType,
                brandName: hdBrandName,
                address: selectedAccounts.map(a => a.address),
              },
            });
          })
          .catch((err: any) => {
            console.error(err);
            toast.show(err.message);
          })
          .finally(() => {
            importToastHiddenRef.current?.();
            setImporting(false);
          });
      });

      return;
    }

    try {
      for (const acc of selectedAccounts) {
        await apiHD?.importAddress(acc.index - 1);
      }

      navigateDeprecated(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess,
        params: {
          type: hdType,
          brandName: hdBrandName,
          address: selectedAccounts.map(a => a.address),
        },
      });
    } catch (err: any) {
      console.error(err);
      toast.show(err.message);
    } finally {
      importToastHiddenRef.current?.();
    }
    setImporting(false);
  }, [
    apiHD,
    hdBrandName,
    hdType,
    selectedAccounts,
    state.mnemonics,
    state.passphrase,
    state.type,
  ]);

  React.useEffect(() => {
    return () => {
      importToastHiddenRef.current?.();
    };
  }, []);

  return (
    <Spin spinning={!accounts.length}>
      <RootScreenContainer hideBottomBar style={styles.root}>
        <ScrollView style={styles.main}>
          <View style={styles.list}>
            {accounts.map(({ address, index, balance }) => {
              const isImported = currentAccounts.some(a =>
                isSameAddress(a.address, address),
              );
              const isSelected = selectedAccounts.some(a =>
                isSameAddress(a.address, address),
              );

              const onPress = () => {
                if (isImported) {
                  toast.success(t('page.newAddress.ledger.imported'));
                  return;
                }
                handleSelectIndex(address, index);
              };

              return (
                <TouchableOpacity
                  onPress={onPress}
                  style={StyleSheet.flatten([
                    styles.item,
                    {
                      opacity: isImported ? 0.5 : 1,
                    },
                    isSelected && styles.isSelected,
                  ])}
                  key={address}>
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemIndex}>{index}</Text>
                    <AddressAndCopy address={address} />
                  </View>
                  <View style={styles.itemRight}>
                    {isNumber(balance) && (
                      <Text style={styles.itemBalance}>
                        {formatUsdValue(balance)}
                      </Text>
                    )}
                    <View>
                      <Radio
                        onPress={onPress}
                        containerStyle={styles.radio}
                        checked={isImported || isSelected}
                        iconStyle={styles.radioIcon}
                        uncheckedIcon={<View style={styles.radioIconUncheck} />}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            {/* next placeholder */}
            {loading && (
              <View style={styles.item}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemIndex}>{accounts.length + 1}</Text>
                  <Text style={styles.itemAddress}>
                    <Skeleton width={100} height={20} />
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
        <FooterButton
          disabled={importing || !selectedAccounts.length}
          titleStyle={styles.footerButtonTitle}
          disabledStyle={styles.footerButtonDisabled}
          title={`${t('global.Confirm')}${
            selectedAccounts.length ? ` (${selectedAccounts.length})` : ''
          }`}
          onPress={handleConfirm}
          loading={importing}
        />
      </RootScreenContainer>
    </Spin>
  );
};
