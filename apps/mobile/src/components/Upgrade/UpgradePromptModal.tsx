import React, { useCallback, useEffect, useMemo } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Typography';
import { TrackedModal } from '@/components/Modal/TrackedModal';
import { MarkdownInWebView } from '@/components/Markdown/InWebView';
import { RcIconCloseCC } from '@/assets2024/icons/rateModal';
import RcIconRightArrowCC from '@/assets/icons/common/arrow-right-cc.svg';
import { useUpgradeInfo } from '@/hooks/version';
import { useGetBinaryMode } from '@/hooks/theme';
import { MODAL_GATE_IDS } from '@/utils/modalGate';
import { FontNames } from '@/core/utils/fonts';
import { APP_URLS } from '@/constant';
import { openExternalUrl, openInAppBrowser } from '@/core/utils/linking';
import {
  dismissUpgradePrompt,
  useUpgradePromptVisible,
} from './useUpgradePrompt';

const CARD_WIDTH = 313;
const CARD_HEIGHT = 426;
const CARD_HORIZONTAL_MARGIN = 20;
const CONTENT_HORIZONTAL_PADDING = 23;
const SLIDER_HEIGHT = 56;
const SLIDER_THUMB_SIZE = 48;
const SLIDER_INSET = 4;
const SLIDER_COMPLETE_THRESHOLD = 0.82;
const SLIDER_GRADIENT = ['#4056DD', '#2EECD3'];
const LIGHT_GLASS_COLOR = 'rgba(255, 255, 255, 0.75)';
const DARK_GLASS_COLOR = 'rgba(56, 59, 65, 0.75)';

