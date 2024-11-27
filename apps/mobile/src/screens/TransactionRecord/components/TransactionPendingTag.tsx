import { TransactionGroup } from '@/core/services/transactionHistory';
import { useThemeColors } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Spin } from './Spin';
import RcIconInfoCC from '@/assets/icons/transaction-record/icon-info-cc.svg';
import { TxRequest } from '@rabby-wallet/rabby-api/dist/types';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

export const TransactionPendingTag = ({
  data,
  txRequest,
}: {
  data?: TransactionGroup;
  txRequest?: TxRequest;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { styles } = useTheme2024({ getStyle });
  const maxGasTx = data?.maxGasTx;
  const pushAt = txRequest?.push_at;

  if (!data?.isPending) {
    return null;
  }

  if (maxGasTx?.hash && !maxGasTx?.reqId) {
    return (
      <View style={styles.tag}>
        <Spin color={colors['orange-default']} />
        <Text style={styles.tagText}>
          {t('page.activities.signedTx.status.pending')}
        </Text>
      </View>
    );
  }

  if (maxGasTx?.hash) {
    // todo mempool list
    return (
      <View style={styles.tag}>
        <Spin color={colors['orange-default']} />
        <Text style={styles.tagText}>
          {t('page.activities.signedTx.status.pendingBroadcasted')}
        </Text>
      </View>
    );
  }

  if (pushAt) {
    // todo 广播失败 tooltip
    return (
      <View style={styles.tag}>
        <Spin color={colors['orange-default']} />
        <Text style={styles.tagText}>
          {t('page.activities.signedTx.status.pendingBroadcastFailed')}
        </Text>
        <RcIconInfoCC color={colors['orange-default']} />
      </View>
    );
  }

  // todo 待广播  tooltip
  return (
    <View style={styles.tag}>
      <Spin color={colors['orange-default']} />
      <Text style={styles.tagText}>
        {t('page.activities.signedTx.status.pendingBroadcast')}
      </Text>
      <RcIconInfoCC color={colors['orange-default']} />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tag: {
    position: 'absolute',
    left: 12,
    top: 0,
    backgroundColor: colors2024['orange-light-1'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomStartRadius: 8,
    borderBottomEndRadius: 8,
  },
  tagText: {
    color: colors2024['orange-default'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 14,
  },
}));
