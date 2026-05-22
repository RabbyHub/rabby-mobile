import { Tip } from '@/components';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Skeleton } from '@rneui/themed';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, View, ViewStyle } from 'react-native';

type Props = {
  value: React.ReactNode;
  disabled: boolean;
  onPress: () => void;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const RevokeApprovalCard = ({
  value,
  disabled,
  onPress,
  loading,
  style,
}: Props) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeader}>
        <Text style={styles.label}>
          {t('page.transactions.detail.totalApprovedAmount')}
        </Text>
        {loading ? (
          <Skeleton width={80} height={16} />
        ) : (
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        )}
      </View>
      <View style={styles.buttonContainer}>
        <Tip
          placement="top"
          pressableProps={{
            onPress(ctx) {
              ctx.turnOn();
              if (timerRef.current) {
                clearTimeout(timerRef.current);
              }
              timerRef.current = setTimeout(() => {
                ctx.turnOff();
              }, 3000);
            },
          }}
          content={
            disabled ? t('page.transactions.detail.NoApproveNeed') : undefined
          }>
          <Button
            loading={loading}
            disabled={disabled}
            onPress={onPress}
            type="primary"
            title={t('page.transactions.detail.Revoke')}
          />
        </Tip>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    card: {
      paddingTop: 16,
      paddingHorizontal: 20,
      paddingBottom: Math.max(safeAreaInsets.bottom, 36),
      backgroundColor: !isLight
        ? colors2024['neutral-bg-2']
        : colors2024['neutral-bg-1'],
    },
    cardHeader: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    label: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      marginRight: 'auto',
    },
    value: {
      color: colors2024['neutral-body'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
    },
    buttonContainer: {},
  }),
);
