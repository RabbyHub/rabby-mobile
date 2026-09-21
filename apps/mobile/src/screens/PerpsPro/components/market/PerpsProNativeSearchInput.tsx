/* eslint-disable no-restricted-imports */
import React from 'react';
import { TextInput as RNTextInput, type TextInputProps } from 'react-native';

export const PerpsProNativeSearchInput = React.forwardRef<
  RNTextInput,
  TextInputProps
>((props, ref) => <RNTextInput {...props} ref={ref} />);

PerpsProNativeSearchInput.displayName = 'PerpsProNativeSearchInput';
