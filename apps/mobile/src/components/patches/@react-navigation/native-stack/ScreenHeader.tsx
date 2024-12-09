import {
  getHeaderTitle,
  Header,
  HeaderBackButton,
} from '@react-navigation/elements';

import * as React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ScreenHeader({
  headerHeight,
  canGoBack,
  nativeHeaderProps,
}: {
  headerHeight?: number;
  canGoBack: boolean;
  nativeHeaderProps: NativeStackHeaderProps;
}) {
  const { options, route, navigation } = nativeHeaderProps;

  const {
    header,
    headerShown,
    headerTintColor,
    headerBackImageSource,
    headerLeft,
    headerRight,
    headerTitle,
    headerTitleAlign,
    headerTitleStyle,
    headerStyle,
    headerShadowVisible,
    headerTransparent,
    headerBackground,
    headerBackTitle,
    presentation,
    contentStyle,
  } = options;

  const finalHeaderStyle = StyleSheet.flatten([
    headerStyle,
    headerHeight && { height: headerHeight },
  ]);

  return (
    <Header
      title={getHeaderTitle(options, route.name)}
      headerTintColor={headerTintColor}
      headerLeft={
        typeof headerLeft === 'function'
          ? ({ tintColor }) =>
              headerLeft({
                tintColor,
                canGoBack,
                label: headerBackTitle,
              })
          : headerLeft === undefined && canGoBack
          ? ({ tintColor }) => (
              <HeaderBackButton
                tintColor={tintColor}
                backImage={
                  headerBackImageSource !== undefined
                    ? () => (
                        <Image
                          source={headerBackImageSource}
                          style={[styles.backImage, { tintColor }]}
                        />
                      )
                    : undefined
                }
                onPress={navigation.goBack}
                canGoBack={canGoBack}
              />
            )
          : headerLeft
      }
      headerRight={
        typeof headerRight === 'function'
          ? ({ tintColor }) => headerRight({ tintColor, canGoBack })
          : headerRight
      }
      headerTitle={
        typeof headerTitle === 'function'
          ? ({ children, tintColor }) => headerTitle({ children, tintColor })
          : headerTitle
      }
      headerTitleAlign={headerTitleAlign}
      headerTitleStyle={headerTitleStyle}
      headerTransparent={headerTransparent}
      headerShadowVisible={headerShadowVisible}
      headerBackground={headerBackground}
      // @ts-expect-error
      headerStyle={finalHeaderStyle}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  backImage: {
    height: 24,
    width: 24,
    margin: 3,
    resizeMode: 'contain',
  },
});

ScreenHeader.SafeContainer = function ScreenHeaderContainer({
  children,
}: React.PropsWithChildren<RNViewProps>) {
  const { top } = useSafeAreaInsets();

  return <View style={{ top }}>{children}</View>;
};
