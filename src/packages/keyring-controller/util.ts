import * as ethUtil from 'ethereumjs-util';

export const KEYRING_TYPE = {
  HdKeyring: 'HD Key Tree',
  SimpleKeyring: 'Simple Key Pair',
  HardwareKeyring: 'hardware',
  WatchAddressKeyring: 'Watch Address',
  WalletConnectKeyring: 'WalletConnect',
  GnosisKeyring: 'Gnosis',
  CoboArgusKeyring: 'CoboArgus',
} as const;

export const ERROR_MESSAGE = {
  LOCKED: 'you need to unlock wallet first',
  CANNOT_LOCK: 'Cannot unlock without a previous vault',
  DUPLICATE: "The account you're are trying to import is duplicate",
};

export const isSameAddress = (a: string, b: string) => {
  return a.toLowerCase() === b.toLowerCase();
};

export function normalizeAddress(input: number | string): string {
  if (!input) {
    return '';
  }

  if (typeof input === 'number') {
    const buffer = ethUtil.toBuffer(input);
    input = ethUtil.bufferToHex(buffer);
  }

  if (typeof input !== 'string') {
    let msg = 'eth-sig-util.normalize() requires hex string or integer input.';
    msg += ` received ${typeof input}: ${input}`;
    throw new Error(msg);
  }

  return ethUtil.addHexPrefix(input);
}
