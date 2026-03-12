import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { RcNextSearchCC } from '@/assets/icons/common';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Tabs } from 'react-native-collapsible-tab-view';
import { useTranslation } from 'react-i18next';

import CustomLabel from '../TokenDetail/components/CustomLabel';
import { DynamicCustomMaterialTabBar } from '../TokenDetail/components/CustomTabBar';
import { WatchlistContent } from '../Watchlist/WatchlistContent';
import { MarketCategoryContent } from './components/MarketCategoryContent';
import { useTokenMarketCategoryList } from './hooks/useTokenMarketCategoryList';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';

type MarketTabKey = 'watchlist' | string;

export default function MarketScreen() {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
  const { categories } = useTokenMarketCategoryList();
  const [activeTab, setActiveTab] = useState<MarketTabKey>('watchlist');

  const renderHeaderRight = useCallback(
    () => (
      <Pressable
        hitSlop={10}
        style={styles.headerRight}
        onPress={() => {
          navigation.navigateDeprecated(RootNames.StackHomeNonTab, {
            screen: RootNames.Search,
            params: {},
          });
        }}>
        <RcNextSearchCC
          width={20}
          height={20}
          color={colors2024['neutral-title-1']}
        />
      </Pressable>
    ),
    [colors2024, navigation, styles.headerRight],
  );

  useEffect(() => {
    setNavigationOptions({
      headerRight: renderHeaderRight,
    });
  }, [renderHeaderRight, setNavigationOptions]);

  const tabs = useMemo(
    () => [
      {
        key: 'watchlist',
        label: t('page.market.tabs.watchlist'),
      },
      ...categories.map(category => ({
        key: category.id,
        label: category.name,
        sortFields: category.sort_fields,
      })),
    ],
    [categories, t],
  );

  const initialTabItemsLayout = useMemo(() => {
    let x = 20;
    return tabs.map(tab => {
      const width = Math.max(60, tab.label.length * 12 + 20);
      const item = { x, width };
      x += width;
      return item;
    });
  }, [tabs]);

  const renderTabBar = useCallback(
    (props: any) => (
      <DynamicCustomMaterialTabBar
        materialTabBarProps={{
          ...props,
          tabStyle: styles.tabBar,
        }}
        containerStyle={styles.tabsBarContainer}
        indicatorStyle={styles.indicator}
        initialTabItemsLayout={initialTabItemsLayout}
        initPaddingLeft={styles.tabsBarContainer?.paddingLeft ?? 0}
      />
    ),
    [
      initialTabItemsLayout,
      styles.indicator,
      styles.tabBar,
      styles.tabsBarContainer,
    ],
  );

  const renderWatchlistLabel = useCallback(
    ({ index, indexDecimal }) => (
      <CustomLabel
        index={index}
        indexDecimal={indexDecimal}
        text=""
        icon={
          <RcIconFavorite
            width={18}
            height={18}
            color={
              Math.abs(index - indexDecimal.value) < 0.5
                ? colors2024['orange-default']
                : colors2024['neutral-secondary']
            }
          />
        }
      />
    ),
    [colors2024],
  );

  return (
    <NormalScreenContainer2024
      type={isLight ? 'bg0' : 'bg1'}
      overwriteStyle={styles.overwriteStyle}>
      <Tabs.Container
        renderTabBar={renderTabBar}
        tabBarHeight={30}
        containerStyle={styles.container}
        headerContainerStyle={styles.tabBarWrap}
        initialTabName={activeTab}
        onTabChange={({ tabName }) => {
          setActiveTab(tabName);
        }}>
        <Tabs.Tab label={renderWatchlistLabel} name="watchlist">
          <WatchlistContent headerSpacerHeight={0} />
        </Tabs.Tab>
        {
          (categories ?? []).map(category => {
            const renderCategoryLabel = ({ index, indexDecimal }) => (
              <CustomLabel
                index={index}
                indexDecimal={indexDecimal}
                text={category.name}
              />
            );

            return (
              <Tabs.Tab
                key={category.id}
                label={renderCategoryLabel}
                name={category.id}>
                <View style={styles.content}>
                  <MarketCategoryContent
                    categoryId={category.id}
                    sortFields={category.sort_fields}
                    headerSpacerHeight={0}
                  />
                </View>
              </Tabs.Tab>
            );
          }) as unknown as React.ReactElement
        }
      </Tabs.Container>
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  overwriteStyle: {
    position: 'relative',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  container: {
    flex: 1,
  },
  headerRight: {
    paddingRight: 4,
    paddingVertical: 4,
  },
  tabBarWrap: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  tabBar: {
    height: 30,
    width: 'auto',
    flexShrink: 0,
    flex: 0,
    paddingHorizontal: 0,
    marginRight: 20,
  },
  tabsBarContainer: {
    display: 'flex',
    paddingLeft: 20,
    position: 'relative',
    height: 30,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    overflow: 'hidden',
  },
  indicator: {
    backgroundColor: colors2024['neutral-body'],
    height: 4,
    borderRadius: 100,
  },
  content: {
    flex: 1,
    marginTop: 8,
  },
}));
