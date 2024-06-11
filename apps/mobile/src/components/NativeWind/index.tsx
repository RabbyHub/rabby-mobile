import React from 'react';
import { View, Text } from 'react-native';
import { styled } from 'nativewind';
import { useWindFallbackStyle } from './hook';

/** @deprecated */
export const WindView = styled(
  ({ style, ...rest }: React.ComponentProps<typeof View>) => {
    const mergedStyle = useWindFallbackStyle(style);

    return <View style={mergedStyle} {...rest} />;
  },
);

/** @deprecated */
export const WindText = styled(
  ({ style, className, ...rest }: React.ComponentProps<typeof Text>) => {
    const mergedStyle = useWindFallbackStyle(style);

    return <Text style={mergedStyle} {...rest} />;
  },
);
