import { useMemoizedFn } from 'ahooks';
import { useCallback, useState } from 'react';

type UseUsdInputOptions = {
  maxDecimals?: number;
};

const isWithinDecimalLimit = (value: string, maxDecimals?: number) => {
  if (maxDecimals === undefined || !value.includes('.')) {
    return true;
  }

  const [, decimalPart = ''] = value.split('.');
  return decimalPart.length <= maxDecimals;
};

export const useUsdInput = (options?: UseUsdInputOptions) => {
  const [input, setInput] = useState('');

  const onChangeText = useCallback(
    (v: string) => {
      // Replace comma with dot for decimal point
      const normalizedValue = v.replace(/,/g, '.');
      const value = normalizedValue.startsWith('$')
        ? normalizedValue.slice(1)
        : normalizedValue;

      if (
        (/^\d*\.?\d*$/.test(value) || value === '') &&
        isWithinDecimalLimit(value, options?.maxDecimals)
      ) {
        setInput(value);
      }
    },
    [options?.maxDecimals],
  );

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
