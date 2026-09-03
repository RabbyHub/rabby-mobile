import { CHAINS_ENUM, Chain } from '@/constant/chains';
import type { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { useMemo } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import RcIconChecked from '@/assets/icons/select-chain/icon-checked.svg';
import { Text } from '@/components/Typography';

export const SelectChainItem = ({
  data,
  value,
  onPress,
}: {
  data: Chain;
  value?: CHAINS_ENUM;
  onPress?(value: CHAINS_ENUM): void;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <TouchableOpacity
      onPress={() => {
        onPress?.(data?.enum);
      }}>
      <View style={styles.container}>
        <Image
          source={{
            uri: data.logo,
          }}
          style={styles.logo}
        />
        <View style={styles.content}>
          <Text style={styles.name}>{data?.name}</Text>
          {value && value === data?.enum ? <RcIconChecked /> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 16,
    },
    logo: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    name: {
      color: colors['neutral-title1'],
      fontSize: 16,
      fontWeight: '500',
      lineHeight: 19,
    },
  });
