import React, { useCallback, useMemo, useState } from 'react';
import RcIconFilterCC from '@/assets2024/icons/history/IconFilterCC.svg';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  ViewStyle,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';

const historyHitSlop = {
  top: 4,
  bottom: 4,
  left: 4,
  right: 4,
};

interface Props {
  setIsShowMenu: (value: React.SetStateAction<boolean>) => void;
}

export const HistoryFilterMenu = ({ setIsShowMenu }: Props) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        hitSlop={historyHitSlop}
        onPress={() => setIsShowMenu(prev => !prev)}>
        <RcIconFilterCC
          color={styles.filterIcon.color}
          style={styles.filterIcon}
        />
      </TouchableOpacity>
      {/* {isShowMenu && (
        <View style={styles.menuContainer}>
          <Text style={styles.menuItemText}>{'View hidden items'}</Text>
          <View style={styles.valueView}>
            <AppSwitch2024 value={isShowAll} onValueChange={setIsShowAll} />
          </View>
        </View>
      )} */}
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
