import React from 'react';
import { Image, ImageProps, StyleSheet } from 'react-native';

export const ClaimUserAvatar = (props: Omit<ImageProps, 'source'>) => {
  const styles = StyleSheet.create({
    container: {
      height: 20,
      width: 20,
      borderRadius: 20,
    },
  });
  return (
    <Image
      {...props}
      style={StyleSheet.flatten([styles.container, props.style])}
      source={
        props.src
          ? { uri: props.src }
          : require('@/assets/icons/points/default-avatar.png')
      }
    />
  );
};
