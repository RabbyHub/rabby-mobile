import { perfEvents } from '@/core/utils/perf';
import { navigationRef } from '@/utils/navigation';
import React from 'react';
import {
  Animated,
  type ImageRequireSource,
  Platform,
  StyleSheet,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import BootSplash, {
  type Manifest,
  useHideAnimation,
} from 'react-native-bootsplash';

const LIGHT_RABBIT = require('@/assets/images/bootsplash/rabbit-light.gif');
const DARK_RABBIT = require('@/assets/images/bootsplash/rabbit-dark.gif');

const NATIVE_HANDOFF_FALLBACK_MS = 2000;
const SPLASH_EXIT_FALLBACK_MS = 8000;
const RABBIT_ANIMATION_CYCLE_MS = 480;
const SPLASH_FADE_MS = 180;

const logoLayout = Platform.select({
  ios: { width: 119, height: 128, translateY: -33.5 },
  default: { width: 125, height: 134, translateY: -48 },
});

const manifest: Manifest = {
  background: '#FFFFFF',
  darkBackground: '#131416',
  logo: {
    width: logoLayout.width,
    height: logoLayout.height,
  },
};

function AnimatedBootSplashImpl() {
  const opacity = React.useRef(new Animated.Value(1)).current;
  const [visible, setVisible] = React.useState(true);
  const nativeHandoffAtRef = React.useRef<number | null>(null);
  const exitRequestedRef = React.useRef(navigationRef.isReady());
  const exitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitScheduledRef = React.useRef(false);
  const fadeStartedRef = React.useRef(false);

  const startExitIfReady = React.useCallback(() => {
    const nativeHandoffAt = nativeHandoffAtRef.current;
    if (
      nativeHandoffAt === null ||
      !exitRequestedRef.current ||
      exitScheduledRef.current ||
      fadeStartedRef.current
    ) {
      return;
    }

    const remainingCycleMs = Math.max(
      0,
      RABBIT_ANIMATION_CYCLE_MS - (Date.now() - nativeHandoffAt),
    );

    exitScheduledRef.current = true;
    exitTimerRef.current = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fadeStartedRef.current = true;
          Animated.timing(opacity, {
            toValue: 0,
            duration: SPLASH_FADE_MS,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) {
              setVisible(false);
            }
          });
        });
      });
    }, remainingCycleMs);
  }, [opacity]);

  const markNativeHandoffComplete = React.useCallback(() => {
    if (nativeHandoffAtRef.current === null) {
      nativeHandoffAtRef.current = Date.now();
    }
    startExitIfReady();
  }, [startExitIfReady]);

  const { container, logo } = useHideAnimation({
    manifest,
    logo: LIGHT_RABBIT,
    darkLogo: DARK_RABBIT,
    statusBarTranslucent: true,
    navigationBarTranslucent: true,
    animate: markNativeHandoffComplete,
  });

  React.useEffect(() => {
    const requestExit = () => {
      exitRequestedRef.current = true;
      startExitIfReady();
    };
    const navigationReadySub = perfEvents.subscribe(
      'APP_NAVIGATION_READY',
      requestExit,
    );
    const exitFallback = setTimeout(requestExit, SPLASH_EXIT_FALLBACK_MS);
    const handoffFallback = setTimeout(() => {
      BootSplash.hide({ fade: false })
        .catch(error => {
          console.error('AnimatedBootSplash::hideFallback::error', error);
        })
        .finally(markNativeHandoffComplete);
    }, NATIVE_HANDOFF_FALLBACK_MS);

    if (navigationRef.isReady()) {
      requestExit();
    }

    return () => {
      navigationReadySub.remove();
      clearTimeout(exitFallback);
      clearTimeout(handoffFallback);
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
      opacity.stopAnimation();
    };
  }, [markNativeHandoffComplete, opacity, startExitIfReady]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      {...container}
      pointerEvents="none"
      style={[container.style, styles.container, { opacity }]}>
      <FastImage
        source={logo.source as ImageRequireSource}
        resizeMode={FastImage.resizeMode.contain}
        style={styles.logo}
        onLoadEnd={logo.onLoadEnd}
      />
    </Animated.View>
  );
}

export function AnimatedBootSplash() {
  return <AnimatedBootSplashImpl />;
}

const styles = StyleSheet.create({
  container: {
    zIndex: 10000,
  },
  logo: {
    width: logoLayout.width,
    height: logoLayout.height,
    transform: [{ translateY: logoLayout.translateY }],
  },
});
