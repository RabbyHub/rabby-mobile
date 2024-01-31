import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { StyleSheet, Text, View } from 'react-native';
import { TransactionExplain } from './TransactionExplain';
import { TransactionAction } from './TransactionAction';
import { TransactionPendingTag } from './TransactionPendingTag';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useMemo } from 'react';
import { findChainByID } from '@/utils/chain';
import { TransactionPendingDetail } from './TransactionPendingDetail';

export const TransactionItem = ({ data }: { data: TransactionGroup }) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const chain = useMemo(() => {
    return findChainByID(data.chainId);
  }, [data.chainId]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TransactionPendingTag data={data} />
        <Text style={styles.nonce}>
          {chain?.name || 'Unknown'} #{data?.nonce}
        </Text>
      </View>
      <View style={styles.content}>
        <View style={styles.body}>
          <TransactionExplain explain={data.maxGasTx?.explain} />
          <TransactionAction />
        </View>
        <View style={styles.footer}>
          {data?.originTx?.site ? (
            <Text style={styles.origin}>{data?.originTx?.site?.origin}</Text>
          ) : null}
          <Text style={styles.gas}>
            {Number(
              data.maxGasTx?.rawTx.gasPrice ||
                data.maxGasTx?.rawTx.maxFeePerGas ||
                0,
            ) / 1e9}{' '}
            Gwei{' '}
          </Text>
        </View>
      </View>
      <TransactionPendingDetail data={data} />
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    card: {
      borderRadius: 6,
      backgroundColor: colors['neutral-card1'],
      marginBottom: 12,
      paddingBottom: 4,
    },
    content: {
      paddingHorizontal: 12,
    },
    header: {
      position: 'relative',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    nonce: {
      lineHeight: 14,
      fontSize: 12,
      color: colors['neutral-foot'],
      marginLeft: 'auto',
    },
    body: {
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 8,
    },
    origin: {
      lineHeight: 14,
      fontSize: 12,
      color: colors['neutral-foot'],
    },
    gas: {
      marginLeft: 'auto',
      lineHeight: 14,
      fontSize: 12,
      color: colors['neutral-foot'],
    },
  });
