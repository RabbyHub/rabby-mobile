import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BlurView, BlurViewProps } from '@react-native-community/blur';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { RcNextSearchCC } from '@/assets/icons/common';
import { useShowSearchBottomSheet } from './SeachBottomSheet';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { IS_ANDROID } from '@/core/native/utils';
import { useHomeTabIndex } from '@/hooks/navigation';

const isAndroid = Platform.OS === 'android';

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    globalSearchBar: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: Platform.select({
        ios: 22,
        android: Math.max(22, safeAreaInsets.bottom),
      }),
    },
    fabContainer: {
      // position: 'absolute',
      // bottom: 30,
      // left: 8,
      // right: 8,
      // zIndex: 10,
      // width: 'auto',
      ...Platform.select({
        ios: {
          shadowColor: isLight
            ? 'rgba(55, 56, 63, 0.12)'
            : 'rgba(0, 0, 0, 0.4)',
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
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],

      ...Platform.select({
        ios: {
          shadowColor: isLight
            ? 'rgba(55, 56, 63, 0.12)'
            : 'rgba(0, 0, 0, 0.4)',
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
  }),
);

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

export const GlobalSearchBar = () => {
  const { t } = useTranslation();
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle });

  const [, setShow] = useShowSearchBottomSheet();
  const { openTab } = useBrowser();
  const handlePress: TouchableOpacityProps['onPress'] = e => {
    e.stopPropagation();
    setShow(true);
  };

  const { tabIndex } = useHomeTabIndex();

  if (tabIndex !== 0) return null;

  return (
    <View style={styles.globalSearchBar}>
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
                {IS_ANDROID
                  ? t('page.search.globalSearch.placeHolder')
                  : t('page.search.globalSearch.iosPlaceHolder')}
              </Text>
            </View>
          </LinearGradient>
        </BlurViewOnlyIOSWrapper>
      </TouchableOpacity>
    </View>
  );
};
