export * from '@rabby-wallet/biz-utils/dist/isomorphic/biz-number';

import { Dimensions } from 'react-native';
import { coerceNumber } from './coerce';

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
