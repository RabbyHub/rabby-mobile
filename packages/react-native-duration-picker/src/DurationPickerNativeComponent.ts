import type React from 'react';
import type { HostComponent, ViewProps } from 'react-native';
import type {
  DirectEventHandler,
  Int32,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands';

export interface NativeProps extends ViewProps {
  durationMinutes: Int32;
  minimumDurationMinutes?: WithDefault<Int32, 0>;
  minuteLabels?: ReadonlyArray<string>;
  androidLocale?: string;
  sessionId: Int32;
  dark?: WithDefault<boolean, false>;
  enabled?: WithDefault<boolean, true>;
  onDurationChange?: DirectEventHandler<{
    minutes: Int32;
    sessionId: Int32;
  }>;
  onValueRead?: DirectEventHandler<{
    minutes: Int32;
    sessionId: Int32;
    requestId: Int32;
  }>;
}

type PickerComponent = HostComponent<NativeProps>;
interface NativeCommands {
  readCurrentValue: (
    viewRef: React.ElementRef<PickerComponent>,
    requestId: Int32,
  ) => void;
}

export const Commands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['readCurrentValue'],
});

export default codegenNativeComponent<NativeProps>(
  'RabbyDurationPicker',
) as PickerComponent;
