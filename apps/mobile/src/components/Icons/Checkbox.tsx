import { RcIconCheckedCC, RcIconUncheckCC } from '@/assets/icons/common';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';

export function CheckBoxCircled({
  checked = false,
  size = 16,
}: {
  checked?: boolean;
  size?: number;
} & RNViewProps) {
  const { colors } = useThemeStyles(getCheckBoxCircledStyles);

  if (!checked) {
    return (
      <RcIconUncheckCC
        color={colors['neutral-body']}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <RcIconCheckedCC
      color={colors['blue-default']}
      style={{ width: size, height: size }}
    />
  );
}

const getCheckBoxCircledStyles = createGetStyles(colors => {
  return {};
});
