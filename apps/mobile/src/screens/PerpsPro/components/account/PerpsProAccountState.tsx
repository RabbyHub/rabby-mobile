import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProAccountPanelState } from '../../scene/usePerpsProInfoPanel';
import { PerpsProAccountSkeleton } from './PerpsProAccountSkeleton';

export const PerpsProAccountState: React.FC<{
  onRetry: () => void;
  state: Exclude<PerpsProAccountPanelState, 'ready'>;
}> = React.memo(({ onRetry, state }) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  if (state === 'loading') {
    return <PerpsProAccountSkeleton />;
  }

  const title =
    state === 'noAccount'
      ? t('page.perps.pro.account.selectAccount')
      : t('page.perps.pro.account.loadFailed');
  const description =
    state === 'noAccount'
      ? t('page.perps.pro.account.selectAccountDescription')
      : t('page.perps.pro.account.loadFailedDescription');

  return (
    <View style={styles.container} testID={`perps-pro-account-state-${state}`}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {state === 'error' ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.action}>
          <Text style={styles.actionText}>
            {t('page.perps.pro.common.retry')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

PerpsProAccountState.displayName = 'PerpsProAccountState';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 176,
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
  description: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    textAlign: 'center',
  },
  action: {
    alignItems: 'center',
    backgroundColor: colors2024['brand-default'],
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    marginTop: 16,
    minWidth: 96,
    paddingHorizontal: 16,
  },
  actionText: {
    color: colors2024['neutral-bg-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
}));
