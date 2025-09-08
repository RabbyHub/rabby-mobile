import { useMemoizedFn } from 'ahooks';
import { useState } from 'react';

export const useUsdInput = () => {
  const [input, setInput] = useState('');

  const onChangeText = useMemoizedFn((v: string) => {
    const value = v.startsWith('$') ? v.slice(1) : v;

    if (/^\d*\.?\d*$/.test(value) || value === '') {
      setInput(value);
    }
  });

  return {
    value: input.replace(/^\$/, ''),
    displayedValue: input ? `$${input}` : '',
    onChangeText,
  };
};
