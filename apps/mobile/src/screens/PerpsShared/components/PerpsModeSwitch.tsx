import { Text } from '@/components/Typography';
import type { PerpsViewMode } from '@/core/services/perpsService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';

export type PerpsModeSwitchProps = {
  activeMode: PerpsViewMode;
  disabled?: boolean;
  extendProHitAreaRight?: boolean;
  onSelectMode: (viewMode: PerpsViewMode) => void;
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
  onSelectMode,
}) => {
  const { styles } = useTheme2024({ getStyle });

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
            style={
              option.value === 'pro' && extendProHitAreaRight
                ? styles.extendedProTarget
                : undefined
            }
            testID={`perps-mode-${option.value}`}>
            <Text style={selected ? styles.activeText : styles.inactiveText}>
              {option.label}
            </Text>
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
  activeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  inactiveText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
