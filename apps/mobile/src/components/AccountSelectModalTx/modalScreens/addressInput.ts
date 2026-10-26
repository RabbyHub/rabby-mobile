import type { Hex } from '@metamask/utils';
import { isValidHexAddress } from '@metamask/utils';

const LEADING_ADDRESS_BOUNDARY_WHITESPACE = /^[ \t\r\n]+/;
const TRAILING_ADDRESS_BOUNDARY_WHITESPACE = /[ \t\r\n]+$/;

type NativeTextInputSyncTarget = {
  setNativeProps?: (nativeProps: { text: string }) => void;
};

export const normalizeAddressInputBoundaryWhitespace = (value: string) => {
  const candidate = value
    .replace(LEADING_ADDRESS_BOUNDARY_WHITESPACE, '')
    .replace(TRAILING_ADDRESS_BOUNDARY_WHITESPACE, '');

  if (candidate === value || !isValidHexAddress(candidate as Hex)) {
    return value;
  }

  return candidate;
};

export const normalizeAddressInputAndSyncNativeText = (
  value: string,
  target?: NativeTextInputSyncTarget | null,
) => {
  const normalizedValue = normalizeAddressInputBoundaryWhitespace(value);

  if (normalizedValue !== value) {
    target?.setNativeProps?.({ text: normalizedValue });
  }

  return normalizedValue;
};
