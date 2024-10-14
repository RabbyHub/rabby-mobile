import TouchableText from '@/components/Touchable/TouchableText';
import { AppColorsVariants } from '@/constant/theme';
import { openExternalUrl } from '@/core/utils/linking';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { getChain } from '@/utils/chain';
import { openTxExternalUrl } from '@/utils/transaction';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const TxId = ({
  style,
  chain,
  id,
}: {
  style?: React.ComponentProps<typeof View>['style'];
  id: string;
  chain?: ReturnType<typeof getChain> | string;
}) => {
  const { styles } = useThemeStyles(getStyles);
  const { chainItem, touchable } = useMemo(() => {
    const info = typeof chain === 'string' ? getChain(chain) : chain;

    return { chainItem: info, touchable: !!info?.scanLink };
  }, [chain]);

  const onOpenTxId = useCallback(() => {
    openTxExternalUrl({ chain: chainItem, txHash: id });
  }, [chainItem, id]);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.chain}>{chainItem?.name || 'Unknown'}</Text>
      <TouchableText
        disabled={!touchable}
        onPress={onOpenTxId}
        style={[styles.txId, touchable && styles.txIdClickable]}>
        {ellipsisAddress(id)}
      </TouchableText>
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
    txIdClickable: {
      textDecorationLine: 'underline',
    },
  });
