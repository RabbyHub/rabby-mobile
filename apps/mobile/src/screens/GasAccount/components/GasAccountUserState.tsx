import { Button } from '@/components2024/Button';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleProp, View, ViewStyle } from 'react-native';
import { GasAccountBalanceCard } from './GasAccountBalanceCard';
import { GasAccountHistory } from './History';
import { GasAccountWarning } from './GasAccountWarning';
import type { useGasAccountHistory } from '../hooks';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TEXT_SIZE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';

type GasAccountHistoryState = ReturnType<typeof useGasAccountHistory>;

export const GasAccountUserState: React.FC<{
  balance?: number | string | null;
  historyState: GasAccountHistoryState;
  onDepositPress?(): void;
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
  warningMessage?: string;
}> = ({
  balance,
  historyState,
  onDepositPress,
  isLoading,
  style,
  warningMessage,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.topContent}>
        <GasAccountWarning
          balance={balance}
          style={styles.warning}
          message={warningMessage}
        />
        <GasAccountBalanceCard balance={balance} style={styles.balanceCard} />
        <View style={styles.historyWrapper}>
          <GasAccountHistory
            historyState={historyState}
            style={styles.historyCard}
            listStyle={styles.historyList}
          />
        </View>
      </View>
      <View style={styles.footer}>
        <Button
          type="primary"
          loading={isLoading}
          onPress={onDepositPress}
          containerStyle={styles.primaryButton}
          title={
            <Text style={styles.primaryButtonText}>
              {t('page.gasAccount.depositNow')}
            </Text>
          }
        />
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  container: {
    width: '100%',
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
  },
  topContent: {
    flex: 1,
    minHeight: 0,
    gap: 12,
  },
  warning: {
    marginHorizontal: 0,
  },
  balanceCard: {
    marginHorizontal: 0,
  },
  historyCard: {
    marginHorizontal: 0,
    marginBottom: 0,
  },
  historyWrapper: {
    flex: 1,
    minHeight: 0,
  },
  historyList: {
    flex: 1,
  },
  footer: {
    paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
  },
  primaryButton: {
    width: 345,
    alignSelf: 'center',
    height: BOTTOM_BUTTON_SINGLE_HEIGHT,
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#7084ff',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 8,
    },
  },
  primaryButtonText: {
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
    fontSize: BOTTOM_BUTTON_TEXT_SIZE,
    fontWeight: '700',
    lineHeight: 22,
  },
}));
