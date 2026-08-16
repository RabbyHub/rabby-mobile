import RcIconFailed from '@/assets2024/icons/bridge/IconFailedCC.svg';
import RcIconPending from '@/assets2024/icons/bridge/IconPendingCC.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import {
  formatPerpsProSignedDecimal,
  isPerpsProStableAsset,
} from '@/screens/PerpsPro/utils/format';
import React from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { createGetStyles2024 } from '@/utils/styles';

import type { PerpsProTransactionHistoryRow } from '../../types';
import { PerpsProHistoryRowLayout } from '../PerpsProHistoryRowPrimitives';

const PerpsProTransactionStatus: React.FC<{
  status: 'failed' | 'pending';
}> = ({ status }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const rotation = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (status !== 'pending') {
      rotation.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(rotation, {
        duration: 1600,
        easing: Easing.linear,
        toValue: 1,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [rotation, status]);
  const color =
    status === 'pending'
      ? colors2024['orange-default']
      : colors2024['red-default'];
  const icon =
    status === 'pending' ? (
      <Animated.View
        style={{
          transform: [
            {
              rotate: rotation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        }}>
        <RcIconPending color={color} height={18} width={18} />
      </Animated.View>
    ) : (
      <RcIconFailed color={color} height={18} width={18} />
    );
  return (
    <View style={styles.status} testID={`perps-pro-transaction-${status}`}>
      <Text style={status === 'pending' ? styles.pending : styles.failed}>
        {t(`page.perps.pro.history.status.${status}`)}
      </Text>
      {icon}
    </View>
  );
};

export const PerpsProTransactionHistoryRowView: React.FC<{
  row: PerpsProTransactionHistoryRow;
}> = ({ row }) => {
  const { t } = useTranslation();
  const isDeposit = row.direction === 'deposit';
  const type = isDeposit
    ? t('page.perps.pro.history.deposit')
    : t('page.perps.pro.history.withdraw');
  const signedAmount = isDeposit ? row.amount : `-${row.amount}`;

  return (
    <PerpsProHistoryRowLayout
      details={[
        {
          label: t('page.perps.pro.history.fields.type'),
          value: type,
        },
        {
          label: t('page.perps.pro.history.fields.amount'),
          tone: isDeposit ? 'positive' : 'negative',
          value: formatPerpsProSignedDecimal(
            signedAmount,
            isPerpsProStableAsset(row.asset) ? 2 : 8,
          ),
        },
      ]}
      testID={`perps-pro-history-transaction-${row.key}`}
      time={row.time}
      title={row.asset}
      trailing={
        row.status === 'success' ? undefined : (
          <PerpsProTransactionStatus status={row.status} />
        )
      }
    />
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  status: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginLeft: 12,
  },
  pending: {
    color: colors2024['orange-default'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
  failed: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro',
    fontSize: 12,
    lineHeight: 16,
  },
}));
