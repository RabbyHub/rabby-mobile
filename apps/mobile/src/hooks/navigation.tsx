import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { atom, useAtomValue, useSetAtom } from 'jotai';

import {
  NativeStackNavigationOptions,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useThemeColors } from '@/hooks/theme';
import { navigationRef } from '@/utils/navigation';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';

import { default as RcIconHeaderBack } from '@/assets/icons/header/back-cc.svg';
import { AppRootName, RootNames, makeHeadersPresets } from '@/constant/layout';
import { useNavigation } from '@react-navigation/native';

import { makeThemeIconFromCC } from './makeThemeIcon';
import { ThemeColors } from '@/constant/theme';
import type { RootStackParamsList } from '@/navigation-type';

const LeftBackIcon = makeThemeIconFromCC(RcIconHeaderBack, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

const currentRouteNameAtom = atom<AppRootName | string | undefined>(undefined);
export function useCurrentRouteNameInAppStatusBar() {
  return useAtomValue(currentRouteNameAtom);
}

export function useSetCurrentRouteName() {
  return useSetAtom(currentRouteNameAtom);
}

const navigationReadyAtom = atom<boolean>(false);
export function useNavigationReady() {
  const appNavigationReady = useAtomValue(navigationReadyAtom);

  return { appNavigationReady };
}
export function useSetNavigationReady() {
  const setNavigationReady = useSetAtom(navigationReadyAtom);

  return { setNavigationReady };
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

  const headerPresets = makeHeadersPresets({ colors });

  return {
    animation: 'slide_from_right',
    contentStyle: {
      // backgroundColor: colors.bgChat,
    },
    ...headerPresets.onlyTitle,
    headerTitleStyle: {
      ...(headerPresets.onlyTitle.headerTitleStyle as object),
      color: colors['neutral-title-1'],
      fontWeight: 'normal',
    },
    headerTintColor: colors['neutral-bg-1'],
    headerLeft: ({ tintColor }) => (
      <CustomTouchableOpacity
        style={styles.backButtonStyle}
        hitSlop={hitSlop}
        onPress={navBack}>
        <RcIconHeaderBack
          width={24}
          height={24}
          color={tintColor || colors['neutral-body']}
        />
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

export function useRabbyAppNavigation<
  K extends NativeStackScreenProps<RootStackParamsList>['navigation'],
>() {
  return useNavigation<K>();
}

export function resetNavigationToHome(
  navigation: ReturnType<typeof useRabbyAppNavigation>,
) {
  navigation.reset({
    index: 0,
    routes: [
      {
        name: RootNames.StackRoot,
        params: {
          screen: RootNames.Home,
        },
      },
    ],
  });
}

export function usePreventGoBack({
  navigation,
  shouldGoback,
}: {
  navigation?: ReturnType<typeof useRabbyAppNavigation>;
  shouldGoback: (() => boolean) | React.RefObject<boolean>;
}) {
  const shouldPreventFn = useCallback(() => {
    if (typeof shouldGoback === 'function') {
      return !shouldGoback();
    }

    return !shouldGoback.current;
  }, [shouldGoback]);

  const registerPreventEffect = useCallback(() => {
    if (!navigation) return;

    const listener: Parameters<
      typeof navigation.addListener<'beforeRemove'>
    >[1] = e => {
      if (shouldPreventFn()) {
        // Prevent default behavior of leaving the screen
        e.preventDefault();

        return false;
      }
    };

    navigation.addListener('beforeRemove', listener);

    return () => {
      navigation.removeListener('beforeRemove', listener);
    };
  }, [navigation, shouldPreventFn]);

  return {
    registerPreventEffect,
  };
}
