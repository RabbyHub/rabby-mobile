import React from 'react';
import { Text, View } from 'react-native';

import { RcArrowRight2CC } from '@/assets/icons/common';
import { useTheme2024 } from '@/hooks/theme';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { createGetStyles2024 } from '@/utils/styles';

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
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  return (
    <>
      <View style={styles.footer}>
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
                <RcArrowRight2CC color={colors2024['neutral-secondary']} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  footer: {
    paddingBottom: 48,
    paddingHorizontal: 20,
    position: 'relative',
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 100,
    backgroundColor: ctx.colors2024['neutral-card-2'],
    paddingHorizontal: 8,
    paddingVertical: 10,
    display: 'flex',
    gap: 2,
  },
  itemText: {
    fontSize: 14,
    lineHeight: 18,
    color: ctx.colors2024['neutral-secondary'],
  },
}));
