import { AppBottomSheetTextInput } from '@/components/customized/BottomSheetTextInput';
import type { TextInput } from '@/components/Typography';
import { IS_ANDROID } from '@/core/native/utils';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import React from 'react';

type InputProps = React.ComponentProps<typeof TextInput>;

export const PerpsProBottomSheetTextInput = React.forwardRef<
  TextInput,
  InputProps
>((props, forwardedRef) =>
  IS_ANDROID ? (
    <AppBottomSheetTextInput {...props} ref={forwardedRef} />
  ) : (
    <BottomSheetTextInput
      {...props}
      ref={
        forwardedRef as React.Ref<React.ElementRef<typeof BottomSheetTextInput>>
      }
    />
  ),
);

PerpsProBottomSheetTextInput.displayName = 'PerpsProBottomSheetTextInput';
