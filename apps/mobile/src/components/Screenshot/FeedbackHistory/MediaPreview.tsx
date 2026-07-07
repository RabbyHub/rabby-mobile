import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, useWindowDimensions } from 'react-native';

import RcCloseIconLight from '@/assets/icons/feedback/close.svg';
import { TrackedModal } from '@/components/Modal/TrackedModal';
import FastImage from 'react-native-fast-image';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  TouchableOpacity,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Video from 'react-native-video';

const MEDIA_PREVIEW_MAX_SCALE = 4;
const MEDIA_PREVIEW_DISMISS_DISTANCE = 120;
const MEDIA_PREVIEW_DISMISS_VELOCITY = 900;
const MEDIA_PREVIEW_MIN_DISMISS_SCALE = 0.3;
const MEDIA_PREVIEW_DISMISS_SCALE_DISTANCE_RATIO = 0.6;

export type FeedbackPreviewMedia = {
  type: 'image' | 'video';
  uri: string;
};

function clampWorklet(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export function FeedbackMediaPreview({
  media,
  onClose,
}: {
  media: FeedbackPreviewMedia;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const isImage = media.type === 'image';
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const dismissScale = useSharedValue(1);
  const dismissOriginX = useSharedValue(width / 2);
  const dismissOriginY = useSharedValue(height / 2);
  const backgroundOpacity = useSharedValue(1);

  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    dismissScale.value = 1;
    dismissOriginX.value = width / 2;
    dismissOriginY.value = height / 2;
    backgroundOpacity.value = 1;
  }, [
    backgroundOpacity,
    dismissOriginX,
    dismissOriginY,
    dismissScale,
    height,
    media.uri,
    savedScale,
    savedTranslateX,
    savedTranslateY,
    scale,
    translateX,
    translateY,
    width,
  ]);

  const panGesture = Gesture.Pan()
    .minDistance(2)
    .onStart(event => {
      if (isImage && scale.value <= 1.01) {
        dismissOriginX.value = clampWorklet(event.absoluteX, 0, width);
        dismissOriginY.value = clampWorklet(event.absoluteY, 0, height);
      }
    })
    .onUpdate(event => {
      if (isImage && scale.value > 1.01) {
        dismissScale.value = 1;
        backgroundOpacity.value = 1;
        const maxTranslateX = (width * (scale.value - 1)) / 2;
        const maxTranslateY = (height * (scale.value - 1)) / 2;
        translateX.value = clampWorklet(
          savedTranslateX.value + event.translationX,
          -maxTranslateX,
          maxTranslateX,
        );
        translateY.value = clampWorklet(
          savedTranslateY.value + event.translationY,
          -maxTranslateY,
          maxTranslateY,
        );
        return;
      }

      translateX.value = 0;
      translateY.value = event.translationY;
      dismissScale.value =
        isImage && event.translationY > 0
          ? clampWorklet(
              1 -
                event.translationY /
                  Math.max(
                    height * MEDIA_PREVIEW_DISMISS_SCALE_DISTANCE_RATIO,
                    MEDIA_PREVIEW_DISMISS_DISTANCE,
                  ),
              MEDIA_PREVIEW_MIN_DISMISS_SCALE,
              1,
            )
          : 1;
      backgroundOpacity.value =
        event.translationY > 0
          ? clampWorklet(1 - event.translationY / height, 0.25, 1)
          : 1;
    })
    .onEnd(event => {
      if (isImage && scale.value > 1.01) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
        dismissScale.value = 1;
        return;
      }

      if (
        event.translationY > MEDIA_PREVIEW_DISMISS_DISTANCE ||
        event.velocityY > MEDIA_PREVIEW_DISMISS_VELOCITY
      ) {
        runOnJS(onClose)();
        return;
      }

      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      dismissScale.value = withSpring(1);
      backgroundOpacity.value = withTiming(1, { duration: 120 });
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(isImage)
    .onUpdate(event => {
      const nextScale = clampWorklet(
        savedScale.value * event.scale,
        1,
        MEDIA_PREVIEW_MAX_SCALE,
      );
      scale.value = nextScale;

      if (nextScale <= 1.01) {
        translateX.value = 0;
        translateY.value = 0;
        dismissScale.value = 1;
      }
    })
    .onEnd(() => {
      savedScale.value = scale.value;

      if (scale.value <= 1.01) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        dismissScale.value = withSpring(1);
        return;
      }

      const maxTranslateX = (width * (scale.value - 1)) / 2;
      const maxTranslateY = (height * (scale.value - 1)) / 2;
      const nextTranslateX = clampWorklet(
        translateX.value,
        -maxTranslateX,
        maxTranslateX,
      );
      const nextTranslateY = clampWorklet(
        translateY.value,
        -maxTranslateY,
        maxTranslateY,
      );
      translateX.value = withSpring(nextTranslateX);
      translateY.value = withSpring(nextTranslateY);
      savedTranslateX.value = nextTranslateX;
      savedTranslateY.value = nextTranslateY;
    });

  const doubleTapGesture = Gesture.Tap()
    .enabled(isImage)
    .numberOfTaps(2)
    .onEnd(() => {
      const nextScale = scale.value > 1.01 ? 1 : 2;
      scale.value = withSpring(nextScale);
      savedScale.value = nextScale;
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      dismissScale.value = withSpring(1);
      backgroundOpacity.value = withTiming(1, { duration: 120 });
    });

  const previewGesture = isImage
    ? Gesture.Simultaneous(panGesture, pinchGesture, doubleTapGesture)
    : panGesture;

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));
  const mediaAnimatedStyle = useAnimatedStyle(() => {
    const dismissOriginOffsetX =
      (dismissOriginX.value - width / 2) * (1 - dismissScale.value);
    const dismissOriginOffsetY =
      (dismissOriginY.value - height / 2) * (1 - dismissScale.value);

    return {
      transform: [
        { translateX: translateX.value + dismissOriginOffsetX },
        { translateY: translateY.value + dismissOriginOffsetY },
        { scale: scale.value * dismissScale.value },
      ],
    };
  });

  return (
    <TrackedModal
      modalId="feedback-history-media-preview"
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar hidden animated />
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            styles.backdrop,
            backdropAnimatedStyle,
          ]}
        />
        <GestureDetector gesture={previewGesture}>
          <Animated.View
            style={[
              styles.mediaContainer,
              { width, height },
              mediaAnimatedStyle,
            ]}>
            {isImage ? (
              <FastImage
                source={{ uri: media.uri }}
                style={{ width, height }}
                resizeMode={FastImage.resizeMode.contain}
              />
            ) : (
              <Video
                source={{ uri: media.uri }}
                style={{ width, height }}
                resizeMode="contain"
                controls
                paused={false}
              />
            )}
          </Animated.View>
        </GestureDetector>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onClose}
          style={styles.closeButton}>
          <RcCloseIconLight width={28} height={28} />
        </TouchableOpacity>
      </GestureHandlerRootView>
    </TrackedModal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    backgroundColor: '#000',
  },
  mediaContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
