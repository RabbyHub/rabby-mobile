import { useEffect, useState } from 'react';
import {
  cancelAnimation,
  makeMutable,
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useSharedValue,
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

/**
 * @see file://./../../node_modules/react-native-reanimated/src/hook/useSharedValue.ts
 * @param sv: SV
 * @returns
 */
export function useSVFromMutable<SV extends SharedValue<any>>(sv: SV): SV {
  const isv = useSharedValue(sv.value) as SV;

  useAnimatedReaction(
    () => {
      return sv.value;
    },
    cur => {
      isv.value = cur;
    },
  );
  // const [mutable] = useState(() => sv);
  // useEffect(() => {
  //   return () => {
  //     cancelAnimation(mutable);
  //   };
  // }, [mutable]);

  return isv;
}
