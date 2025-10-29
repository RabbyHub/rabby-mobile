import React, { useCallback } from 'react';
import { Dimensions } from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import SupplyPoolList from './SupplyPoolList';
import BorrowPoolList from './BorrowPoolList';
import { DynamicCustomMaterialTabBar } from '../TokenDetail/components/CustomTabBar';
import CustomLabel from '../TokenDetail/components/CustomLabel';
import { useTranslation } from 'react-i18next';

const screenWidth = Dimensions.get('window').width;

const PoolContainer = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const renderSupplyLabel = useCallback(
    ({ index, indexDecimal }) => (
      <CustomLabel
        activeColor={colors2024['neutral-title-1']}
        inactiveColor={colors2024['neutral-secondary']}
        activeFontWeight="800"
        inactiveFontWeight="700"
        activeFontSize={18}
        inactiveFontSize={17}
        index={index}
        indexDecimal={indexDecimal}
        text={t('page.Lending.supplyDetail.actions')}
      />
    ),
    [colors2024, t],
  );
  const renderBorrowLabel = useCallback(
    ({ index, indexDecimal }) => (
      <CustomLabel
        activeColor={colors2024['neutral-title-1']}
        inactiveColor={colors2024['neutral-secondary']}
        activeFontWeight="800"
        inactiveFontWeight="700"
        activeFontSize={18}
        inactiveFontSize={17}
        index={index}
        indexDecimal={indexDecimal}
        text={t('page.Lending.borrowDetail.actions')}
      />
    ),
    [colors2024, t],
  );
  const renderTabBar = React.useCallback(
    (_props: any) => (
      <DynamicCustomMaterialTabBar
        materialTabBarProps={{
          ..._props,
          tabStyle: styles.tabBar,
        }}
        containerStyle={styles.tabsBarContainer}
        indicatorStyle={styles.indicator}
        initialTabItemsLayout={[
          {
            x: 20,
            width: 100,
          },
          {
            x: 120,
            width: 120,
          },
        ]}
        initPaddingLeft={styles.tabsBarContainer?.paddingLeft ?? 0}
      />
    ),
    [styles.indicator, styles.tabBar, styles.tabsBarContainer],
  );
  return (
    <Tabs.Container
      renderTabBar={renderTabBar}
      tabBarHeight={30}
      minHeaderHeight={0}
      containerStyle={styles.container}
      headerContainerStyle={styles.tabBarWrap}>
      <Tabs.Tab label={renderSupplyLabel} name="supply">
        <SupplyPoolList />
      </Tabs.Tab>
      <Tabs.Tab label={renderBorrowLabel} name="borrow">
        <BorrowPoolList />
      </Tabs.Tab>
    </Tabs.Container>
  );
};

export default PoolContainer;

const getStyles = createGetStyles2024(({ isLight, colors2024 }) => ({
  rootScreenContainer: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },

  riskContainer: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  container: {
    flex: 1,
    width: '100%',
    marginTop: 24,
  },
  innerContainer: {
    height: '100%',
    paddingTop: 30,
  },
  buttonGroup: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    width: '100%',
    position: 'absolute',
    bottom: 0,
    // display: 'flex',
    gap: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 50,
  },

  btnContainer: {
    flex: 1,
  },

  ghostBtn: {
    // borderWidth: 1.5,
    backgroundColor: colors2024['brand-light-1'],
  },
  btnInnerContainer: {
    borderRadius: 12,
  },
  searchTokenDanger: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
    width: '100%',
    padding: 8,
    backgroundColor: colors2024['red-light-1'],
    borderRadius: 8,
    // marginTop: 12,
  },
  tokenRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  searchTokenWarning: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
    width: '100%',
    padding: 8,
    backgroundColor: colors2024['orange-light-1'],
    borderRadius: 8,
    // marginTop: 12,
  },

  searchTokenWarningText: {
    color: colors2024['orange-default'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  searchTokenDangerText: {
    color: colors2024['red-default'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  headerBalanceCard: {
    marginTop: 12,
    marginHorizontal: 18,
  },
  tabBarWrap: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
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
    overflow: 'hidden',
  },
  indicator: {
    backgroundColor: colors2024['neutral-body'],
    height: 4,
    borderRadius: 100,
  },
  skeleton: {
    marginTop: 12,
    width: screenWidth - 32,
    height: 200,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  klineContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
}));
