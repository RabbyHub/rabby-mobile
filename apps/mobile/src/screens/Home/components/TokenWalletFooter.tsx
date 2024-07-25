import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { RcArrowRightCC } from '@/assets/icons/common';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { TouchableOpacity } from 'react-native-gesture-handler';

type OptionType = 'custom' | 'blocked' | 'customTestnet';

export type TokenWalletFooterProps = {
  onPress?: (type: OptionType) => void;
  list: {
    type: OptionType;
    label: string;
  }[];
};
export const TokenWalletFooter = ({
  list,
  onPress,
}: TokenWalletFooterProps) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);
  const { t } = useTranslation();

  return (
    <>
      <View style={styles.footer}>
        <View style={styles.divider} />
        <View style={styles.list}>
          {list.map(item => {
            return (
              <TouchableOpacity
                key={item.type}
                style={styles.item}
                onPress={() => {
                  onPress?.(item.type);
                }}>
                <Text style={styles.itemText}>{item.label}</Text>
                <RcArrowRightCC color={colors['neutral-foot']} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
};

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    footer: {
      paddingBottom: 48,
      paddingHorizontal: 20,
      paddingTop: 16,
      position: 'relative',
    },
    divider: {
      position: 'absolute',
      top: 0,
      right: 20,
      left: 20,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors['neutral-line'],
    },
    list: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 4,
      backgroundColor: colors['neutral-bg-4'],
      padding: 10,
    },
    itemText: {
      fontSize: 13,
      lineHeight: 16,
      color: colors['neutral-body'],
    },
  });
