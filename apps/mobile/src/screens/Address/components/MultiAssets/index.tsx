import React from 'react';
import { useTranslation } from 'react-i18next';
import { HEADER_CHART_HEIGHT, SWITCH_HEADER_HEIGHT } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AddressList } from './AddressList';
import { Portfolios } from './Portfolios';
import { Tabs } from 'react-native-collapsible-tab-view';
import { isTabsSwiping } from './hooks';

export const MultiAssets = ({}: {
  onUpdateIsDecrease: (isDecrease: boolean) => void;
  onReachTopStatusChange?: (status: boolean) => void;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <Tabs.Container
      containerStyle={styles.container}
      minHeaderHeight={0}
      headerHeight={HEADER_CHART_HEIGHT}
      tabBarHeight={SWITCH_HEADER_HEIGHT - 16}
      pagerProps={{
        onPageScrollStateChanged: event => {
          isTabsSwiping.value = event?.nativeEvent?.pageScrollState !== 'idle';
        },
      }}
      headerContainerStyle={styles.tabBarWrap}>
      <Tabs.Tab label={''} name="address">
        <AddressList />
      </Tabs.Tab>
      <Tabs.Tab
        label={t('page.multiAddressAssets.tabs.portfolio')}
        name="portfolios">
        <Portfolios />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    overflow: 'hidden',
  },
  tabBarWrap: {
    // backgroundColor: 'transparent',
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  tabBar: {
    height: SWITCH_HEADER_HEIGHT - 16,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
  },
  label: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    textTransform: 'none',
    textAlign: 'center',
  },
  indicator: {
    backgroundColor: ctx.colors2024['brand-default'],
    height: 4,
    borderRadius: 100,
  },
}));
