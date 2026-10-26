import * as apisAutoLock from '@/core/apis/autoLock';
import { useTheme2024 } from '@/hooks/theme';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import React from 'react';

/** Opt in only the Pro dialogs covered by the September design update. */
export const PerpsProDialogBackdrop = (
  props: BottomSheetBackdropProps & {
    pressBehavior?: 'close' | 'none';
  },
) => {
  const { colors2024 } = useTheme2024();
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      onPress={apisAutoLock.uiRefreshTimeout}
      opacity={0.3}
      style={[props.style, { backgroundColor: colors2024['neutral-black'] }]}
    />
  );
};
