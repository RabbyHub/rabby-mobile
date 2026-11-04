import { RcIconJumpCC } from '@/assets/icons/common';
import { Text } from '@/components/Typography';
import { storeApiAccounts } from '@/hooks/account';
import { useEnablePerpsWatchAddress } from '@/hooks/appSettings';
import { useBrowser } from '@/hooks/browser/useBrowser';
import {
  navigateToPerpsHome,
  navigateToPreferredPerps,
} from '@/hooks/perps/navigation/navigateToPreferredPerps';
import { useTheme2024 } from '@/hooks/theme';
import { useDapps } from '@/hooks/useDapps';
import { naviPush } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { colord } from 'colord';
import { IS_IOS } from '@/core/native/utils';
import { TouchableOpacity } from 'react-native-gesture-handler';
import {
  HYPERLIQUID_APP_ORIGIN,
  resolveHyperliquidPerpsAccount,
} from './hyperliquidPerpsAccount';

const PERPS_NAVIGATION = { push: naviPush };
const SOURCE = 'browser-hyperliquid-entry';

export const HyperliquidPerpsEntry = () => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { setPartialBrowserState } = useBrowser();
  const { dapps } = useDapps();
  const { enablePerpsWatchAddress } = useEnablePerpsWatchAddress();

  const handlePress = useMemoizedFn(() => {
    const account = resolveHyperliquidPerpsAccount({
      dapp: dapps[HYPERLIQUID_APP_ORIGIN],
      accounts: storeApiAccounts.getAccounts(),
      enablePerpsWatchAddress,
    });

    // Same as pulling the sheet down: keep the tab so the user can come back.
    setPartialBrowserState({
      isShowBrowser: false,
      isShowSearch: false,
      searchText: '',
      searchTabId: '',
      trigger: '',
    });

    if (account) {
      void navigateToPreferredPerps({
        account,
        navigation: PERPS_NAVIGATION,
        source: SOURCE,
      });
    } else {
      void navigateToPerpsHome({
        navigation: PERPS_NAVIGATION,
        source: SOURCE,
      });
    }
  });

  return (
    <TouchableOpacity onPress={handlePress} hitSlop={5} activeOpacity={1}>
      <View style={styles.container}>
        {IS_IOS ? (
          <>
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType={isLight ? 'light' : 'dark'}
              blurAmount={5}
              reducedTransparencyFallbackColor={
                isLight
                  ? colors2024['neutral-bg-1']
                  : colors2024['neutral-bg-2']
              }
            />
            <View style={styles.tint} />
          </>
        ) : null}
        <Text style={styles.text} numberOfLines={1}>
          {t('page.browser.openInRabbyPerps')}
        </Text>
        <RcIconJumpCC
          width={14}
          height={14}
          strokeWidth={7 / 6}
          color={colors2024['neutral-body']}
        />
      </View>
    </TouchableOpacity>
  );
};

// Figma: a translucent tint over a 4.5px backdrop blur. The tint alone is
// see-through (dark neutral-bg-5 is 50% alpha), so it is only used on top of
// the iOS BlurView; Android has no blur and uses opaque colors instead, like
// BrowserSearchEntry.
const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  const tint = isLight
    ? colord(colors2024['neutral-bg-1']).alpha(0.6).toRgbString()
    : colors2024['neutral-bg-5'];
  const androidBackground = isLight
    ? colors2024['neutral-bg-1']
    : colors2024['neutral-bg-2'];

  return {
    container: {
      // Same height as the actions capsule (handle row 40 - bottom padding 7).
      height: 33,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 15,
      borderRadius: 19,
      overflow: 'hidden',
      backgroundColor: IS_IOS ? 'transparent' : androidBackground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors2024['neutral-contrast'],
    },
    tint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: tint,
    },
    text: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['neutral-body'],
    },
  };
});
