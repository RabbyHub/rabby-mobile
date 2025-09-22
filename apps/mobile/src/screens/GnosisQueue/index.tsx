import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { PillsSwitch } from '@/components2024/PillSwitch';
import { useGnosisQueueTotalPending } from '@/hooks/gnosis/useGnosisQueueTotalPending';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GnosisMessageQueue } from './components/GnosisMessageQueue';
import { GnosisTransactionQueue } from './components/GnosisTransactionQueue';
import { useRoute } from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';

export const GnosisQueueScreen = () => {
  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        'GnosisTransactionQueue'
      >
    >();
  const account = route.params.account;
  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
  const { t } = useTranslation();
  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const { bottom } = useSafeAreaInsets();

  const { messages, pendingTxs, total } = useGnosisQueueTotalPending({
    address: account?.address,
  });

  const tabs = useMemo(() => {
    return [
      {
        label: `Transaction (${pendingTxs?.total || 0})`,
        key: 'transaction' as const,
      },
      {
        label: `Message (${messages?.total || 0})`,
        key: 'message' as const,
      },
    ];
  }, [pendingTxs?.total, messages?.total]);

  const [activeKey, setActiveKey] = useState<'transaction' | 'message'>(
    tabs[0]?.key,
  );

  useEffect(() => {
    setNavigationOptions({
      headerTitle: t('page.safeQueue.title', {
        total: total,
      }),
    });
  }, [setNavigationOptions, t, total]);

  return (
    <NormalScreenContainer
      style={[
        {
          paddingBottom: bottom,
        },
        styles.container,
      ]}>
      <View style={styles.header}>
        <PillsSwitch
          options={tabs}
          value={activeKey}
          onTabChange={setActiveKey}
        />
      </View>
      <View style={styles.body}>
        {activeKey === 'transaction' ? (
          <GnosisTransactionQueue account={account} />
        ) : (
          <GnosisMessageQueue account={account} />
        )}
      </View>
    </NormalScreenContainer>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    flexDirection: 'column',
    paddingBottom: 20,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  body: {
    flex: 1,
  },
}));
