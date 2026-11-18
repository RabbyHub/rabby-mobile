import {
  ReactNativeViewAs,
  ReactNativeViewAsMap,
  getViewComponentByAs,
} from '@/hooks/common/useReactNativeViews';
import { useSafeSizes } from '@/hooks/useAppLayout';
import React, { useMemo } from 'react';
import {
  ImageBackground,
  ImageResizeMode,
  ImageStyle,
  StyleSheet,
  View,
  ImageSourcePropType,
  StyleProp,
} from 'react-native';
import {
  LinearGradientContainer,
  LinearGradientContainerProps,
} from './LinearGradientContainer';
import { LinearGradientProps } from 'react-native-linear-gradient';
import { useSystemColumnInset } from '@/components/SafeWindowFrame/backdrop';

export default function NormalScreenContainer2024<
  T extends ReactNativeViewAs = 'View',
>({
  as = 'View' as T,
  noHeader = false,
  children,
  style,
  fitStatuBar,
  overwriteStyle,
  type = 'linear',
  linearProp,
  bgImageSource,
  bgImageResizeMode = 'cover',
  bgImageHeight,
  bgImageStyle,
}: React.PropsWithChildren<
  {
    as?: T;
    noHeader?: boolean;
    fitStatuBar?: boolean;
    style?: React.ComponentProps<typeof View>['style'];
    hideBottomBar?: boolean;
    overwriteStyle?: React.ComponentProps<typeof View>['style'];
    type?: LinearGradientContainerProps['type'];
    linearProp?: LinearGradientProps;
    bgImageSource?: ImageSourcePropType;
    bgImageResizeMode?: ImageResizeMode;
    bgImageHeight?: number;
    bgImageStyle?: StyleProp<ImageStyle>;
  } & React.ComponentProps<ReactNativeViewAsMap[T]>
>) {
  const { safeOffHeader, safeTop } = useSafeSizes();
  const ViewComp = useMemo(() => getViewComponentByAs(as), [as]);
  // The background above stays full-bleed; only the content keeps clear of the
  // foldable system column. `0` on every other device, where the extra padding
  // is not added at all.
  const columnInset = useSystemColumnInset();

  return (
    <LinearGradientContainer type={type} {...linearProp}>
      {bgImageSource && (
        <ImageBackground
          source={bgImageSource}
          resizeMode={bgImageResizeMode}
          style={[
            styles.bgImage,
            { height: bgImageHeight ?? safeOffHeader + 150 },
            bgImageStyle,
          ]}
        />
      )}

      <ViewComp
        style={StyleSheet.flatten([
          style,
          fitStatuBar && { marginTop: -1 },
          {
            paddingTop: noHeader ? safeTop : safeOffHeader,
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundColor: 'transparent',
          },
          columnInset > 0 && { paddingRight: columnInset },
          overwriteStyle,
        ])}>
        {children}
      </ViewComp>
    </LinearGradientContainer>
  );
}

const styles = StyleSheet.create({
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
  },
});
