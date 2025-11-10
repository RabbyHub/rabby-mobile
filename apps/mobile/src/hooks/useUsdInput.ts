import { useMemoizedFn } from 'ahooks';
import { useState } from 'react';

export const useUsdInput = () => {
  const [input, setInput] = useState('');

  const onChangeText = useMemoizedFn((v: string) => {
    // Replace comma with dot for decimal point
    const normalizedValue = v.replace(/,/g, '.');
    const value = normalizedValue.startsWith('$')
      ? normalizedValue.slice(1)
      : normalizedValue;

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

export const useSlTpUsdInput = ({ szDecimals }: { szDecimals: number }) => {
  const [input, setInput] = useState('');

  // Validate price input based on significant figures and decimal places
  const validatePriceInput = useMemoizedFn(
    (value: string, decimal: number): boolean => {
      if (!value || value === '0' || value === '0.') {
        return true;
      }

      // Check if it's an integer (no decimal point or ends with decimal point)
      if (!value.includes('.') || value.endsWith('.')) {
        return true; // Integers are always allowed
      }

      // Split integer and decimal parts
      const [integerPart, decimalPart] = value.split('.');

      // Check decimal places: max (6 - szDecimals)
      const maxDecimals = 6 - decimal;
      if (decimalPart.length > maxDecimals) {
        return false;
      }

      // Calculate significant figures (remove leading zeros)
      const allDigits = (integerPart + decimalPart).replace(/^0+/, '');
      if (allDigits.length > 5) {
        return false;
      }

      return true;
    },
  );

  const onChangeText = useMemoizedFn((v: string) => {
    // Replace comma with dot for decimal point
    const normalizedValue = v.replace(/,/g, '.');
    const value = normalizedValue.startsWith('$')
      ? normalizedValue.slice(1)
      : normalizedValue;

    if (
      (/^\d*\.?\d*$/.test(value) || value === '') &&
      validatePriceInput(value, szDecimals)
    ) {
      setInput(value);
    }
  });

  return {
    value: input.replace(/^\$/, ''),
    displayedValue: input ? `$${input}` : '',
    onChangeText,
  };
};
