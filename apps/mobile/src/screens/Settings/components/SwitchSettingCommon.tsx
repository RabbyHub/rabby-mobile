import React, { useImperativeHandle } from 'react';
import {
  AppSwitch2024,
  SwitchToggleRefProp,
} from '@/components/customized/Switch2024';

export type UseValueHook = () => {
  value: boolean;
  setValue: (value: boolean) => void;
};

export const SwitchSettingCommon = ({
  useValueHook,
  ref,
  ...props
}: React.ComponentProps<typeof AppSwitch2024> & {
  useValueHook: UseValueHook;
} & SwitchToggleRefProp) => {
  const { value, setValue } = useValueHook();

  useImperativeHandle(ref, () => ({
    toggle: async (enabled?: boolean) => {
      setValue(enabled ?? !value);
    },
  }));

  return (
    <AppSwitch2024
      circleSize={20}
      changeValueImmediately={false}
      {...props}
      value={!!value}
      onValueChange={setValue}
      // onPress={evt => {
      //   evt.preventDefault();
      //   props.onPress?.(evt);
      // }}
    />
  );
};
