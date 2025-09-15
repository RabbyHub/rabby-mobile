import { KeyboardAvoidingView, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

export type ReactNativeViewAsMap = {
  View: typeof View;
  KeyboardAvoidingView: typeof KeyboardAvoidingView;
  KeyboardAwareScrollView: typeof KeyboardAwareScrollView;
};
export type ReactNativeViewAs = keyof ReactNativeViewAsMap;

export function getViewComponentByAs<T extends ReactNativeViewAs>(
  as: T = 'View' as T,
) {
  switch (as) {
    case 'KeyboardAvoidingView':
      return KeyboardAvoidingView as any as React.FC<
        React.ComponentProps<typeof KeyboardAvoidingView>
      >;
    case 'KeyboardAwareScrollView':
      return KeyboardAwareScrollView as any as React.FC<
        React.ComponentProps<typeof KeyboardAwareScrollView>
      >;
    case 'View':
    default:
      return View as any as React.FC<React.ComponentProps<typeof View>>;
  }
}
