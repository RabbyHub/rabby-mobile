import { RcIconDepositCC, RcIconWithdrawCC } from '@/assets2024/icons/perps';
import { AccountHistoryItem } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
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

  //   if (status === 'pending') {
  //     return (
  //       <View style={styles.iconContainer}>
  //         <RcIconPendingCC style={[styles.icon, styles.rotating]} />
  //       </View>
  //     );
  //   }

  //   if (type === 'deposit') {
  //     return (
  //       <View style={styles.iconContainer}>
  //         <ThemeIcon src={RcIconDeposit} style={styles.icon} />
  //       </View>
  //     );
  //   } else {
  //     return (
  //       <View style={styles.iconContainer}>
  //         <ThemeIcon src={RcIconWithdraw} style={styles.icon} />
  //       </View>
  //     );
  //   }
  // }, [status, styles.icon, styles.iconContainer, styles.rotating, type]);

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
            {type === 'deposit' ? 'Deposit' : 'Withdraw'}
          </Text>
          {status === 'pending' ? (
            <Text style={styles.pendingStatus}>Pending</Text>
          ) : (
            <Text style={styles.completedStatus}>Completed</Text>
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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: colors2024['neutral-bg-1'],
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
