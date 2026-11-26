import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

import { RcIconTabsCC } from '@/assets2024/icons/browser';
import { Text } from '@/components/Typography';
import { browserApis, useDisplayedTabsCount } from '@/hooks/browser/useBrowser';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

const MAX_SHOWN_COUNT = 99;

// The icon has no left padding, so widen the touch area toward the search text.
const HIT_SLOP = { top: 0, bottom: 0, left: 8, right: 0 };

/**
 * The open-tab count inside the drawer's search bar, the same icon the
 * browser's address bar carries. It opens the tab manager.
 */
export const DappDrawerTabsButton: React.FC = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const count = useDisplayedTabsCount();
  const isOverflow = count > MAX_SHOWN_COUNT;

  const handlePress = useCallback(() => {
    browserApis.setPartialBrowserState({ isShowManage: true });
  }, []);

  return (
    <TouchableOpacity
      style={styles.button}
      hitSlop={HIT_SLOP}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={t('page.browser.BrowserSearchEntry.openWebsites')}
      testID="home-dapp-drawer-tabs-button">
      <View style={styles.icon}>
        <RcIconTabsCC
          width={24}
          height={24}
          color={colors2024['neutral-body']}
        />
        <View style={styles.countContainer} pointerEvents="none">
          <Text style={isOverflow ? styles.countSmall : styles.count}>
            {isOverflow ? `${MAX_SHOWN_COUNT}+` : count}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  button: {
    justifyContent: 'center',
    // 24pt icon + 12pt equals the search side's 12pt + 20pt icon + 4pt gap,
    // which keeps the placeholder centered in the bar.
    paddingRight: 12,
  },
  icon: {
    width: 24,
    height: 24,
  },
  countContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '700',
  },
  countSmall: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
  },
}));
