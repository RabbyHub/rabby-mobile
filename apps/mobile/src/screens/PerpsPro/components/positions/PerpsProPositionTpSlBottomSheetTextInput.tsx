import { TextInput } from '@/components/Typography';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React from 'react';

export const PerpsProPositionTpSlBottomSheetTextInput = React.forwardRef<
  TextInput,
  React.ComponentProps<typeof TextInput>
>((props, forwardedRef) => (
  <BottomSheetTextInput
    {...props}
    ref={
      forwardedRef as React.Ref<React.ElementRef<typeof BottomSheetTextInput>>
    }
  />
));

PerpsProPositionTpSlBottomSheetTextInput.displayName =
  'PerpsProPositionTpSlBottomSheetTextInput';
