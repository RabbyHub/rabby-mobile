import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { getChain } from '@/utils/chain';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const TxId = ({
  style,
  chain,
  id,
}: {
  style?: React.ComponentProps<typeof View>['style'];
  id: string;
  chain: string;
}) => {
  const info = useMemo(() => getChain(chain), [chain]);
  const colors = useThemeColors();
  const styles = getStyles(colors);
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.chain}>{info?.name || 'Unknown'}</Text>
      <Text style={styles.txId}>{ellipsisAddress(id)}</Text>
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    chain: {
      fontSize: 12,
      lineHeight: 14,
      color: colors['neutral-body'],
    },
    txId: {
      fontSize: 12,
      lineHeight: 14,
      color: colors['neutral-foot'],
    },
  });
