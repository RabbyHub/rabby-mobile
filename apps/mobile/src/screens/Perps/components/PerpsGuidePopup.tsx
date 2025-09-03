import ImgGuide1 from '@/assets2024/icons/perps/guide/01.png';
import ImgGuide2Dark from '@/assets2024/icons/perps/guide/02-dark.png';
import ImgGuide2 from '@/assets2024/icons/perps/guide/02.png';
import ImgGuide3Dark from '@/assets2024/icons/perps/guide/03-dark.png';
import ImgGuide3 from '@/assets2024/icons/perps/guide/03.png';
import ImgGuide4Dark from '@/assets2024/icons/perps/guide/04-dark.png';
import ImgGuide4 from '@/assets2024/icons/perps/guide/04.png';
import ImgGuide5Dark from '@/assets2024/icons/perps/guide/05-dark.png';
import ImgGuide5 from '@/assets2024/icons/perps/guide/05.png';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  Image,
  ScrollView,
  Text,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const { width: TAB_WIDTH } = Dimensions.get('window');

export const PerpsGuidePopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
  onComplete?(): void;
}> = ({ visible, onClose, onComplete }) => {
  const modalRef = useRef<AppBottomSheetModal>(null);

  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });

  const { t } = useTranslation();

  const { height } = useWindowDimensions();
  const maxHeight = useMemo(() => {
    return height - 200;
  }, [height]);

  const scrollViewRef = React.useRef<ScrollView>(null);

  const [activeIndex, setActiveIndex] = React.useState(0);

  const steps = useMemo(() => {
    return [
      {
        title: t('page.perps.PerpsGuidePopup.step1Title'),
        description: t('page.perps.PerpsGuidePopup.step1Desc'),
        image: ImgGuide1,
        button: t('global.next'),
      },
      {
        title: t('page.perps.PerpsGuidePopup.step2Title'),
        description: t('page.perps.PerpsGuidePopup.step2Desc'),
        image: isLight ? ImgGuide2 : ImgGuide2Dark,
        button: t('global.next'),
      },
      {
        title: t('page.perps.PerpsGuidePopup.step3Title'),
        description: t('page.perps.PerpsGuidePopup.step3Desc'),
        image: isLight ? ImgGuide3 : ImgGuide3Dark,
        button: t('global.next'),
      },
      {
        title: t('page.perps.PerpsGuidePopup.step4Title'),
        description: t('page.perps.PerpsGuidePopup.step4Desc'),
        image: isLight ? ImgGuide4 : ImgGuide4Dark,
        button: t('global.next'),
      },
      {
        title: t('page.perps.PerpsGuidePopup.step5Title'),
        description: t('page.perps.PerpsGuidePopup.step5Desc'),
        image: isLight ? ImgGuide5 : ImgGuide5Dark,
        button: t('global.gotIt'),
      },
    ];
  }, [isLight, t]);

  const activeStep = useMemo(() => {
    return steps[activeIndex];
  }, [activeIndex, steps]);

  const handleStep = useMemoizedFn(() => {
    if (activeIndex === steps.length - 1) {
      onComplete?.();
      return;
    } else {
      translateX.value = withSpring(-(activeIndex + 1) * TAB_WIDTH, {
        damping: 20,
        stiffness: 90,
      });
      setActiveIndex(activeIndex + 1);
    }
  });

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  const translateX = useSharedValue(0);

  const panGestureEvent = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    { startX: number }
  >({
    onStart: (_, context: { startX: number }) => {
      context.startX = translateX.value;
      // return
    },
    onActive: (event, context) => {
      // 限制滑动范围，防止滑动过头
      const newTranslateX = context.startX + event.translationX;
      const minTranslate = -(steps.length - 1) * TAB_WIDTH;

      if (newTranslateX > 0) {
        translateX.value = withSpring(0, { damping: 50 });
      } else if (newTranslateX < minTranslate) {
        translateX.value = withSpring(minTranslate, { damping: 50 });
      } else {
        translateX.value = newTranslateX;
      }
    },
    onEnd: event => {
      // 根据滑动速度和距离决定切换到哪个标签
      const threshold = TAB_WIDTH * 0.3;
      const draggedDistance = -event.translationX;
      const currentTab = Math.round(translateX.value / TAB_WIDTH);

      if (Math.abs(event.velocityX) > 500) {
        // 快速滑动时根据速度方向切换
        const direction = event.velocityX > 0 ? 1 : -1;
        const newIndex = Math.max(
          0,
          Math.min(steps.length - 1, activeIndex - direction),
        );

        translateX.value = withSpring(-newIndex * TAB_WIDTH, {
          damping: 20,
          stiffness: 90,
        });
        runOnJS(setActiveIndex)(newIndex);
      } else if (draggedDistance > threshold) {
        // 滑动距离超过阈值，切换到下一个
        const newIndex = Math.min(steps.length - 1, activeIndex + 1);

        translateX.value = withSpring(-newIndex * TAB_WIDTH, {
          damping: 20,
          stiffness: 90,
        });
        runOnJS(setActiveIndex)(newIndex);
      } else if (draggedDistance < -threshold) {
        // 滑动距离超过阈值，切换到上一个
        const newIndex = Math.max(0, activeIndex - 1);

        translateX.value = withSpring(-newIndex * TAB_WIDTH, {
          damping: 20,
          stiffness: 90,
        });
        runOnJS(setActiveIndex)(newIndex);
      } else {
        // 回弹到当前标签
        translateX.value = withSpring(-activeIndex * TAB_WIDTH, {
          damping: 20,
          stiffness: 90,
        });
      }
    },
  });

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  useEffect(() => {
    if (!visible) {
      setActiveIndex(0);
      translateX.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      onDismiss={onClose}
      enableDynamicSizing
      enableContentPanningGesture={false}
      // maxDynamicContentSize={maxHeight}
    >
      <BottomSheetView>
        <AutoLockView style={[styles.container]}>
          <PanGestureHandler onGestureEvent={panGestureEvent}>
            <Animated.View
              style={[styles.tabContentContainer, animatedContainerStyle]}>
              {steps.map((step, index) => (
                <View key={index} style={[styles.step]}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                  <View style={styles.imageContainer}>
                    <Image
                      source={step.image}
                      style={styles.stepImage}
                      resizeMode="contain"
                    />
                  </View>
                </View>
              ))}
            </Animated.View>
          </PanGestureHandler>

          <View style={styles.indicatorContainer}>
            {steps.map((item, index) => {
              return (
                <Indicator
                  key={index}
                  active={activeIndex === index}
                  index={index}
                />
              );
            })}
          </View>
          <View style={styles.footer}>
            {activeStep ? (
              <Button
                type="primary"
                title={activeStep.button}
                onPress={handleStep}
              />
            ) : null}
          </View>
        </AutoLockView>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const Indicator: React.FC<{
  active?: boolean;
  index: number;
  onPress?(): void;
}> = ({ active, index, onPress }) => {
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getStyle,
  });
  const width = useSharedValue(6);
  const color = useSharedValue(0);

  useEffect(() => {
    if (active) {
      width.value = withSpring(16, { damping: 15 });
      color.value = withTiming(1, { duration: 300 });
    } else {
      width.value = withSpring(6, { damping: 15 });
      color.value = withTiming(0, { duration: 300 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: width.value,
    };
  });

  const animatedColor = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      color.value,
      [0, 1],
      [colors2024['brand-light-2'], colors2024['brand-default']],
    );

    return {
      backgroundColor,
    };
  });

  return (
    <TouchableWithoutFeedback>
      <Animated.View style={[styles.indicator, animatedStyle, animatedColor]} />
    </TouchableWithoutFeedback>
  );
};

const getStyle = createGetStyles2024(ctx => {
  return {
    container: {
      // height: '100%',
      minHeight: 536,
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      paddingBottom: 56,
      // paddingHorizontal: 20,
    },
    step: {
      marginBottom: 20,
      width: TAB_WIDTH,
      paddingHorizontal: 32,
    },
    stepActive: {
      display: 'flex',
      flexDirection: 'column',
      paddingHorizontal: 12,
      flex: 1,
    },
    stepTitle: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
      color: ctx.colors2024['neutral-title-1'],
      marginBottom: 15,
      textAlign: 'center',
    },
    stepDescription: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '400',
      color: ctx.colors2024['neutral-body'],
      marginBottom: 16,
      textAlign: 'center',
    },
    stepImage: {
      width: '100%',
    },

    imageContainer: {
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      height: 249,
    },
    indicatorContainer: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      justifyContent: 'center',
      marginBottom: 18,
    },
    indicator: {
      width: 6,
      height: 6,
      borderRadius: 1000,
      backgroundColor: ctx.colors2024['brand-light-2'],
    },
    tabContentContainer: {
      flex: 1,
      flexDirection: 'row',
    },
    footer: {
      paddingHorizontal: 20,
    },
  };
});
