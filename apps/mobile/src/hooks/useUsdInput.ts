import { useMemoizedFn } from 'ahooks';
import { useState } from 'react';

export const useUsdInput = () => {
  const [input, setInput] = useState('');

  const onChangeText = useMemoizedFn((v: string) => {
    if (v === '$') {
      setInput('');
    } else if (v.startsWith('$')) {
      setInput(v);
    } else if (v) {
      setInput(`$${v}`);
    } else {
      setInput(v);
    }
  });

  return {
    value: input.replace(/^\$/, ''),
    displayedValue: input,
    onChangeText,
  };
};
