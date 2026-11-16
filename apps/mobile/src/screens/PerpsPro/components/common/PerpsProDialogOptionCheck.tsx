import RcOptionCheck from '@/assets2024/icons/perps/PerpsProOptionCheck.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import type { ViewStyle } from 'react-native';

// Option padding inside the 1pt border (getPerpsProDialogStyles option).
const OPTION_PADDING = 15;
const CHECK_SIZE = 24;

/** Selected-option check (Figma 86609:302587), centered on the title line. */
export const PerpsProDialogOptionCheck: React.FC<{
  active: boolean;
  titleLineHeight?: number;
}> = ({ active, titleLineHeight = 20 }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const positionStyle = React.useMemo<ViewStyle>(
    () => ({ top: OPTION_PADDING + titleLineHeight / 2 - CHECK_SIZE / 2 }),
    [titleLineHeight],
  );
  if (!active) {
    return null;
  }
  return (
    <RcOptionCheck
      color={colors2024['green-default']}
      height={CHECK_SIZE}
      pointerEvents="none"
      style={[styles.check, positionStyle]}
      testID="perps-pro-dialog-option-check"
      width={CHECK_SIZE}
    />
  );
};

const getStyle = createGetStyles2024(() => ({
  check: {
    position: 'absolute',
    right: OPTION_PADDING,
  },
}));