function SlideToUpdate({
  onComplete,
  resetKey,
  isDark,
}: {
  onComplete: () => void;
  resetKey: string;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const translateX = useSharedValue(0);
  const maxTranslateX = useSharedValue(0);
  const completed = useSharedValue(false);

  const resetSlider = useCallback(() => {
    translateX.value = 0;
    completed.value = false;
  }, [completed, translateX]);

  useEffect(() => resetSlider(), [resetKey, resetSlider]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      maxTranslateX.value = Math.max(
        0,
        width - SLIDER_THUMB_SIZE - SLIDER_INSET * 2,
      );
    },
    [maxTranslateX],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate(event => {
          if (completed.value) return;
          translateX.value = Math.max(
            0,
            Math.min(event.translationX, maxTranslateX.value),
          );
        })
        .onEnd(() => {
          if (
            maxTranslateX.value > 0 &&
            translateX.value >= maxTranslateX.value * SLIDER_COMPLETE_THRESHOLD
          ) {
            completed.value = true;
            translateX.value = withTiming(
              maxTranslateX.value,
              { duration: 160 },
              finished => {
                if (finished) runOnJS(onComplete)();
              },
            );
            return;
          }

          translateX.value = withSpring(0, {
            damping: 18,
            stiffness: 180,
          });
        }),
    [completed, maxTranslateX, onComplete, translateX],
  );

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const progressStyle = useAnimatedStyle(() => ({
    width: translateX.value + SLIDER_THUMB_SIZE,
  }));

  return (
    <View
      style={[styles.sliderTrack, isDark && styles.sliderTrackDark]}
      onLayout={handleLayout}>
      <Animated.View style={[styles.sliderProgressClip, progressStyle]}>
        <LinearGradient
          colors={SLIDER_GRADIENT}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.sliderGradient}
        />
      </Animated.View>
      <Text
        style={[styles.sliderLabel, isDark && styles.sliderLabelDark]}
        selectable={false}>
        {t('page.nextComponent.upgradeModal.slideToUpdate')}
      </Text>
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.sliderThumb,
            isDark && styles.sliderThumbDark,
            thumbStyle,
          ]}>
          <RcIconRightArrowCC
            width={20}
            height={20}
            color={isDark ? '#000000' : '#FFFFFF'}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export function UpgradePromptModal() {
  const { t } = useTranslation();
  const isDark = useGetBinaryMode() === 'dark';
  const visible = useUpgradePromptVisible();
  const { remoteVersion } = useUpgradeInfo();

  const handleUpdate = useCallback(async () => {
    dismissUpgradePrompt();

    try {
      if (Platform.OS !== 'android') {
        await openExternalUrl(
          remoteVersion.downloadUrl ||
            remoteVersion.storeUrl ||
            APP_URLS.STORE_URL,
        );
        return;
      }

      if (remoteVersion.externalUrlToOpen) {
        await openExternalUrl(remoteVersion.externalUrlToOpen);
      } else {
        await openInAppBrowser(APP_URLS.DOWNLOAD_PAGE);
      }
    } catch {
      await openExternalUrl(APP_URLS.DOWNLOAD_PAGE);
    }
  }, [remoteVersion]);

  return (
    <TrackedModal
      modalId={MODAL_GATE_IDS.upgradePrompt}
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismissUpgradePrompt}>
      <View style={styles.overlay}>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <BlurView
            blurAmount={12}
            blurType={
              Platform.OS === 'ios'
                ? isDark
                  ? 'ultraThinMaterialDark'
                  : 'ultraThinMaterialLight'
                : isDark
                ? 'dark'
                : 'light'
            }
            reducedTransparencyFallbackColor={
              isDark ? DARK_GLASS_COLOR : LIGHT_GLASS_COLOR
            }
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[styles.cardFill, isDark && styles.cardFillDark]}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('page.nextComponent.upgradeModal.close')}
            hitSlop={10}
            onPress={dismissUpgradePrompt}
            style={styles.closeButton}>
            <RcIconCloseCC
              width={16}
              height={16}
              color={isDark ? '#717380' : '#68758D'}
            />
          </Pressable>

          <Text
            style={[styles.title, isDark && styles.titleDark]}
            selectable={false}>
            {t('page.nextComponent.upgradeModal.title')}
          </Text>

          <View style={styles.changelogContainer}>
            <MarkdownInWebView
              markdown={remoteVersion.changelog}
              htmlInnerStyle="html, body { background-color: transparent; }"
              webviewStyle={styles.markdownWebView}
            />
          </View>

          <View style={styles.sliderContainer}>
            <SlideToUpdate
              onComplete={handleUpdate}
              resetKey={`${remoteVersion.version}:${visible}`}
              isDark={isDark}
            />
          </View>

          <Text
            style={[styles.versionText, isDark && styles.versionTextDark]}
            selectable={false}>
            v{remoteVersion.version}
          </Text>
        </View>
      </View>
    </TrackedModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(25, 41, 69, 0.12)',
    paddingHorizontal: CARD_HORIZONTAL_MARGIN,
  },
  card: {
    width: CARD_WIDTH,
    maxWidth: '100%',
    height: CARD_HEIGHT,
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  cardDark: {
    borderColor: '#383B41',
  },
  cardFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: LIGHT_GLASS_COLOR,
  },
  cardFillDark: {
    backgroundColor: DARK_GLASS_COLOR,
  },
  closeButton: {
    position: 'absolute',
    right: 15,
    top: 15,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  title: {
    marginTop: 39,
    marginHorizontal: CONTENT_HORIZONTAL_PADDING,
    height: 45,
    color: '#192945',
    fontFamily: FontNames.sf_pro_rounded_bold,
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 42,
  },
  titleDark: {
    color: '#F7FAFC',
  },
  changelogContainer: {
    height: 162,
    marginTop: 24,
    marginHorizontal: CONTENT_HORIZONTAL_PADDING,
    overflow: 'hidden',
  },
  markdownWebView: {
    backgroundColor: 'transparent',
  },
  sliderContainer: {
    position: 'absolute',
    left: 23,
    right: 23,
    bottom: 40,
    height: SLIDER_HEIGHT,
  },
  versionText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    color: '#C5C5CF',
    fontFamily: FontNames.sf_pro_rounded_regular,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    textAlign: 'center',
  },
  versionTextDark: {
    color: '#56575F',
  },
  sliderTrack: {
    width: '100%',
    height: SLIDER_HEIGHT,
    overflow: 'hidden',
    borderRadius: 200,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  sliderTrackDark: {
    backgroundColor: '#000000',
  },
  sliderProgressClip: {
    position: 'absolute',
    left: SLIDER_INSET,
    top: SLIDER_INSET,
    height: SLIDER_THUMB_SIZE,
    overflow: 'hidden',
    borderRadius: 200,
  },
  sliderGradient: {
    width: '100%',
    height: '100%',
  },
  sliderLabel: {
    paddingLeft: 64,
    color: '#192945',
    fontFamily: FontNames.sf_pro_rounded_bold,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  sliderLabelDark: {
    color: '#F7FAFC',
  },
  sliderThumb: {
    position: 'absolute',
    left: SLIDER_INSET,
    top: SLIDER_INSET,
    width: SLIDER_THUMB_SIZE,
    height: SLIDER_THUMB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLIDER_THUMB_SIZE / 2,
    backgroundColor: '#192945',
  },
  sliderThumbDark: {
    backgroundColor: '#F7FAFC',
  },
});
