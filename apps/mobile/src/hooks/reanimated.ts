import { useState } from 'react';
import {
  runOnJS,
  SharedValue,
  useAnimatedReaction,
} from 'react-native-reanimated';

type ExtractValueType<T> = T extends SharedValue<infer U> ? U : never;
export function useValueFromSharedValue<T extends SharedValue<any>>(sv: T) {
  const [value, setValue] = useState<ExtractValueType<T>>(sv.value);
  useAnimatedReaction(
    () => {
      return sv.value;
    },
    value => {
      runOnJS(setValue)(value);
    },
  );

  return value;
}
