import React from 'react';
import { FlatList, Text, View } from 'react-native';

import { DappInfo } from '@/core/services/dappService';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useTheme2024 } from '@/hooks/theme';
import { BrowserSiteCard } from '@/screens/Browser/components/BrowserSiteCard';
import { createGetStyles2024 } from '@/utils/styles';

export function BrowserRecent({ onPress }: { onPress?(dapp: DappInfo): void }) {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const { browserHistoryList } = useBrowserHistory();

  return (
    <FlatList
      data={browserHistoryList.slice(0, 3)}
      style={styles.list}
      keyExtractor={item => item.url || item.origin}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => (
        <BrowserSiteCard data={item} onPress={onPress} />
      )}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Recent</Text>
        </View>
      }
    />
  );
}
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-0'],
  },
  list: {
    paddingHorizontal: 20,
  },
  header: {
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  title: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
}));
