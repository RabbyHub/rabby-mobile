// pick from apps/mobile/node_modules/@react-navigation/native-stack/src/views/NativeStackView.tsx

import { Image } from 'react-native';
import {
  Header,
  getHeaderTitle,
  HeaderBackButton,
} from '@react-navigation/elements';
import { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { StyleSheet } from 'react-native';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { makeDebugBorder } from '@/utils/styles';

/**
 * @deprecated we haven't understand the render mechanism in @react-navigation/native-stack,
 * don't use it now
 */
export function renderNativeStackHeader(props: NativeStackHeaderProps) {
  const { options, navigation, route } = props;

  const canGoBack = true;

  const {
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
  } = options;

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
      headerStyle={headerStyle}
    />
  );
}

const styles = StyleSheet.create({
  backImage: {
    height: 24,
    width: 24,
    margin: 3,
    resizeMode: 'contain',
  },
});
