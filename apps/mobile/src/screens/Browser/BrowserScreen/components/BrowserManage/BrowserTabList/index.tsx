import { Tab } from '@/core/services/browserService';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useMemoizedFn, useMount } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { ListRenderItem, StyleProp, View, ViewStyle } from 'react-native';
import { BrowserTabCard } from './BrowserTabCard';
// import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useRef } from 'react';
import { BrowserTabEmpty } from './BrowserTabEmpty';
import {
  BottomSheetFlatList,
  BottomSheetFlatListMethods,
} from '@gorhom/bottom-sheet';
import { matomoRequestEvent } from '@/utils/analytics';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';

export const BrowserTabList = ({ style }: {} & RNViewProps) => {
  const { colors2024, styles, isLight } = useTheme2024({
    getStyle,
  });
  const {
    displayedTabs,
    activeTabId,
    switchToTab,
    closeTab,
    setPartialBrowserState,
  } = useBrowser();
  const { t } = useTranslation();
  // const navigation = useRabbyAppNavigation();

  const renderItem: ListRenderItem<Tab> = useMemoizedFn(({ item, index }) => {
    return (
      <View
        style={[
          {
            width: '50%',
            position: 'relative',
          },
          index % 2 === 0
            ? {
                paddingRight: 3,
              }
            : {
                paddingLeft: 3,
              },
        ]}>
        <BrowserTabCard
          tab={item}
          isActive={activeTabId === item.id}
          onPress={tab => {
            switchToTab(tab.id);
            const origin = safeGetOrigin(tab.url || tab.initialUrl);
            if (origin) {
              matomoRequestEvent({
                category: 'Websites Usage',
                action: 'Website_Visit_Website Tab',
                label: origin,
              });
            }
          }}
          onPressClose={tab => {
            if (displayedTabs.length === 1) {
              setPartialBrowserState({
                isShowBrowser: false,
              });
            }
            closeTab(tab.id);
          }}
        />
      </View>
    );
  });
  const ref = useRef<BottomSheetFlatListMethods>(null);
  useMount(() => {
    setTimeout(() => {
      const index = displayedTabs.findIndex(item => item.id === activeTabId);
      if (index !== -1) {
        ref.current?.scrollToIndex({
          index: Math.floor(index / 2),
          animated: false,
        });
      }
    }, 50);
  });

  return (
    <View style={[styles.container, style]}>
      <BottomSheetFlatList
        style={styles.tabList}
        data={displayedTabs}
        renderItem={renderItem}
        numColumns={2}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={ItemSeparatorComponent}
        showsVerticalScrollIndicator={false}
        ref={ref}
        getItemLayout={(data, index) => ({
          length: 210,
          offset: 210 * index,
          index,
        })}
        contentContainerStyle={
          !displayedTabs.length ? styles.contentContainerStyle : null
        }
        ListEmptyComponent={BrowserTabEmpty}
      />
    </View>
  );
};

const ItemSeparatorComponent = () => <View style={{ height: 12 }} />;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    gap: 12,
    position: 'relative',
    height: '100%',
  },
  contentContainerStyle: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  tabList: {
    paddingHorizontal: 14,
  },
}));
