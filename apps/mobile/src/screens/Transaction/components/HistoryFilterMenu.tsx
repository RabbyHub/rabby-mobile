import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { toast } from '@/components2024/Toast';
import { createGetStyles2024 } from '@/utils/styles';
import { default as RcIconEyeCC } from '@/assets/icons/receive/eye-cc.svg';
import { default as RcIconEyeCloseCC } from '@/assets/icons/receive/eye-close-cc.svg';
import { AppSwitch2024 } from '@/components/customized/Switch2024';

const historyHitSlop = {
  top: 4,
  bottom: 4,
  left: 4,
  right: 4,
};

interface Props {
  setIsShowAll: (value: React.SetStateAction<boolean>) => void;
  isShowAll: boolean;
  handleSwitchShowAll: (value: boolean) => void;
}

export const HistoryFilterMenu = ({
  setIsShowAll,
  isShowAll,
  handleSwitchShowAll,
}: Props) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const switchShowAll = (e: boolean) => {
    setIsShowAll(prev => {
      if (prev) {
        toast.success(t('page.transactions.HideScamTransactions'));
      } else {
        toast.success(t('page.transactions.ShowScamTransactions'));
      }
      return !prev;
    });
    handleSwitchShowAll(e);
  };
  return (
    <View style={styles.container}>
      {/* <TouchableOpacity hitSlop={historyHitSlop} onPress={switchShowAll}> */}
      <AppSwitch2024 value={!isShowAll} onValueChange={e => switchShowAll(e)} />
      {/* {isShowAll ? (
          <RcIconEyeCC
            color={colors2024['neutral-foot']}
            style={styles.filterIcon}
            width={24}
            height={24}
          />
        ) : (
          <RcIconEyeCloseCC
            color={colors2024['neutral-foot']}
            style={styles.filterIcon}
            width={24}
            height={24}
          />
        )} */}
      {/* </TouchableOpacity> */}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tokenAmountText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
  },
  ghostButton: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['neutral-info'],
  },
  ghostTitle: {
    color: colors2024['neutral-title-1'],
  },
  filterIcon: {
    width: 24,
    height: 24,
    color: colors2024['neutral-title-1'],
  },
  menuItemText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  valueView: {
    width: '50%',
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  container: {
    position: 'relative',
  },
  menuContainer: {
    position: 'absolute',
    top: 20,
    right: 0,
    width: 250,
    height: 56,
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 16,
  },
}));
