// pick from file:///./../../../../node_modules/@react-navigation/native-stack/src/views/NativeStackView.tsx
// @see file:///./../../../../node_modules/@react-navigation/elements/src/Header/Header.tsx

import { Image } from 'react-native';
import {
  Header,
  getHeaderTitle,
  HeaderBackButton,
} from '@react-navigation/elements';
import { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { StyleSheet } from 'react-native';
import { makeDebugBorder } from '@/utils/styles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function HomeNativeStackHeader(props: NativeStackHeaderProps) {
  const { options, navigation, route } = props;

  const canGoBack = true;

  const {
    headerTintColor,
    headerBackImageSource,
    headerLeft,
    headerRight,
    headerTitle,
    headerStyle,
    headerShadowVisible,
    headerTransparent,
    headerBackTitle,
  } = options;

  const insets = useSafeAreaInsets();

  return (
    <Header
      title={getHeaderTitle(options, route.name)}
      headerTintColor={headerTintColor}
      headerLeftContainerStyle={{
        // ...makeDebugBorder(),
        paddingLeft: 8,
      }}
      headerLeft={
        typeof headerLeft === 'function'
          ? ({ ...rest }) =>
              headerLeft({
                ...rest,
                label: headerBackTitle,
                canGoBack,
              })
          : headerLeft === undefined && canGoBack
          ? ({ tintColor, ...rest }) => (
              <HeaderBackButton
                {...rest}
                label={headerBackTitle}
                tintColor={tintColor}
                backImage={
                  headerBackImageSource !== undefined
                    ? () => (
                        <Image
                          source={headerBackImageSource}
                          resizeMode="contain"
                          tintColor={tintColor}
                          style={styles.backImage}
                        />
                      )
                    : undefined
                }
                onPress={navigation.goBack}
              />
            )
          : headerLeft
      }
      headerTitleContainerStyle={
        {
          // ...makeDebugBorder('pink')
        }
      }
      headerRight={
        typeof headerRight === 'function'
          ? ({ tintColor }) => headerRight({ tintColor, canGoBack })
          : headerRight
      }
      headerRightContainerStyle={{
        paddingRight: 12,
      }}
      headerTitle={
        typeof headerTitle === 'function'
          ? ({ children, tintColor }) => headerTitle({ children, tintColor })
          : headerTitle
      }
      headerTransparent={headerTransparent}
      headerShadowVisible={headerShadowVisible}
      headerStyle={[styles.header, headerStyle]}
    />
  );
}

const styles = StyleSheet.create({
  header: {},
  backImage: {
    height: 24,
    width: 24,
    margin: 3,
    resizeMode: 'contain',
  },
});
