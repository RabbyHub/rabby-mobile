import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { RcNextSearchCC } from '@/assets/icons/common';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Tabs } from 'react-native-collapsible-tab-view';
import { useTranslation } from 'react-i18next';

import { MemeContent } from '../Meme/MemeContent';
import CustomLabel from '../TokenDetail/components/CustomLabel';
import { DynamicCustomMaterialTabBar } from '../TokenDetail/components/CustomTabBar';
import { WatchlistContent } from '../Watchlist/WatchlistContent';

type MarketTabKey = 'watchlist' | 'meme' | 'stock' | 'commodities';

export default function MarketScreen() {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { navigation, setNavigationOptions } = useSafeSetNavigationOptions();
  const { t } = useTranslation();
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

  const renderTabBar = useCallback(
    (props: any) => (
      <DynamicCustomMaterialTabBar
        materialTabBarProps={{
          ...props,
          tabStyle: styles.tabBar,
        }}
        containerStyle={styles.tabsBarContainer}
        indicatorStyle={styles.indicator}
        initialTabItemsLayout={[
          { x: 20, width: 70 },
          { x: 90, width: 80 },
          { x: 170, width: 60 },
          { x: 230, width: 120 },
        ]}
        initPaddingLeft={styles.tabsBarContainer?.paddingLeft ?? 0}
      />
    ),
    [styles.indicator, styles.tabBar, styles.tabsBarContainer],
  );

  const renderWatchlistLabel = useCallback(
    ({ index, indexDecimal }) => (
      <CustomLabel
        index={index}
        indexDecimal={indexDecimal}
        text={t('page.market.tabs.watchlist')}
      />
    ),
    [t],
  );

  const renderMemeLabel = useCallback(
    ({ index, indexDecimal }) => (
      <CustomLabel
        index={index}
        indexDecimal={indexDecimal}
        text={t('page.market.tabs.memecoin')}
      />
    ),
    [t],
  );

  const renderStockLabel = useCallback(
    ({ index, indexDecimal }) => (
      <CustomLabel
        index={index}
        indexDecimal={indexDecimal}
        text={t('page.market.tabs.stock')}
      />
    ),
    [t],
  );

  const renderCommoditiesLabel = useCallback(
    ({ index, indexDecimal }) => (
      <CustomLabel
        index={index}
        indexDecimal={indexDecimal}
        text={t('page.market.tabs.commodities')}
      />
    ),
    [t],
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
        pagerProps={{ scrollEnabled: false }}
        onTabChange={({ tabName }) => {
          setActiveTab(tabName as MarketTabKey);
        }}>
        <Tabs.Tab label={renderWatchlistLabel} name="watchlist">
          <View style={styles.content}>
            <WatchlistContent headerSpacerHeight={0} showSearchEntry={false} />
          </View>
        </Tabs.Tab>
        <Tabs.Tab label={renderMemeLabel} name="meme">
          <View style={styles.content}>
            <MemeContent headerSpacerHeight={0} />
          </View>
        </Tabs.Tab>
        <Tabs.Tab label={renderStockLabel} name="stock">
          <View style={styles.placeholder} />
        </Tabs.Tab>
        <Tabs.Tab label={renderCommoditiesLabel} name="commodities">
          <View style={styles.placeholder} />
        </Tabs.Tab>
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
  },
  placeholder: {
    flex: 1,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
}));
