import { AnimatedText, Text } from '@/components/Typography';
import type { RootScenePagerUI } from '@rabby-wallet/rn-collapsible-scene-view';
import type { PerpsViewMode } from '@/core/services/perpsService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  Pressable,
} from 'react-native-gesture-handler';
import Animated, {
  runOnUI,
  useAnimatedProps,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

export type PerpsModeSwitchProps = {
  activeMode: PerpsViewMode;
  disabled?: boolean;
  pagerUI?: RootScenePagerUI;
  extendProHitAreaRight?: boolean;
  onPressInMode?: (viewMode: PerpsViewMode) => void;
  onPressOutMode?: (viewMode: PerpsViewMode) => void;
  onSelectMode: (viewMode: PerpsViewMode) => void;
  showProNewBadge?: boolean;
};

const MODE_OPTIONS: ReadonlyArray<{
  label: string;
  value: PerpsViewMode;
}> = [
  { label: 'Perps', value: 'simple' },
  { label: 'Pro', value: 'pro' },
];

export const PerpsModeSwitch: React.FC<PerpsModeSwitchProps> = ({
  activeMode,
  disabled = false,
  pagerUI,
  extendProHitAreaRight = false,
  onPressInMode,
  onPressOutMode,
  onSelectMode,
  showProNewBadge = false,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.container,
        extendProHitAreaRight ? styles.extendedContainer : null,
      ]}
      testID="perps-mode-switch">
      {MODE_OPTIONS.map((option, index) => {
        if (pagerUI) {
          return (
            <RootModeOption
              key={option.value}
              option={option}
              index={index}
              pagerUI={pagerUI}
              disabled={disabled}
              extended={option.value === 'pro' && extendProHitAreaRight}
              styles={styles}
              showNewBadge={option.value === 'pro' && showProNewBadge}
              newLabel={t('page.perps.pro.mode.new')}
            />
          );
        }
        const selected = option.value === activeMode;
        const optionDisabled = disabled || selected;
        return (
          <Pressable
            key={option.value}
            accessibilityLabel={`${option.label} mode`}
            accessibilityRole="tab"
            accessibilityState={{
              disabled: optionDisabled,
              selected,
            }}
            disabled={optionDisabled}
            onPress={() => onSelectMode(option.value)}
            onPressIn={() => onPressInMode?.(option.value)}
            onPressOut={() => onPressOutMode?.(option.value)}
            style={[
              styles.optionTarget,
              option.value === 'pro' && extendProHitAreaRight
                ? styles.extendedProTarget
                : null,
            ]}
            testID={`perps-mode-${option.value}`}>
            <View style={styles.optionContent}>
              <Text style={selected ? styles.activeText : styles.inactiveText}>
                {option.label}
              </Text>
              {option.value === 'pro' && showProNewBadge ? (
                <View
                  pointerEvents="none"
                  style={styles.newBadge}
                  testID="perps-pro-new-badge">
                  <Text style={styles.newBadgeText}>
                    {t('page.perps.pro.mode.new')}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

/** Only native presentation/input lives here; React still owns business state. */
const RootModeOption = React.memo(function RootModeOption({
  option,
  index,
  pagerUI,
  disabled,
  extended,
  styles,
  showNewBadge,
  newLabel,
}: {
  option: (typeof MODE_OPTIONS)[number];
  index: number;
  pagerUI: RootScenePagerUI;
  disabled: boolean;
  extended: boolean;
  styles: ReturnType<typeof getStyle.getStyles>;
  showNewBadge: boolean;
  newLabel: string;
}) {
  const { position, selectedIndex, select } = pagerUI;
  const activeStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, position.value));
    return { opacity: index === 0 ? 1 - progress : progress };
  });
  const inactiveStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, position.value));
    return { opacity: index === 0 ? progress : 1 - progress };
  });
  const accessibilityProps = useAnimatedProps(() => ({
    accessibilityState: {
      disabled,
      selected: selectedIndex.value === index,
    },
  }));
  const gesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!disabled)
        .maxDistance(10)
        .onEnd((_event, success) => {
          'worklet';
          if (success && !disabled) {
            select(index);
          }
        }),
    [disabled, index, select],
  );
  const activateAccessible = useCallback(() => {
    if (!disabled) {
      runOnUI(select)(index);
    }
  }, [disabled, index, select]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityLabel={
          showNewBadge
            ? `${option.label} mode, ${newLabel}`
            : `${option.label} mode`
        }
        accessibilityRole="tab"
        accessibilityActions={[{ name: 'activate' }]}
        animatedProps={accessibilityProps}
        collapsable={false}
        onAccessibilityTap={activateAccessible}
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'activate') {
            activateAccessible();
          }
        }}
        style={[
          styles.optionTarget,
          extended ? styles.extendedProTarget : null,
        ]}
        testID={`perps-mode-${option.value}`}>
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.optionContent}>
          <View style={styles.labelStack}>
            <AnimatedText
              style={[styles.activeText, activeStyle]}
              testID={`perps-mode-${option.value}-active-label`}>
              {option.label}
            </AnimatedText>
            <AnimatedText
              style={[
                styles.inactiveText,
                styles.inactiveOverlay,
                inactiveStyle,
              ]}
              testID={`perps-mode-${option.value}-inactive-label`}>
              {option.label}
            </AnimatedText>
          </View>
          {showNewBadge ? (
            <View style={styles.newBadge} testID="perps-pro-new-badge">
              <Text style={styles.newBadgeText}>{newLabel}</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 44,
  },
  extendedContainer: {
    flex: 1,
    minWidth: 0,
  },
  optionTarget: {
    height: '100%',
    justifyContent: 'center',
  },
  extendedProTarget: {
    alignItems: 'flex-start',
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  optionContent: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  labelStack: {
    position: 'relative',
  },
  inactiveOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  newBadge: {
    backgroundColor: colors2024['red-light-1'],
    borderRadius: 4,
    // Keep the overlap in the content row; legacy Yoga percentage insets use
    // the expanded press target's available width instead of the label width.
    flexShrink: 0,
    marginLeft: -4,
    paddingHorizontal: 4,
    transform: [{ translateY: -8 }],
  },
  newBadgeText: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 16,
  },
  activeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
  inactiveText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 24,
    color: colors2024['neutral-secondary'],
  },
}));
