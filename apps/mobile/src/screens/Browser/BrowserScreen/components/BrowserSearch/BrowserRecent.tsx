import React, { useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';

import { RcIconDynamicArrowDownCC } from '@/assets/icons/dapp';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-history-empty-dark.svg';
import RcIconEmpty from '@/assets/icons/dapp/dapp-history-empty.svg';
import { DappInfo } from '@/core/services/dappService';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useTheme2024 } from '@/hooks/theme';
import { BrowserSiteCard } from '@/screens/Browser/components/BrowserSiteCard';
import { createGetStyles2024 } from '@/utils/styles';

export function BrowserRecent({ onPress }: { onPress?(dapp: DappInfo): void }) {
  const { colors2024, styles, isLight } = useTheme2024({
    getStyle,
  });

  const { browserHistoryList } = useBrowserHistory();

  const list = useMemo(() => {
    return browserHistoryList.slice(0, 3);
  }, [browserHistoryList]);

  return (
    <FlatList
      data={list}
      style={styles.list}
      keyExtractor={item => item.url || item.origin}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => (
        <BrowserSiteCard data={item} onPress={onPress} />
      )}
      ListHeaderComponent={
        list?.length ? (
          <View style={styles.header}>
            <Text style={styles.title}>Recent</Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <View style={styles.emptyContent}>
            {isLight ? (
              <RcIconEmpty style={styles.emptyIcon} />
            ) : (
              <RcIconEmptyDark style={styles.emptyIcon} />
            )}
            <Text style={styles.emptyText}>{'Starting Exploring Website'}</Text>
          </View>
          <RcIconDynamicArrowDownCC color={colors2024['neutral-line']} />
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

  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    paddingTop: 32,
  },
  emptyContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  emptyIcon: {
    width: 163,
    height: 126,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-info'],
    textAlign: 'center',
  },
}));
