import * as React from 'react';
import { TextProps, Text } from 'react-native';
import TouchableView from './TouchableView';

export default function TouchableText({
  textStyle,
  children,
  text = '',
  ...props
}: React.ComponentProps<typeof TouchableView> & {
  textStyle?: TextProps['style'];
  text?: string;
}) {
  return (
    <TouchableView
      {...props}
      style={[
        {
          // // leave here for debug
          // borderColor: 'blue',
          // borderWidth: 1
        },
        props.style,
      ]}>
      <Text style={textStyle}>{text}</Text>
    </TouchableView>
  );
}
