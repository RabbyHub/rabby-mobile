import { CHAINS_ENUM, Chain } from '@/constant/chains';
import type { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { useMemo } from 'react';
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
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <FlatList
      data={data}
      style={styles.list}
      ItemSeparatorComponent={Divider}
      keyExtractor={item => item.enum}
      renderItem={({ item }) => {
        return <SelectChainItem data={item} value={value} onPress={onChange} />;
      }}
    />
  );
};

const Divider = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return <View style={styles.divider} />;
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    list: {
      paddingHorizontal: 16,
      borderRadius: 6,
      backgroundColor: colors['neutral-card2'],
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors['neutral-line'],
    },
  });
