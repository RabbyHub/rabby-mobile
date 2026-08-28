import { Text } from '@/components/Typography';
import type { PerpsViewMode } from '@/core/services/perpsService';
import { FontNames } from '@/core/utils/fonts';
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
            style={
              option.value === 'pro' && extendProHitAreaRight
                ? styles.extendedProTarget
                : undefined
            }
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
    gap: 8,
  },
  extendedContainer: {
    flex: 1,
    height: 26,
    minWidth: 0,
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
    left: 16,
    paddingHorizontal: 2,
    position: 'absolute',
    top: -10,
  },
  newBadgeText: {
    color: colors2024['red-default'],
    fontFamily: FontNames.sf_pro_rounded_medium,
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 16,
  },
  activeText: {
    fontFamily: FontNames.sf_pro,
    fontSize: 18,
    fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 22,
    color: colors2024['neutral-title-1'],
  },
  inactiveText: {
    fontFamily: FontNames.sf_pro,
    fontSize: 14,
    fontWeight: '500',
    includeFontPadding: false,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
}));
