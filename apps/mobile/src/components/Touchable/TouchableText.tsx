import * as React from 'react';
import { TextProps, Text } from 'react-native';
import TouchableView from './TouchableView';

export default function TouchableText({
  onPress,
  touchableProps,
  children,
  ...props
}: {
  onPress?: React.ComponentProps<typeof TouchableView>['onPress'];
  touchableProps?: Omit<
    React.ComponentProps<typeof TouchableView>,
    'children' | 'onPress' | 'ref'
  >;
  children?: string;
} & TextProps) {
  const handlePress = React.useCallback(
    evt => {
      onPress?.(evt);
    },
    [onPress],
  );

  return (
    <TouchableView {...touchableProps} onPress={handlePress}>
      <Text {...props}>{children}</Text>
    </TouchableView>
  );
}
