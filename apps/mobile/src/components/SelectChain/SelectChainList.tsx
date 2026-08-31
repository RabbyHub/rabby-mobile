import { CHAINS_ENUM, Chain } from '@/constant/chains';
import type { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SelectChainItem } from './SelectChainItem';

export const SelectChainList = ({
  value,
  onChange,
  data,
}: {
  value?: CHAINS_ENUM;
  onChange?(value: CHAINS_ENUM): void;
  data: Chain[];
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const renderDivider = React.useCallback(
    () => <View style={styles.divider} />,
    [styles.divider],
  );

  return (
    <FlatList
      data={data}
      style={styles.list}
      ItemSeparatorComponent={renderDivider}
      keyExtractor={item => item.enum}
      renderItem={({ item }) => {
        return (
          <SelectChainItem
            data={item}
            value={value}
            textStyle={styles.itemText}
            onPress={onChange}
          />
        );
      }}
    />
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    list: {
      paddingHorizontal: 16,
      borderRadius: 6,
      backgroundColor: colors['neutral-card2'],
    },
    divider: {
      height: 0.5,
      backgroundColor: colors['neutral-line'],
    },
    itemText: {
      color: colors['neutral-title1'],
      fontSize: 16,
      lineHeight: 19,
      fontWeight: '500',
    },
  });
