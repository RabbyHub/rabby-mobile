import { Text } from '@/components/Typography';
import type { PerpsViewMode } from '@/core/services/perpsService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

/**
 * Tabs of the Perps header: the two persisted view modes plus Spot, a
 * navigation shortcut to the spot screens that never changes the saved mode.
 */
export type PerpsHeaderMode = PerpsViewMode | 'spot';

export type PerpsModeSwitchProps = {
  activeMode: PerpsHeaderMode;
  disabled?: boolean;
  /** Let the last tab own the remaining header width as its press target. */
  extendProHitAreaRight?: boolean;
  onPressInMode?: (viewMode: PerpsViewMode) => void;
  onPressOutMode?: (viewMode: PerpsViewMode) => void;
  onSelectMode: (viewMode: PerpsViewMode) => void;
  /** Opens the spot screens; the tab is hidden when absent. */
  onSelectSpot?: () => void;
  showProNewBadge?: boolean;
};

const MODE_OPTIONS: ReadonlyArray<{
  label: string;
  value: PerpsViewMode;
}> = [
  { label: 'Perps', value: 'simple' },
  { label: 'Pro', value: 'pro' },
];

const SPOT_OPTION = { label: 'Spot', value: 'spot' } as const;

export const PerpsModeSwitch: React.FC<PerpsModeSwitchProps> = ({
  activeMode,
  disabled = false,
  extendProHitAreaRight = false,
  onPressInMode,
  onPressOutMode,
  onSelectMode,
  onSelectSpot,
  showProNewBadge = false,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const options: ReadonlyArray<{ label: string; value: PerpsHeaderMode }> =
    onSelectSpot ? [...MODE_OPTIONS, SPOT_OPTION] : MODE_OPTIONS;
  const lastValue = options[options.length - 1].value;

  return (
    <View
      style={[
        styles.container,
        extendProHitAreaRight ? styles.extendedContainer : null,
      ]}
      testID="perps-mode-switch">
      {options.map(option => {
        const selected = option.value === activeMode;
        const optionDisabled = disabled || selected;
        // Spot is a navigation shortcut; only the two saved modes reach the
        // mode callbacks.
        const modeValue: PerpsViewMode | null =
          option.value === 'spot' ? null : option.value;
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
            onPress={() =>
              modeValue ? onSelectMode(modeValue) : onSelectSpot?.()
            }
            onPressIn={() => modeValue && onPressInMode?.(modeValue)}
            onPressOut={() => modeValue && onPressOutMode?.(modeValue)}
            style={[
              styles.optionTarget,
              option.value === lastValue && extendProHitAreaRight
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
