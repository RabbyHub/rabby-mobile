import React from 'react';
import { TextProps } from 'react-native';

import { Text } from '@/components/Typography';
import { tokenizeSignMessageText } from './signMessageTokenizer';

export const HighlightedSignMessageText = ({
  text,
  highlightStyle,
  ...props
}: TextProps & {
  text: string;
  highlightStyle?: TextProps['style'];
}) => (
  <Text {...props}>
    {tokenizeSignMessageText(text).map((token, index) =>
      token.type === 'text' ? (
        <React.Fragment key={`text-${index}`}>{token.value}</React.Fragment>
      ) : (
        <Text key={`${token.type}-${index}`} style={highlightStyle}>
          {token.value}
        </Text>
      ),
    )}
  </Text>
);
