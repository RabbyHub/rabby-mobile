import { AppColorsVariants } from '@/constant/theme';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useThemeColors } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Spin } from './Spin';
import { useMemo } from 'react';
import { sortBy } from 'lodash';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import RcIconQuestionCC from '@/assets/icons/transaction-record/icon-question-cc.svg';
import { TouchableOpacity } from 'react-native-gesture-handler';

export const TransactionPendingDetail = ({
  data,
}: {
  data?: TransactionGroup;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const txs = useMemo(() => {
    return sortBy(data?.txs || [], item => -item.createdAt);
  }, [data?.txs]);

  if (!data || !data?.isPending || data.txs.length <= 1) {
    return null;
  }
  return (
    <View style={styles.container}>
      <View style={styles.detail}>
        <View style={styles.header}>
          <Text style={styles.title}>Pending detail</Text>
          <TouchableOpacity>
            <RcIconQuestionCC color={colors['neutral-foot']} />
          </TouchableOpacity>
        </View>
        <View style={styles.list}>
          {txs.map((tx, index) => {
            return (
              <View
                style={[styles.row, index !== 0 && styles.rowGray]}
                key={tx.hash || tx.reqId || index}>
                <Text style={styles.txType}>
                  {tx === data.originTx
                    ? 'Initial tx'
                    : isSameAddress(tx.rawTx.from, tx.rawTx.to)
                    ? 'Cancel tx'
                    : 'Speed up tx'}
                </Text>
                <Text style={styles.gas}>
                  {Number(tx.rawTx.gasPrice || tx.rawTx.maxFeePerGas || 0) /
                    1e9}{' '}
                  Gwei
                </Text>
                <Spin color={colors['neutral-body']} style={styles.spin} />
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 4,
    },
    detail: {
      backgroundColor: colors['neutral-card2'],
      padding: 8,
      borderBottomStartRadius: 4,
      borderBottomEndRadius: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    title: {
      color: colors['neutral-foot'],
      fontSize: 13,
      lineHeight: 16,
    },
    list: {
      flexDirection: 'column',
      gap: 8,
    },
    row: {
      flexDirection: 'row',
    },
    rowGray: {
      opacity: 0.5,
    },
    txType: {
      color: colors['neutral-foot'],
      fontSize: 13,
      lineHeight: 16,
      width: 142,
    },
    gas: {
      color: colors['neutral-foot'],
      fontSize: 13,
      lineHeight: 16,
    },
    spin: {
      marginLeft: 'auto',
    },
  });
