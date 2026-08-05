import { useRoute } from '@react-navigation/native';
import React from 'react';
import { View } from 'react-native';

import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useEnsurePerpsRuntime } from '@/hooks/perps/runtime/useEnsurePerpsRuntime';
import type { GetNestedScreenRouteProp } from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

import { PerpsProHistoryList } from './components/PerpsProHistoryList';
import { PerpsProHistoryTabs } from './components/PerpsProHistoryTabs';
import { usePerpsProHistoryController } from './scene/usePerpsProHistoryController';
import type { PerpsProHistoryTab } from './types';

const isHistoryTab = (value: unknown): value is PerpsProHistoryTab =>
  value === 'orders' ||
  value === 'trade' ||
  value === 'transaction' ||
  value === 'funding';

export const PerpsProHistoryScreen = () => {
  useEnsurePerpsRuntime();
  const { styles } = useTheme2024({ getStyle });
  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        'PerpsProHistory'
      >
    >();
  const initialTab = isHistoryTab(route.params?.initialTab)
    ? route.params.initialTab
    : 'orders';
  const history = usePerpsProHistoryController(initialTab);

  return (
    <NormalScreenContainer2024 type="bg1">
      <View style={styles.container}>
        <PerpsProHistoryTabs
          activeTab={history.activeTab}
          onChange={history.setActiveTab}
        />
        <View style={styles.list}>
          <PerpsProHistoryList
            onLoadEarlier={history.loadEarlier}
            onRefresh={history.refresh}
            onRetry={() => history.refresh()}
            state={history.tabState}
            tab={history.activeTab}
          />
        </View>
      </View>
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(() => ({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
}));

export type { PerpsProHistoryTab } from './types';
