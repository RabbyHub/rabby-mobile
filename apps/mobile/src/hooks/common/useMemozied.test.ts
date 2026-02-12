// run: ./node_modules/.bin/jest ./src/hooks/common/useMemozied.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { useCreationWithShallowCompare } from './useMemozied';
import React, { useRef } from 'react';

function useTestShallow() {
  const initListRef = useRef<string[]>([
    '0xaddr1',
    '0xaddr2',
    '0xaddr3',
    '0xaddr4',
    '0xaddr5',
  ]);
  const [top5Addrs, setTop5Addrs] = React.useState<string[]>(
    initListRef.current,
  );
  const stableTop5Addrs = useCreationWithShallowCompare(() => {
    return top5Addrs;
  }, [top5Addrs]);

  return {
    initialTop5Addrs: initListRef.current,
    stableTop5Addrs,
    setTop5Addrs,
  };
}

test('should increment counter', () => {
  const { result } = renderHook(() => {
    return useTestShallow();
  });

  const newList = ['0xaddr1', '0xaddr2', '0xaddr3', '0xaddr4', '0xaddr5'];

  expect(result.current.stableTop5Addrs === newList).toBe(false);
  expect(
    result.current.stableTop5Addrs === result.current.initialTop5Addrs,
  ).toBe(true);

  act(() => {
    result.current.setTop5Addrs(newList);
  });

  expect(result.current.stableTop5Addrs === newList).toBe(false);
  expect(
    result.current.stableTop5Addrs === result.current.initialTop5Addrs,
  ).toBe(true);
});
