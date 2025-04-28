import { SWITCH_HEADER_HEIGHT } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Pressable, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
export const enum TabType {
  portfolio = 'portfolio',
  address = 'address',
}

interface IProps {
  currentTab: TabType;
  addressLength?: number;
  onChangeTab: (tab: TabType) => void;
}
export const SwitchHeader = ({
  currentTab,
  onChangeTab,
  addressLength,
}: IProps) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const windowWidth = Dimensions.get('window').width;
  const addressStyle = useMemo(() => {
    return {
      left: Math.floor(((windowWidth - 32) / 2 - 110) / 2),
      width: 110,
    };
  }, [windowWidth]);
  const portfolioStyle = useMemo(() => {
    const singleBlock = (windowWidth - 32) / 2;
    return {
      left: Math.floor(singleBlock + (singleBlock - 80) / 2),
      width: 80,
    };
  }, [windowWidth]);
  const tabLineLeft = useSharedValue(addressStyle.left);
  const tabLineWidth = useSharedValue(addressStyle.width);
  useEffect(() => {
    tabLineLeft.value = withTiming(
      Math.floor(
        currentTab === TabType.portfolio
          ? portfolioStyle.left
          : addressStyle.left,
      ),
      {
        duration: 200,
        easing: Easing.linear,
      },
    );
    tabLineWidth.value = withTiming(
      currentTab === TabType.portfolio
        ? portfolioStyle.width
        : addressStyle.width,
      {
        duration: 200,
        easing: Easing.linear,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, portfolioStyle]);

  const tabLineStyle = useAnimatedStyle(() => {
    return {
      left: tabLineLeft.value,
      width: tabLineWidth.value,
    };
  }, [currentTab]);

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <Pressable
          style={[
            styles.tabContainer,
            currentTab === TabType.address && styles.activeTabContainer,
          ]}
          onPress={() => onChangeTab(TabType.address)}>
          <Text
            style={[
              styles.tab,
              currentTab === TabType.address && styles.activeTab,
            ]}>
            {t('page.multiAddressAssets.tabs.address')}
            {addressLength ? `(${addressLength})` : ''}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tabContainer,
            currentTab === TabType.portfolio && styles.activeTabContainer,
          ]}
          onPress={() => onChangeTab(TabType.portfolio)}>
          <Text
            style={[
              styles.tab,
              currentTab === TabType.portfolio && styles.activeTab,
            ]}>
            {t('page.multiAddressAssets.tabs.portfolio')}
          </Text>
        </Pressable>

        <Animated.View style={[styles.tabBottomLine, tabLineStyle]} />
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  tabs: {
    flexDirection: 'row',
    alignContent: 'flex-start',
    width: '100%',
    gap: 4,
    borderRadius: 12,
    position: 'relative',
  },
  tab: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  tabContainer: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 13,
    paddingVertical: 6,
    paddingTop: 0,
  },
  activeTabContainer: {
    // borderRadius: 8,
  },
  activeTab: {
    color: colors2024['neutral-title-1'],
  },
  tabBottomLine: {
    height: 5,
    backgroundColor: colors2024['brand-default'],
    position: 'absolute',
    bottom: 1,
    borderRadius: 100,
  },
  container: {
    flexDirection: 'row',
    height: SWITCH_HEADER_HEIGHT - 16,
    marginTop: 16,
    justifyContent: 'space-between',
    alignContent: 'flex-start',
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  chainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chainFilterItem: {
    backgroundColor: 'transparent',
  },
  countChain: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  icon: {
    transform: [{ rotate: '90deg' }],
  },
  right: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
