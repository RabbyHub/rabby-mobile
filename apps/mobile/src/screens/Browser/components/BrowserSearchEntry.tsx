import { useBrowser, useHomeDisplayedTabs } from '@/hooks/browser/useBrowser';
import { useTheme2024 } from '@/hooks/theme';
import { matomoRequestEvent } from '@/utils/analytics';
import { createGetStyles2024 } from '@/utils/styles';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { BlurView, BlurViewProps } from '@react-native-community/blur';
import { useMemoizedFn } from 'ahooks';
import { useAtom } from 'jotai';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { activeTabAtom } from '../BrowserScreen/components/BrowserManage';
import { BrowserTabCard } from '../BrowserScreen/components/BrowserManage/BrowserTabList/BrowserTabCard';

const isAndroid = Platform.OS === 'android';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  fabContainer: {
    paddingHorizontal: 12,
    paddingBottom: 20,
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
    paddingRight: 12,
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
    marginTop: 12,
    flex: 1,
  },

  tabContainerSmall: {
    width: '50%',
  },

  tabContainer: {
    marginBottom: 18,
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
    padding: 6,
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

  browserTabPlaceholder: {
    height: 20,
  },
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
    browserState,
    setPartialBrowserState,
    displayedTabs,
    forceShowBrowser,
    forceShowBrowserManage,
    closeTab,
    switchToTab,
    openTab,
    setBrowserState,
  } = useBrowser();

  const { homeDisplayedTabs: tabs } = useHomeDisplayedTabs();
  const [, setActiveTab] = useAtom(activeTabAtom);

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
    if (!displayedTabs?.length) {
      setActiveTab('favorites');
    }
    setPartialBrowserState({
      isShowBrowser: false,
      isShowSearch: false,
      isShowManage: true,
      searchText: '',
      searchTabId: '',
    });
    forceShowBrowserManage();
  });

  if (!tabs.length) {
    return null;
  }

  return (
    <View style={styles.container}>
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
                      const origin = safeGetOrigin(tab.url || tab.initialUrl);
                      if (origin) {
                        matomoRequestEvent({
                          category: 'Websites Usage',
                          action: 'Website_Visit_Home Tab',
                          label: origin,
                        });
                      }
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
    </View>
  );
};
