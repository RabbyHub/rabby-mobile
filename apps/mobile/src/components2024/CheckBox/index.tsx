import { RcIconNoCheck, RcIconHasCheckbox } from '@/assets/icons/common';
import { useTheme2024 } from '@/hooks/theme';

export const CheckBoxRect = ({
  checked = false,
  size = 24,
  style,
  testID,
  accessibilityLabel,
}: {
  checked?: boolean;
  size?: number;
} & RNViewProps) => {
  const { styles, colors2024 } = useTheme2024();
  const iconStyle = [{ width: size, height: size }, style];

  if (!checked) {
    return (
      <RcIconNoCheck
        color={colors2024['neutral-body']}
        style={iconStyle}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  return (
    <RcIconHasCheckbox
      color={colors2024['blue-default']}
      style={iconStyle}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    />
  );
};
