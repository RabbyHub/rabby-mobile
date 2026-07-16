import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import RcCloseIconLight from '@/assets/icons/feedback/close.svg';
import { TrackedModal } from '@/components/Modal/TrackedModal';
import { Text } from '@/components/Typography';
import { Slider } from '@rneui/themed';
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
import Video, {
  type OnLoadData,
  type OnProgressData,
  type VideoRef,
} from 'react-native-video';
import { SystemBars } from 'react-native-edge-to-edge';
import { IS_ANDROID } from '@/core/native/utils';

const MEDIA_PREVIEW_MAX_SCALE = 4;
const MEDIA_PREVIEW_MIN_DISMISS_SCALE = 0.82;
const MEDIA_PREVIEW_DISMISS_PROGRESS_MULTIPLIER = 1.2;
const MEDIA_PREVIEW_DISMISS_PREDICTIVE_DISTANCE = 80;
const MEDIA_PREVIEW_DISMISS_TARGET_DISTANCE_RATIO = 1.4;
const MEDIA_PREVIEW_DISMISS_ROTATION_FACTOR = 0.0003;
const SHOULD_USE_NATIVE_VIDEO_CONTROLS = false;
const MEDIA_PREVIEW_RESET_SPRING_CONFIG = {
  damping: 22,
  stiffness: 260,
  mass: 0.8,
};

export type FeedbackPreviewMedia = {
  type: 'image' | 'video';
  uri: string;
};

