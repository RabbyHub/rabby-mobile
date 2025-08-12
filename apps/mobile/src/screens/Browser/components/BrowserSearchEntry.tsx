import { RcNextSearchCC } from '@/assets/icons/common';
import { RcIconTabsCC } from '@/assets2024/icons/browser';
import { useBrowser, useHomeDisplayedTabs } from '@/hooks/browser/useBrowser';
import { useTheme2024 } from '@/hooks/theme';
import { matomoRequestEvent } from '@/utils/analytics';
import { createGetStyles2024 } from '@/utils/styles';
import { BlurView, BlurViewProps } from '@react-native-community/blur';
import { useMemoizedFn } from 'ahooks';
import { sortBy } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { BrowserTabCard } from '../BrowserScreen/components/BrowserManage/BrowserTabList/BrowserTabCard';
import { ViewStyle } from 'react-native-size-matters';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';

const isAndroid = Platform.OS === 'android';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  fabContainer: {
    // position: 'absolute',
    // bottom: 30,
    // left: 8,
    // right: 8,
    // zIndex: 10,
    // width: 'auto',
    ...Platform.select({
      ios: {
        shadowColor: isLight ? 'rgba(55, 56, 63, 0.12)' : 'rgba(0, 0, 0, 0.4)',
        shadowOffset: { width: 0, height: isLight ? -6 : -27 },
        shadowOpacity: 1,
        shadowRadius: isLight ? 20 : 13,
      },
      android: {},
    }),
  },
  gradient: {
    padding: 12,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-5'],
  },
  innerCircle: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    position: 'relative',
    paddingLeft: 12,
    paddingRight: 9,
  },
  icon: {},
  text: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    flex: 1,
    textAlign: 'center',
    color: colors2024['neutral-foot'],
  },
  navControlItem: {
    flexShrink: 0,
  },
  tabIconContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  tabCountContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,

    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCount: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '700',
  },

  container: {
    paddingHorizontal: 15,
    marginTop: 12,
    flex: 1,
  },
  empty: {
    flex: 1,
  },
  tabContainerSmall: {
    width: '50%',
  },
  tabContainer: {
    marginTop: 18,
    marginBottom: 30,
    borderRadius: 20,
    padding: 6,
    backgroundColor: colors2024['neutral-bg-1'],

    ...Platform.select({
      ios: {
        shadowColor: isLight ? 'rgba(55, 56, 63, 0.12)' : 'rgba(0, 0, 0, 0.4)',
        shadowOffset: { width: 0, height: isLight ? -6 : -27 },
        shadowOpacity: 1,
        shadowRadius: isLight ? 20 : 13,
      },
      android: {},
    }),
  },
  tabContainerInner: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  tabItemContainer: {
    width: '50%',
    // flexShrink: 0,
    padding: 2,
  },
  tabItemContainerSmall: {
    width: '100%',
  },
  tabItem: {},
}));

const BlurViewOnlyIOSWrapper = ({
  children,
  isLight,
  blurAmount = 29,
  borderRadius = 20,
  style,
}: {
  children: React.ReactNode;
  blurAmount?: number;
  isLight?: boolean;
  borderRadius?: number;
  style?: BlurViewProps['style'];
}) => {
  const { colors2024 } = useTheme2024({ getStyle });
  if (isAndroid) {
    return (
      <View
        style={{ borderRadius, backgroundColor: colors2024['neutral-bg-1'] }}>
        {children}
      </View>
    );
  }
  return (
    <BlurView
      style={[{ borderRadius }, style]}
      blurAmount={blurAmount}
      blurType={isLight ? 'light' : 'dark'}
      reducedTransparencyFallbackColor="white">
      {children}
    </BlurView>
  );
};

export const BrowserSearchEntry: React.FC = () => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const {
    setPartialBrowserState,
    displayedTabs,
    forceShowBrowser,
    forceShowBrowserManage,
    closeTab,
    switchToTab,
  } = useBrowser();

  const tabs = useHomeDisplayedTabs();

  const { t } = useTranslation();
  const handlePress = useMemoizedFn(() => {
    setPartialBrowserState({
      isShowBrowser: true,
      isShowSearch: true,
      searchText: '',
      searchTabId: '',
      trigger: 'home',
    });
    forceShowBrowser();
  });

  const handleTabPress = useMemoizedFn(() => {
    setPartialBrowserState({
      isShowBrowser: false,
      isShowSearch: false,
      isShowManage: true,
      searchText: '',
      searchTabId: '',
    });
    forceShowBrowserManage();
  });

  return (
    <View style={styles.container}>
      {tabs.length ? (
        <View
          style={[
            styles.tabContainer,
            tabs.length === 1 ? styles.tabContainerSmall : null,
          ]}>
          <BlurViewOnlyIOSWrapper
            isLight={isLight}
            blurAmount={14.5}
            borderRadius={20}>
            <View style={styles.tabContainerInner}>
              {tabs.map(tab => {
                return (
                  <View
                    style={[
                      styles.tabItemContainer,
                      tabs.length === 1 ? styles.tabItemContainerSmall : null,
                    ]}
                    key={tab.id}>
                    <BrowserTabCard
                      containerStyle={styles.tabItem}
                      tab={tab}
                      onPress={() => {
                        switchToTab(tab.id);
                        matomoRequestEvent({
                          category: 'Websites Usage',
                          action: 'Website_Visit_Home Tab',
                          label: safeGetOrigin(tab.url || tab.initialUrl),
                        });
                      }}
                      onPressClose={() => {
                        closeTab(tab.id);
                      }}
                    />
                  </View>
                );
              })}
            </View>
          </BlurViewOnlyIOSWrapper>
        </View>
      ) : (
        <View style={styles.empty} />
      )}
      <TouchableOpacity style={styles.fabContainer} onPress={handlePress}>
        <BlurViewOnlyIOSWrapper
          isLight={isLight}
          blurAmount={14.5}
          borderRadius={20}>
          <LinearGradient
            colors={
              isLight
                ? ['rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.4)']
                : ['rgba(19, 20, 22, 1)', 'rgba(19, 20, 22, 0.8)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}>
            <View style={styles.innerCircle}>
              <RcNextSearchCC
                width={20}
                height={20}
                style={styles.icon}
                color={colors2024['neutral-secondary']}
              />
              <Text style={styles.text}>
                {t('page.browser.BrowserSearchEntry.openWebsites')}
              </Text>
              <TouchableOpacity
                style={[styles.navControlItem]}
                onPress={handleTabPress}>
                <View style={styles.tabIconContainer}>
                  <RcIconTabsCC
                    color={colors2024['neutral-body']}
                    width={24}
                    height={24}
                  />
                  <View style={styles.tabCountContainer}>
                    <Text style={styles.tabCount}>
                      {displayedTabs?.length || 0}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </BlurViewOnlyIOSWrapper>
      </TouchableOpacity>
    </View>
  );
};
