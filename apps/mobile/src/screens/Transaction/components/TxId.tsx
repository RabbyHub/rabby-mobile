import TouchableText from '@/components/Touchable/TouchableText';
import { ellipsisAddress } from '@/utils/address';
import { getChain } from '@/utils/chain';
import { openTxExternalUrl } from '@/utils/transaction';
import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

export const TxId = ({
  style,
  chain,
  id,
}: {
  style?: React.ComponentProps<typeof View>['style'];
  id: string;
  chain?: ReturnType<typeof getChain> | string;
}) => {
  const { styles } = useTheme2024({ getStyle });
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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chain: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-body'],
  },
  txId: {
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-foot'],
  },
  txIdClickable: {
    textDecorationLine: 'underline',
  },
}));
