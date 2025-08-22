import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Text,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';

export const PerpsGuidePopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
}> = ({ visible, onClose }) => {
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

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  const [activeIndex, setActiveIndex] = React.useState(0);

  const steps = useMemo(() => {
    return [
      {
        title: t('page.perps.PerpsGuidePopup.step1Title'),
        description: t('page.perps.PerpsGuidePopup.step1Desc'),
        button: t('global.next'),
      },
      {
        title: t('page.perps.PerpsGuidePopup.step2Title'),
        description: t('page.perps.PerpsGuidePopup.step2Desc'),
        button: t('global.next'),
      },
      {
        title: t('page.perps.PerpsGuidePopup.step3Title'),
        description: t('page.perps.PerpsGuidePopup.step3Desc'),
        button: t('global.next'),
      },
      {
        title: t('page.perps.PerpsGuidePopup.step4Title'),
        description: t('page.perps.PerpsGuidePopup.step4Desc'),
        button: t('global.next'),
      },
      {
        title: t('page.perps.PerpsGuidePopup.step5Title'),
        description: t('page.perps.PerpsGuidePopup.step5Desc'),
        button: t('global.gotIt'),
      },
    ];
  }, [t]);

  const activeStep = useMemo(() => {
    return steps[activeIndex];
  }, [activeIndex, steps]);

  const handleStep = useMemoizedFn(() => {
    if (activeIndex === steps.length - 1) {
      onClose?.();
      return;
    } else {
      setActiveIndex(activeIndex + 1);
    }
  });

  return (
    <AppBottomSheetModal
      ref={modalRef}
      // snapPoints={snapPoints}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
      })}
      onDismiss={onClose}
      enableDynamicSizing
      maxDynamicContentSize={maxHeight}>
      <BottomSheetScrollView ref={scrollViewRef}>
        <AutoLockView style={[styles.container]}>
          {steps.map((step, index) => (
            <View
              key={index}
              style={[
                styles.step,
                activeIndex === index ? styles.stepActive : null,
              ]}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
              <View style={styles.imageContainer}></View>
            </View>
          ))}
          <View style={styles.indicatorContainer}>
            {steps.map((item, index) => {
              return <Indicator active={activeIndex === index} index={index} />;
            })}
          </View>
          {activeStep ? (
            <Button
              type="primary"
              title={activeStep.button}
              onPress={handleStep}
            />
          ) : null}
        </AutoLockView>
      </BottomSheetScrollView>
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
      height: '100%',
      minHeight: 536,
      backgroundColor: ctx.colors2024['neutral-bg-1'],
      paddingBottom: 56,
      paddingHorizontal: 20,
    },
    step: {
      display: 'none',
    },
    stepActive: {
      display: 'flex',
      flexDirection: 'column',
      paddingHorizontal: 12,
      marginBottom: 20,
      flex: 1,
    },
    stepTitle: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '800',
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
    },
    imageContainer: {
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'red',
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
  };
});
