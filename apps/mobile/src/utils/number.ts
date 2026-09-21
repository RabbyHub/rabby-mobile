export * from '@rabby-wallet/biz-utils/dist/isomorphic/biz-number';

import { Dimensions } from 'react-native';
import { formatSpeicalAmount as normalizeSpeicalAmount } from '@rabby-wallet/biz-utils/dist/isomorphic/biz-number';
import { coerceNumber } from './coerce';

export const truncateAmountToDecimals = (
  inputValue: string,
  tokenDecimals?: number | null,
) => {
  if (tokenDecimals === undefined || tokenDecimals === null) {
    return inputValue;
  }

  const decimalsLimit =
    Number.isFinite(tokenDecimals) && tokenDecimals > 0
      ? Math.floor(tokenDecimals)
      : 0;
  const [whole, decimals] = inputValue.split('.');

  if (decimals === undefined) {
    return inputValue;
  }

  if (decimalsLimit === 0) {
    return whole;
  }

  if (decimals.length <= decimalsLimit) {
    return inputValue;
  }

  return `${whole}.${decimals.slice(0, decimalsLimit)}`;
};

export const formatTokenAmountInput = (
  inputValue: number | string,
  tokenDecimals?: number | null,
) =>
  truncateAmountToDecimals(normalizeSpeicalAmount(inputValue), tokenDecimals);

export function calcAspectRatio(
  orig?: null | { height?: number; width?: number },
  {
    maxWidth = Dimensions.get('window').width - 20,
    maxHeight,
  }: { maxWidth?: number; maxHeight?: number } = {},
) {
  const shaped = {
    height: coerceNumber(orig?.height, 100),
    width: coerceNumber(orig?.width, 100),
  };

  const aspectRatio = coerceNumber(
    maxHeight ? shaped.height / maxHeight : shaped.width / maxWidth,
    1,
  );

  return {
    aspectRatio,
    height: Math.floor(shaped.height / aspectRatio),
    width: Math.floor(shaped.width / aspectRatio),
  };
}

export function isMeaningfulNumber(input: any): input is number {
  return typeof input === 'number' && !Number.isNaN(input);
}
