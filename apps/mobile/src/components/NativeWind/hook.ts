import { useRef } from 'react';
import { StyleSheet, StyleProp } from 'react-native';
import clsx from 'clsx';

export function useWindFallbackStyle<T>(compiledStyle: StyleProp<T>) {
  const firstStyle = useRef(compiledStyle);

  return StyleSheet.flatten([firstStyle.current, compiledStyle]);
}

export function useWindClassname(className?: string) {
  const firstClass = useRef(className);

  return clsx(firstClass.current, className);
}
