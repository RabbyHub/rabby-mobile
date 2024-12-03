import { useTheme2024 } from '@/hooks/theme';
import { BottomSheetTextInput, TouchableOpacity } from '@gorhom/bottom-sheet';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { atom } from 'jotai';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, Text } from 'react-native';
import { AppBottomSheetModalTitle } from '@/components/customized/BottomSheet';
import { FooterButton } from '@/components2024/FooterButton/FooterButton';
import { Radio } from '@/components2024/Radio';
import { Spin } from '@/components/Spin';
import { Account, InitAccounts } from './type';
import { fetchAccountsInfo } from './util';
import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';

export const MAX_ACCOUNT_COUNT = 50;
const HARDENED_OFFSET = 0x80000000 - 50;
export const isLoadedAtom = atom<boolean>(false);
export const initAccountsAtom = atom<InitAccounts | undefined>(undefined);
export const settingAtom = atom<Setting>({
  hdPath: LedgerHDPathType.LedgerLive,
  startNumber: 1,
});

export interface Setting {
  hdPath: LedgerHDPathType;
  startNumber: number;
}

export interface Props {
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
  loading?: boolean;
  children?: React.ReactNode;
  disableHdPathOptions?: boolean;
  disableStartFrom?: boolean;
}

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  root: {
    height: '100%',
    position: 'relative',
  },
  title: {
    marginTop: 0,
    paddingTop: 28,
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    marginBottom: 24,
  },
  item: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: colors2024['neutral-bg-2'],
    padding: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors2024['neutral-bg-2'],
    overflow: 'hidden',
    position: 'relative',
    gap: 12,
  },
  list: {
    flex: 1,
    rowGap: 16,
    marginBottom: 20,
  },
  itemTitle: {
    fontSize: 17,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
  itemDesc: {
    fontSize: 14,
    fontWeight: '400',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  itemText: {
    rowGap: 8,
    flex: 1,
  },
  scrollView: {
    paddingHorizontal: 24,
    flex: 1,
  },
  radio: {
    padding: 0,
    margin: 0,
  },
  selectIndexText: {
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-body'],
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
  },
  selectIndexFoot: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    marginBottom: 24,
    color: colors2024['neutral-info'],
  },
  selectIndex: {
    rowGap: 12,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: colors2024['neutral-bg-2'],
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  dot: {
    width: 8,
    height: 8,
    position: 'absolute',
    top: 23,
    right: 16,
    backgroundColor: colors2024['green-default'],
    borderRadius: 10,
  },
  radioIcon: {
    margin: 0,
    padding: 0,
    width: 20,
    height: 20,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: colors2024['brand-disable'],
  },
  radioIconUncheck: {
    width: 20,
    height: 20,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: colors2024['neutral-info'],
  },
}));

export const MainContainer: React.FC<Props> = ({
  hdPathOptions,
  initAccounts,
  setting,
  onConfirm,
  loading,
  children,
  disableHdPathOptions,
  disableStartFrom,
}) => {
  const [fetching, setFetching] = React.useState(false);
  const { t } = useTranslation();
  const [currentInitAccounts, setCurrentInitAccounts] =
    React.useState<InitAccounts>();
  const [hdPath, setHdPath] = React.useState(setting.hdPath);
  const [startNumber, setStartNumber] = React.useState(setting.startNumber);
  const { styles } = useTheme2024({ getStyle: getStyles });
  const [isPressing, setIsPressing] = React.useState(false);
  const currentLoading = loading || fetching;

  React.useEffect(() => {
    setFetching(true);
    const run = async () => {
      const newInitAccounts = { ...initAccounts };
      if (initAccounts) {
        for (const key in newInitAccounts) {
          const items = newInitAccounts[key] as Account[];
          newInitAccounts[key] = await fetchAccountsInfo(items);
        }
        setCurrentInitAccounts(newInitAccounts as InitAccounts);
      }
      setFetching(false);
    };

    run();
  }, [initAccounts]);

  const currentHdPathOptions = React.useMemo(() => {
    return hdPathOptions.map(option => {
      const newOption = { ...option };
      if (currentInitAccounts) {
        const accounts = currentInitAccounts[option.value];
        if (
          !accounts ||
          accounts.length === 0 ||
          accounts.every(a => !a.balance)
        ) {
          newOption.description = option.noChainDescription || '';
        } else {
          newOption.isOnChain = true;
        }
      }
      return newOption;
    });
  }, [currentInitAccounts, hdPathOptions]);

  return (
    <Spin spinning={currentLoading}>
      <AutoLockView as="BottomSheetView" style={styles.root}>
        <AppBottomSheetModalTitle
          style={styles.title}
          title={t('page.newAddress.hd.customAddressHdPath')}
        />
        <ScrollView style={styles.scrollView}>
          <View style={styles.list}>
            {currentHdPathOptions.map(option => (
              <TouchableOpacity
                disabled={disableHdPathOptions}
                style={styles.item}
                onPress={() => {
                  setHdPath(option.value);
                }}
                key={option.value}>
                <View>
                  <Radio
                    onPress={() => {
                      setHdPath(option.value);
                    }}
                    containerStyle={styles.radio}
                    checked={hdPath === option.value}
                    iconStyle={styles.radioIcon}
                    uncheckedIcon={<View style={styles.radioIconUncheck} />}
                  />
                </View>
                <View style={styles.itemText}>
                  <Text style={styles.itemTitle}>{option.title}</Text>
                  <Text style={styles.itemDesc}>{option.description}</Text>
                </View>
                {option.isOnChain && <View style={styles.dot} />}
              </TouchableOpacity>
            ))}
          </View>
          {!disableStartFrom && (
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
                  if (number > 0 && number < HARDENED_OFFSET) {
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
          )}
          {children}
        </ScrollView>
        <FooterButton
          title={t('global.Confirm')}
          disabled={isPressing}
          onPress={async () => {
            setIsPressing(true);
            onConfirm({
              hdPath,
              startNumber,
            });
          }}
        />
      </AutoLockView>
    </Spin>
  );
};