function clampWorklet(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function formatVideoTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const paddedSeconds = String(remainingSeconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
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
  const shouldUseCustomVideoControls =
    !isImage && !SHOULD_USE_NATIVE_VIDEO_CONTROLS;
  const videoRef = useRef<VideoRef>(null);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [isVideoSeeking, setIsVideoSeeking] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const dismissScale = useSharedValue(1);
  const dismissOriginX = useSharedValue(width / 2);
  const dismissOriginY = useSharedValue(height / 2);
  const dismissRotation = useSharedValue(0);
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
    dismissRotation.value = 0;
    backgroundOpacity.value = 1;
    setIsVideoPaused(false);
    setVideoDuration(0);
    setVideoCurrentTime(0);
    setIsVideoSeeking(false);
  }, [
    backgroundOpacity,
    dismissOriginX,
    dismissOriginY,
    dismissRotation,
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

  const handleVideoLoad = useCallback((event: OnLoadData) => {
    setVideoDuration(event.duration || 0);
    setVideoCurrentTime(event.currentTime || 0);
  }, []);

  const handleVideoProgress = useCallback(
    (event: OnProgressData) => {
      if (!isVideoSeeking) {
        setVideoCurrentTime(event.currentTime || 0);
      }
    },
    [isVideoSeeking],
  );

  const handleVideoEnd = useCallback(() => {
    setIsVideoPaused(true);
    setVideoCurrentTime(videoDuration);
  }, [videoDuration]);

  const handleToggleVideoPlayback = useCallback(() => {
    setIsVideoPaused(prev => {
      if (
        prev &&
        videoDuration > 0 &&
        videoCurrentTime >= videoDuration - 0.5
      ) {
        videoRef.current?.seek(0);
        setVideoCurrentTime(0);
      }

      return !prev;
    });
  }, [videoCurrentTime, videoDuration]);

  const handleVideoSlidingStart = useCallback(() => {
    setIsVideoSeeking(true);
  }, []);

  const handleVideoValueChange = useCallback((value: number) => {
    setVideoCurrentTime(value);
  }, []);

  const handleVideoSlidingComplete = useCallback((value: number) => {
    videoRef.current?.seek(value);
    setVideoCurrentTime(value);
    setIsVideoSeeking(false);
  }, []);

  const panGesture = Gesture.Pan()
    .minDistance(2)
    .maxPointers(1)
    .onStart(event => {
      if (scale.value <= 1.01) {
        dismissOriginX.value = clampWorklet(event.absoluteX, 0, width);
        dismissOriginY.value = clampWorklet(event.absoluteY, 0, height);
      }
    })
    .onUpdate(event => {
      if (scale.value > 1.01) {
        dismissScale.value = 1;
        dismissRotation.value = 0;
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

      translateX.value = event.translationX;
      translateY.value = event.translationY;
      dismissRotation.value =
        event.translationY > 0
          ? event.translationX * MEDIA_PREVIEW_DISMISS_ROTATION_FACTOR
          : 0;

      const dismissProgress = clampWorklet(
        ((event.translationX + event.translationY) / Math.max(width, height)) *
          MEDIA_PREVIEW_DISMISS_PROGRESS_MULTIPLIER,
        0,
        1,
      );
      dismissScale.value = clampWorklet(
        1 - dismissProgress * (1 - MEDIA_PREVIEW_MIN_DISMISS_SCALE),
        MEDIA_PREVIEW_MIN_DISMISS_SCALE,
        1,
      );
      backgroundOpacity.value =
        event.translationY > 0
          ? clampWorklet(1 - dismissProgress * 0.8, 0.2, 1)
          : 1;
    })
    .onEnd(event => {
      if (scale.value > 1.01) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
        dismissScale.value = 1;
        dismissRotation.value = 0;
        return;
      }

      const predictedX = event.translationX + event.velocityX / 2;
      const predictedY = event.translationY + event.velocityY / 2;
      const shouldDismiss =
        event.translationY > 0 &&
        predictedY > 0 &&
        predictedX + predictedY > MEDIA_PREVIEW_DISMISS_PREDICTIVE_DISTANCE;

      if (shouldDismiss) {
        const angleX = predictedX / width;
        const angleY = predictedY / height;
        const angleDistance = Math.sqrt(angleX * angleX + angleY * angleY);
        const targetTranslateX =
          angleDistance > 0
            ? (angleX / angleDistance) *
              MEDIA_PREVIEW_DISMISS_TARGET_DISTANCE_RATIO *
              width
            : 0;
        const targetTranslateY =
          angleDistance > 0
            ? (angleY / angleDistance) *
              MEDIA_PREVIEW_DISMISS_TARGET_DISTANCE_RATIO *
              height
            : height;

        translateX.value = withTiming(targetTranslateX, { duration: 180 });
        translateY.value = withTiming(
          targetTranslateY,
          { duration: 180 },
          finished => {
            if (finished) {
              runOnJS(onClose)();
            }
          },
        );
        dismissRotation.value = withTiming(
          dismissRotation.value + predictedX * 0.0001,
          { duration: 180 },
        );
        backgroundOpacity.value = withTiming(0, { duration: 140 });
        return;
      }

      translateX.value = withSpring(0, MEDIA_PREVIEW_RESET_SPRING_CONFIG);
      translateY.value = withSpring(0, MEDIA_PREVIEW_RESET_SPRING_CONFIG);
      dismissScale.value = withSpring(1, MEDIA_PREVIEW_RESET_SPRING_CONFIG);
      dismissRotation.value = withSpring(0, MEDIA_PREVIEW_RESET_SPRING_CONFIG);
      backgroundOpacity.value = withTiming(1, { duration: 120 });
    });

  const pinchGesture = Gesture.Pinch()
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
        dismissRotation.value = 0;
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
        dismissRotation.value = withSpring(0);
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
      dismissRotation.value = withSpring(0);
      backgroundOpacity.value = withTiming(1, { duration: 120 });
    });

  const previewGesture = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    doubleTapGesture,
  );

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
        { rotate: `${dismissRotation.value}rad` },
      ],
    };
  });

  useEffect(() => {
    if (IS_ANDROID) {
      return;
    }
    // 进入预览页时,隐藏状态栏
    const entry = SystemBars.pushStackEntry({
      hidden: { statusBar: true, navigationBar: false },
    });

    // 退出预览页时,弹出这个 entry,自动恢复到上一层(比如列表页)的状态
    return () => {
      SystemBars.popStackEntry(entry);
    };
  }, []);

  return (
    <TrackedModal
      modalId="feedback-history-media-preview"
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
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
                ref={videoRef}
                source={{ uri: media.uri }}
                style={{ width, height }}
                resizeMode="contain"
                controls={SHOULD_USE_NATIVE_VIDEO_CONTROLS}
                paused={shouldUseCustomVideoControls ? isVideoPaused : false}
                progressUpdateInterval={250}
                onLoad={handleVideoLoad}
                onProgress={handleVideoProgress}
                onEnd={handleVideoEnd}
              />
            )}
          </Animated.View>
        </GestureDetector>
        {shouldUseCustomVideoControls ? (
          <View style={styles.videoControlsContainer}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleToggleVideoPlayback}
              style={styles.videoControlButton}>
              {isVideoPaused ? (
                <View style={styles.videoPlayIcon} />
              ) : (
                <View style={styles.videoPauseIcon}>
                  <View style={styles.videoPauseBar} />
                  <View style={styles.videoPauseBar} />
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.videoTimeText}>
              {formatVideoTime(videoCurrentTime)}
            </Text>
            <Slider
              allowTouchTrack
              style={styles.videoSlider}
              value={Math.min(videoCurrentTime, videoDuration || 0)}
              minimumValue={0}
              maximumValue={Math.max(videoDuration, 0.01)}
              minimumTrackTintColor="#fff"
              maximumTrackTintColor="rgba(255, 255, 255, 0.35)"
              thumbStyle={styles.videoSliderThumb}
              trackStyle={styles.videoSliderTrack}
              onSlidingStart={handleVideoSlidingStart}
              onValueChange={handleVideoValueChange}
              onSlidingComplete={handleVideoSlidingComplete}
            />
            <Text style={styles.videoTimeText}>
              {formatVideoTime(videoDuration)}
            </Text>
          </View>
        ) : null}
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
    zIndex: 3,
  },
  videoControlsContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 42,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    zIndex: 2,
  },
  videoControlButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayIcon: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 13,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#fff',
  },
  videoPauseIcon: {
    flexDirection: 'row',
    gap: 4,
  },
  videoPauseBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  videoSlider: {
    flex: 1,
    height: 40,
    marginHorizontal: 8,
  },
  videoSliderTrack: {
    height: 3,
    borderRadius: 2,
  },
  videoSliderThumb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  videoTimeText: {
    minWidth: 38,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
  },
});
