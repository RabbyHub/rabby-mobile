import { RcIconDepositCC, RcIconWithdrawCC } from '@/assets2024/icons/perps';
import { AccountHistoryItem } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { Spin } from '@/screens/TransactionRecord/components/Spin';
import { createGetStyles2024 } from '@/utils/styles';
import { sinceTime } from '@/utils/time';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

interface HistoryAccountItemProps {
  data: AccountHistoryItem;
}

export const PerpsHistoryAccountItem: React.FC<HistoryAccountItemProps> = ({
  data,
}) => {
  const { time, type, status, usdValue } = data;
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <View style={styles.card}>
      <View style={styles.leftContent}>
        {type === 'deposit' ? (
          <RcIconDepositCC
            color={colors2024['neutral-body']}
            bgColor={colors2024['neutral-bg-5']}
            width={46}
            height={46}
          />
        ) : (
          <RcIconWithdrawCC
            color={colors2024['neutral-body']}
            bgColor={colors2024['neutral-bg-5']}
            width={46}
            height={46}
          />
        )}
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {type === 'deposit'
              ? t('page.perps.history.deposit')
              : t('page.perps.history.withdraw')}
          </Text>
          {status === 'pending' ? (
            <View style={styles.pendingContainer}>
              <Text style={styles.pendingStatus}>
                {t('page.perps.history.status.pending')}
              </Text>
              <Spin color={colors2024['orange-default']} />
            </View>
          ) : (
            <Text style={styles.completedStatus}>
              {t('page.perps.history.status.completed')}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.rightContent}>
        {status === 'success' ? (
          <>
            <Text
              style={[
                styles.amount,
                type === 'deposit' ? styles.greenText : styles.redText,
              ]}>
              {type === 'deposit' ? '+' : '-'}
              {`$${usdValue}`}
            </Text>
            <Text style={styles.timeText}>{sinceTime(time / 1000)}</Text>
          </>
        ) : (
          <Text
            style={[
              styles.amount,
              type === 'deposit' ? styles.greenText : styles.redText,
            ]}>
            {type === 'deposit' ? '+' : '-'}
            {`$${usdValue}`}
          </Text>
        )}
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  leftContent: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rightContent: {
    alignItems: 'flex-end',
    flexDirection: 'column',
    gap: 2,
  },

  textContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
    color: colors2024['neutral-body'],
  },
  pendingContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pendingStatus: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['orange-default'],
  },
  completedStatus: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  amount: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  greenText: {
    color: colors2024['green-default'],
  },
  redText: {
    color: colors2024['red-default'],
  },
  timeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
