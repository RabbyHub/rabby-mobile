import React from 'react';
import {
  ImageBackground,
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from 'react-native';
import LinearGradient, {
  type LinearGradientProps,
} from 'react-native-linear-gradient';

import { useSafeSizes } from '@/hooks/useAppLayout';

export type HomeChromeBackdropGradient = Pick<
  LinearGradientProps,
  'colors' | 'locations' | 'start' | 'end'
>;

export type HomeChromeBackdropProps = {
  gradient: HomeChromeBackdropGradient;
  imageSource?: ImageSourcePropType;
  /** Same height the screen container gives its top background image. */
  imageHeight: number;
};

/**
 * Replica of the screen backdrop, clipped to the home chrome band.
 *
 * The pager keeps list rows scrolling underneath the header and tab strip, so
 * that band has to paint something opaque. A flat colour reads as a slab over
 * the screen gradient (and hides the top background image), so paint the same
 * gradient + image at screen coordinates instead.
 */
export function HomeChromeBackdrop({
  gradient,
  imageSource,
  imageHeight,
}: HomeChromeBackdropProps) {
  const { safeTop } = useSafeSizes();
  const { width, height } = useWindowDimensions();
  // The scene starts below the status bar; the screen background starts at the
  // window top, so shift the replica up by the safe-area inset.
  const offsetTop = -safeTop;

  return (
    <View pointerEvents="none" style={styles.container}>
      <LinearGradient
        colors={gradient.colors}
        end={gradient.end}
        locations={gradient.locations}
        start={gradient.start}
        style={[styles.layer, { height, top: offsetTop, width }]}
      />
      {imageSource ? (
        <ImageBackground
          resizeMode="cover"
          source={imageSource}
          style={[styles.layer, { height: imageHeight, top: offsetTop, width }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  layer: {
    left: 0,
    position: 'absolute',
  },
});
