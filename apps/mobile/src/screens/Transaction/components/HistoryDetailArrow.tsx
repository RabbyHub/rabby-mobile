import RcIconSingleArrow from '@/assets2024/icons/history/IconSingleArrow.svg';
import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { makeHistoryDetailColors } from './detailColors';

/** The round chevron at the right of a token row on the history detail pages. */
export const HistoryDetailArrow = ({ size = 26 }: { size?: number }) => {
  const { colors2024, isLight } = useTheme2024();

  return (
    <RcIconSingleArrow
      width={size}
      height={size}
      color={makeHistoryDetailColors({ isLight, colors2024 }).cardInner}
    />
  );
};
