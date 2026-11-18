import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useSystemColumnInset } from './backdrop';

/**
 * Inset a native header slot by the foldable system column.
 *
 * Native stack headers lay their trailing items out against the full window
 * width, so on the Duo outer screen a `headerRight` would sit under the system
 * column. Wrap those items (or a custom header row's trailing edge) with this
 * component; `0` on every device that does not mount the frame.
 */
export function SafeWindowHeaderInset({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { left, right } = useSystemColumnInset();

  if (!left && !right) {
    return <>{children}</>;
  }

  return (
    <View
      style={[
        style,
        left > 0 && { paddingLeft: left },
        right > 0 && { paddingRight: right },
      ]}>
      {children}
    </View>
  );
}
