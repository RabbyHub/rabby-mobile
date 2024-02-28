import { RootNames } from '@/constant/layout';
import { AppColorsVariants } from '@/constant/theme';
import { apiLedger } from '@/core/apis';
import { useThemeColors } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
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
import { RcIconCopyCC } from '@/assets/icons/common';
import { formatAddressToShow } from '@/utils/address';
import { addressUtils } from '@rabby-wallet/base-utils';
import Clipboard from '@react-native-clipboard/clipboard';
import { getAccountBalance } from '@/components/HDSetting/util';
import { formatUsdValue } from '@/utils/number';
import { isNumber } from 'lodash';
import { FooterButton } from '@/components/FooterButton/FooterButton';
import { useTranslation } from 'react-i18next';
import { Spin } from '@/components/Spin';

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
    },
    main: {
      flex: 1,
      paddingHorizontal: 20,
    },
    item: {
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,
      paddingVertical: 20,
      paddingHorizontal: 12,
      justifyContent: 'space-between',
      flexDirection: 'row',
      alignItems: 'center',
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
    },
    itemAddressWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 4,
    },
    footerButtonTitle: {
      fontWeight: '600',
      fontSize: 16,
    },
  });

export const ImportLedgerScreen = () => {
  const [accounts, setAccounts] = React.useState<LedgerAccount[]>([]);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [setting] = useAtom(settingAtom);
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

  const loadAddress = React.useCallback(async (index: number) => {
    const res = await apiLedger.getAddresses(index, index + 1);
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
  }, []);

  const handleLoadAddress = React.useCallback(async () => {
    stoppedRef.current = false;
    const start = startNumberRef.current;
    let i = start;
    try {
      for (; i < start + MAX_ACCOUNT_COUNT; ) {
        if (stoppedRef.current) {
          break;
        }
        await loadAddress(i);
        i++;
      }
    } catch (e: any) {
      toast.show(e.message);
    }
    stoppedRef.current = true;

    if (exitRef.current) {
      return;
    }

    if (i !== start + MAX_ACCOUNT_COUNT) {
      handleLoadAddress();
    }
  }, [loadAddress]);

  const handleSelectIndex = React.useCallback(async (address, index) => {
    setSelectedAccounts(prev => {
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
  }, []);

  React.useEffect(() => {
    setAccounts([]);
    if (stoppedRef.current) {
      handleLoadAddress();
    } else {
      stoppedRef.current = true;
    }
  }, [handleLoadAddress, setting]);

  React.useEffect(() => {
    startNumberRef.current = (setting?.startNumber || 1) - 1;
  }, [setting?.startNumber]);

  React.useEffect(() => {
    apiLedger.getCurrentAccounts().then(res => {
      if (res) {
        setCurrentAccounts(res);
      }
    });
  }, [setting.hdPath]);

  React.useEffect(() => {
    return () => {
      exitRef.current = true;
      stoppedRef.current = true;
    };
  }, []);

  const onCopy = React.useCallback((address: string) => {
    Clipboard.setString(address);
    toast.success('Copied');
  }, []);

  const handleConfirm = React.useCallback(async () => {
    setImporting(true);
    const importToastHidden = toast.show('Importing...', {
      duration: 100000,
    });
    try {
      for (const acc of selectedAccounts) {
        await apiLedger.importAddress(acc.index - 1);
      }
      navigate(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess,
        params: {
          brandName: KEYRING_CLASS.HARDWARE.LEDGER,
          address: selectedAccounts.map(a => a.address),
        },
      });
    } catch (err: any) {
      console.error(err);
      toast.show(err.message);
    } finally {
      importToastHidden();
    }
    setImporting(false);
  }, [selectedAccounts]);

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

              return (
                <TouchableOpacity
                  onPress={() => handleSelectIndex(address, index)}
                  style={StyleSheet.flatten([
                    styles.item,
                    {
                      opacity: isImported ? 0.5 : 1,
                    },
                  ])}
                  disabled={isImported}
                  key={address}>
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemIndex}>{index}</Text>
                    <View style={styles.itemAddressWrap}>
                      <Text style={styles.itemAddress}>
                        {formatAddressToShow(address, {
                          ellipsis: true,
                        })}
                      </Text>
                      <TouchableOpacity onPress={() => onCopy(address)}>
                        <RcIconCopyCC
                          color={colors['neutral-foot']}
                          width={14}
                          height={14}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.itemRight}>
                    {isNumber(balance) && (
                      <Text style={styles.itemBalance}>
                        {formatUsdValue(balance)}
                      </Text>
                    )}
                    <View>
                      <Radio
                        containerStyle={styles.radio}
                        checked={isImported || isSelected}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
        <FooterButton
          disabled={importing}
          titleStyle={styles.footerButtonTitle}
          title={`${t('global.Confirm')}${
            selectedAccounts.length ? ` (${selectedAccounts.length})` : ''
          }`}
          onPress={handleConfirm}
        />
      </RootScreenContainer>
    </Spin>
  );
};
