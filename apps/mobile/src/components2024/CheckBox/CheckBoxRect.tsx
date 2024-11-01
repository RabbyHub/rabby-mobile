import { default as RcIconHasCheckbox } from '@/assets/icons/nextComponent/IconHasCheckbox.svg';
import { default as RcIconNoCheck } from '@/assets/icons/nextComponent/IconNoCheck.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export function CheckBoxRect({
  checked = false,
  size = 24,
}: {
  checked?: boolean;
  size?: number;
} & RNViewProps) {
  const { styles, colors2024 } = useTheme2024({ getStyle });

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
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({}));
