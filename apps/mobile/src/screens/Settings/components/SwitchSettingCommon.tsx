import React from 'react';
import {
  AppSwitch2024,
  SwitchToggleType,
} from '@/components/customized/Switch2024';

export type UseValueHook = () => {
  value: boolean;
  setValue: (value: boolean) => void;
};

export const SwitchSettingCommon = React.forwardRef<
  SwitchToggleType,
  React.ComponentProps<typeof AppSwitch2024> & {
    useValueHook: UseValueHook;
  }
>(({ useValueHook, ...props }, ref) => {
  const { value, setValue } = useValueHook();

  React.useImperativeHandle(ref, () => ({
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
});
