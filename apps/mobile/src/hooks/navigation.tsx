import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useThemeColors } from '@/hooks/theme';
import { navigationRef } from '@/utils/navigation';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';

import { default as RcIconHeaderBack } from '@/assets/icons/header/back-cc.svg';
import { makeThemeIconByCC } from '@/hooks/makeThemeIcon';
import { ThemeColors } from '@/constant/theme';
import { NavigationHeadersPresets } from '@/constant/layout';

const IconBack = makeThemeIconByCC(RcIconHeaderBack, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.light['neutral-body'],
});

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export const useStackScreenConfig = (): NativeStackNavigationOptions => {
  const colors = useThemeColors();

  const navBack = useCallback(() => {
    const navigation = navigationRef.current;
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else {
      navigationRef.resetRoot({
        index: 0,
        routes: [{ name: 'Root' }],
      });
    }
  }, []);

  return {
    animation: 'slide_from_right',
    contentStyle: {
      // backgroundColor: colors.bgChat,
    },
    ...NavigationHeadersPresets.onlyTitle,
    headerTintColor: colors['neutral-bg-1'],
    headerLeft: ({ tintColor }) => (
      <CustomTouchableOpacity
        style={styles.backButtonStyle}
        hitSlop={hitSlop}
        onPress={navBack}>
        <IconBack width={24} height={24} color={tintColor} />
      </CustomTouchableOpacity>
    ),
  };
};

const styles = StyleSheet.create({
  headerTitleStyle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButtonStyle: {
    // width: 56,
    // height: 56,
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: -16,
    paddingLeft: 16,
  },
});
