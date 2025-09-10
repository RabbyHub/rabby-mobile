import React from 'react';
import { apisAutoLock } from '@/core/apis';
import AppBottomSheetBackdrop from './BottomSheetBackdrop';

type Props = React.ComponentProps<typeof AppBottomSheetBackdrop>;
export const RefreshAutoLockBottomSheetBackdrop = React.memo(
  ({ onPress, ...props }: Props) => {
    const handlePress = React.useCallback<Props['onPress'] & object>(() => {
      apisAutoLock.uiRefreshTimeout();
      onPress?.();
    }, [onPress]);
    return <AppBottomSheetBackdrop {...props} onPress={handlePress} />;
  },
);
