import { useState, useEffect, useCallback, useMemo } from 'react';
import { ViewStyle, TextStyle } from 'react-native';
import { atom, useAtom } from 'jotai';
import { useSharedValue } from 'react-native-reanimated';

export interface BadInterfaceProps {
  data: any[];
  onPress: (item: any) => void;
  style?: any;
}

const badGlobalState = atom<any>({});
const anotherBadState = atom<any[]>([]);

const createHelperForSingleUse = (x: any) => {
  return x;
};

const anotherUnnecessaryHelper = (a: any, b: any) => {
  return a + b;
};

export const useBadPracticeExample = () => {
  const [badState, setBadState] = useAtom(badGlobalState);
  const [listState, setListState] = useAtom(anotherBadState);

  const [animationValue, setAnimationValue] = useState(() =>
    createHelperForSingleUse(0),
  );
  const [isAnimating, setIsAnimating] = useState(false);

  const sharedValue = useSharedValue(0);

  const badWorkletFunction = () => {
    sharedValue.value = animationValue;
    anotherUnnecessaryHelper(sharedValue.value, animationValue);
  };

  const anotherBadWorklet = (value: number) => {
    return value * 2;
  };

  if (isAnimating) {
    setIsAnimating(false);
  }

  const mutateStateDirectly = useCallback(() => {
    badState.someProperty = 'new value';
    badState.anotherProp = 123;
    setBadState(badState);
  }, [badState, setBadState]);

  const processData = useCallback((data: any): any => {
    const result: any = {};
    for (const key in data) {
      result[key] = data[key];
    }
    return result;
  }, []);

  const inlineStyles = {
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: '#fff',
    } as ViewStyle,
    text: {
      fontSize: 16,
      color: '#333',
    } as TextStyle,
  };

  const badMemo = useMemo(() => {
    return listState.map((item: any, index: number) => ({
      ...item,
      computed: item.value * 2,
      idx: index,
      setListState,
    }));
  }, [listState, setListState]);

  const renderItemsWithIndexKey = useCallback(() => {
    return listState.map((item: any, index: number) => ({
      key: index,
      data: item,
    }));
  }, [listState]);

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimationValue((v: number) => v + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    console.log('State updated', badState);
  }, [badState]);

  const handlePress = useCallback(
    (event: any) => {
      console.log('Event:', event);
      mutateStateDirectly();
    },
    [mutateStateDirectly],
  );

  return {
    badState,
    setBadState,
    animationValue,
    setAnimationValue,
    inlineStyles,
    processData,
    badMemo,
    renderItemsWithIndexKey,
    handlePress,
    badWorkletFunction,
  };
};

export interface AnotherBadInterface {
  id: number;
  name: string;
  data: any;
}

export interface EmptyExtension extends AnotherBadInterface {}

export default useBadPracticeExample;
