import { RcIconNoCheck, RcIconHasCheckbox } from '@/assets/icons/common';
import { useTheme2024 } from '@/hooks/theme';

export const CheckBoxRect = ({
  checked = false,
  size = 24,
}: {
  checked?: boolean;
  size?: number;
} & RNViewProps) => {
  const { styles, colors2024 } = useTheme2024();

  if (!checked) {
    return (
      <RcIconNoCheck
        color={colors2024['neutral-body']}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <RcIconHasCheckbox
      color={colors2024['blue-default']}
      style={{ width: size, height: size }}
    />
  );
};
