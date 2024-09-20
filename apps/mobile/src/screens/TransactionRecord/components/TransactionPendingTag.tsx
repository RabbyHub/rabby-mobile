import { AppColorsVariants } from '@/constant/theme';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useThemeColors } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Spin } from './Spin';
import RcIconInfoCC from '@/assets/icons/transaction-record/icon-info-cc.svg';
import { TxRequest } from '@rabby-wallet/rabby-api/dist/types';

export const TransactionPendingTag = ({
  data,
  txRequest,
}: {
  data?: TransactionGroup;
  txRequest?: TxRequest;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const maxGasTx = data?.maxGasTx;
  const pushAt = txRequest?.push_at;
  const deadline = Math.round((txRequest?.low_gas_deadline || 0) / 60 / 60);

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

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    tag: {
      position: 'absolute',
      left: 12,
      top: 0,
      backgroundColor: colors['orange-light'],
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderBottomStartRadius: 4,
      borderBottomEndRadius: 4,
    },
    tagText: {
      color: colors['orange-default'],
      fontSize: 12,
      lineHeight: 14,
    },
  });
