import React from 'react';
import {StyleProp, StyleSheet} from 'react-native';
import {Text} from '@/components';

/**
 *
 * https://github.com/react-native-elements/react-native-elements/blob/9e26230cdfb90f22b26dc8b7362ef5ac5d5a9f81/packages/base/src/helpers/renderNode.tsx#L3
 */
export const renderNode = (
  Component: any,
  content: any,
  defaultProps: any = {},
) => {
  if (content == null || content === false) {
    return null;
  }
  if (React.isValidElement(content)) {
    return content;
  }
  if (typeof content === 'function') {
    return content();
  }
  // Just in case
  if (content === true) {
    return <Component {...defaultProps} />;
  }
  if (typeof content === 'string') {
    if (content.length === 0) {
      return null;
    }
    return <Component {...defaultProps}>{content}</Component>;
  }
  if (typeof content === 'number') {
    return <Component {...defaultProps}>{content}</Component>;
  }
  return <Component {...defaultProps} {...content} />;
};

export const renderText = (
  content: any,
  defaultProps: any,
  style?: StyleProp<any>,
) =>
  renderNode(Text, content, {
    ...defaultProps,
    style: StyleSheet.flatten([style, defaultProps && defaultProps.style]),
  });
