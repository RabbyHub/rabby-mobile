import { Text } from '@/components/Typography';
import type { PerpsViewMode } from '@/core/services/perpsService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export type PerpsModeSwitchProps = {
  activeMode: PerpsViewMode;
  disabled?: boolean;
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
      {MODE_OPTIONS.map(option => {
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
    position: 'relative',
  },
  newBadge: {
    backgroundColor: colors2024['red-light-1'],
    borderRadius: 4,
    // Keep the badge attached to the label's right edge as its font changes.
    left: '100%',
    paddingHorizontal: 4,
    position: 'absolute',
    top: -8,
    transform: [{ translateX: -4 }],
  },
  newBadgeText: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '600',
    includeFontPadding: false,
    lineHeight: 16,
  },
  activeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '800',
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
