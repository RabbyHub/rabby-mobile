import React from 'react';
import { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { apisAutoLock } from '@/core/apis';

type Props = React.ComponentProps<typeof BottomSheetBackdrop>;
export const RefreshAutoLockBottomSheetBackdrop = React.memo(
  ({ onPress, ...props }: Props) => {
    const handlePress = React.useCallback<Props['onPress'] & object>(() => {
      apisAutoLock.uiRefreshTimeout();
      onPress?.();
    }, [onPress]);
    return <BottomSheetBackdrop {...props} onPress={handlePress} />;
  },
);
