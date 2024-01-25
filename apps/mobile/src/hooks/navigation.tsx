import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { atom, useAtomValue, useSetAtom } from 'jotai';

import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useThemeColors } from '@/hooks/theme';
import { navigationRef } from '@/utils/navigation';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';

import { default as RcIconHeaderBack } from '@/assets/icons/header/back-cc.svg';
import { NavigationHeadersPresets } from '@/constant/layout';
import { useNavigation } from '@react-navigation/native';

import { makeThemeIconFromCC } from './makeThemeIcon';
import { ThemeColors } from '@/constant/theme';

const LeftBackIcon = makeThemeIconFromCC(RcIconHeaderBack, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

const currentRouteNameAtom = atom<string | undefined>(undefined);
export function useCurrentRouteNameInAppStatusBar() {
  return useAtomValue(currentRouteNameAtom);
}

export function useSetCurrentRouteName() {
  return useSetAtom(currentRouteNameAtom);
}

export function useToggleShowNavHeader() {
  const navigation = useNavigation();

  const toggleShowNavHeader = useCallback(
    (isShown: boolean) => {
      navigation.setOptions({ headerShown: isShown });
    },
    [navigation],
  );

  return { toggleShowNavHeader };
}

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
        <LeftBackIcon width={24} height={24} color={tintColor} />
      </CustomTouchableOpacity>
    ),
  };
};

const styles = StyleSheet.create({
  headerTitleStyle: {
    fontSize: 20,
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
