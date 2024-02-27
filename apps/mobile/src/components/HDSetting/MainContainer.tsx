import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import {
  BottomSheetTextInput,
  BottomSheetView,
  TouchableOpacity,
} from '@gorhom/bottom-sheet';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppBottomSheetModalTitle } from '../customized/BottomSheet';
import { FooterButton } from '../FooterButton/FooterButton';
import { Radio } from '../Radio';
import { Text } from '../Text';
import { Account, InitAccounts } from './type';
import { fetchAccountsInfo } from './util';

export const MAX_ACCOUNT_COUNT = 50;

export interface Setting {
  hdPath: LedgerHDPathType;
  startNumber: number;
}

interface Props {
  hdPathOptions: {
    title: string;
    description: string;
    noChainDescription?: string;
    value: LedgerHDPathType;
    isOnChain?: boolean;
  }[];
  onConfirm: (setting: Setting) => void;
  initAccounts?: InitAccounts;
  setting: Setting;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    root: {
      height: '100%',
      position: 'relative',
    },
    item: {
      flexDirection: 'row',
      width: '100%',
      backgroundColor: colors['neutral-card-2'],
      padding: 16,
      borderRadius: 8,
      overflow: 'hidden',
    },
    list: {
      flex: 1,
      rowGap: 16,
      marginBottom: 24,
    },
    itemTitle: {
      fontSize: 16,
      color: colors['neutral-title-1'],
      fontWeight: '600',
    },
    itemDesc: {
      fontSize: 14,
      color: colors['neutral-body'],
    },
    itemText: {
      rowGap: 6,
      flex: 1,
    },
    scrollView: {
      paddingHorizontal: 20,
      flex: 1,
    },
    radio: {
      padding: 0,
      margin: 0,
    },
    selectIndexText: {
      fontSize: 14,
      color: colors['neutral-title-1'],
      fontWeight: '500',
    },
    selectIndexFoot: {
      fontSize: 14,
      color: colors['neutral-foot'],
    },
    selectIndex: {
      rowGap: 12,
    },
    input: {
      borderColor: colors['neutral-line'],
      borderWidth: 1,
      borderRadius: 8,
      padding: 16,
      fontSize: 16,
      color: colors['neutral-title-1'],
    },
  });

export const MainContainer: React.FC<Props> = ({
  hdPathOptions,
  initAccounts,
  setting,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [currentInitAccounts, setCurrentInitAccounts] =
    React.useState<InitAccounts>();
  const [hdPath, setHdPath] = React.useState(setting.hdPath);
  const [startNumber, setStartNumber] = React.useState(setting.startNumber);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  React.useEffect(() => {
    const run = async () => {
      const newInitAccounts = { ...initAccounts };
      if (initAccounts) {
        for (const key in newInitAccounts) {
          const items = newInitAccounts[key] as Account[];
          newInitAccounts[key] = await fetchAccountsInfo(items);
        }
        setCurrentInitAccounts(newInitAccounts as InitAccounts);
      }
    };

    run();
  }, [initAccounts]);

  const currentHdPathOptions = React.useMemo(() => {
    return hdPathOptions.map(option => {
      const newOption = { ...option };
      if (currentInitAccounts) {
        const accounts = currentInitAccounts[option.value];
        if (!accounts || accounts.length === 0) {
          newOption.description = option.noChainDescription || '';
        } else {
          newOption.isOnChain = true;
        }
      }
      return newOption;
    });
  }, [currentInitAccounts, hdPathOptions]);

  return (
    <BottomSheetView style={styles.root}>
      <AppBottomSheetModalTitle
        title={t('page.newAddress.hd.customAddressHdPath')}
      />
      <ScrollView style={styles.scrollView}>
        <View style={styles.list}>
          {currentHdPathOptions.map(option => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                setHdPath(option.value);
              }}
              key={option.value}>
              <View>
                <Radio
                  containerStyle={styles.radio}
                  checked={hdPath === option.value}
                />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.itemTitle}>{option.title}</Text>
                <Text style={styles.itemDesc}>{option.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.selectIndex}>
          <Text style={styles.selectIndexText}>
            {t('page.newAddress.hd.selectIndexTip')}
          </Text>
          <BottomSheetTextInput
            style={styles.input}
            keyboardType="number-pad"
            defaultValue={startNumber.toString()}
            onChangeText={text => {
              const number = parseInt(text, 10);
              if (number > 0) {
                setStartNumber(number);
              }
            }}
          />
          <Text style={styles.selectIndexFoot}>
            {/* @ts-ignore */}
            {t('page.newAddress.hd.manageAddressFrom', [
              startNumber,
              startNumber + MAX_ACCOUNT_COUNT - 1,
            ])}
          </Text>
        </View>
      </ScrollView>
      <FooterButton
        title="Confirm"
        onPress={() =>
          onConfirm({
            hdPath,
            startNumber,
          })
        }
      />
    </BottomSheetView>
  );
};
