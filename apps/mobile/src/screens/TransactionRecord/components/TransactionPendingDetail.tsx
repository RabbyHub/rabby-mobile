import RcIconQuestionCC from '@/assets/icons/transaction-record/icon-question-cc.svg';
import { Tip } from '@/components';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { sortBy } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Spin } from './Spin';

export const TransactionPendingDetail = ({
  data,
}: {
  data?: TransactionGroup;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024, colors } = useTheme2024({ getStyle });
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
          <Text style={styles.title}>
            {t('page.activities.signedTx.common.pendingDetail')}
          </Text>
          <Tip content={t('page.activities.signedTx.tips.pendingDetail')}>
            <TouchableOpacity>
              <RcIconQuestionCC color={colors['neutral-foot']} />
            </TouchableOpacity>
          </Tip>
        </View>
        <View style={styles.list}>
          {txs.map((tx, index) => {
            return (
              <View
                style={[styles.row, index !== 0 && styles.rowGray]}
                key={index}>
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
                <Spin color={colors2024['neutral-body']} style={styles.spin} />
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  container: {
    paddingHorizontal: 4,
  },
  detail: {
    backgroundColor: colors['neutral-card2'],
    padding: 12,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  title: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
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
}));
