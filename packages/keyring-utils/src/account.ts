import { BRAND_ALIAS_TYPE_TEXT, KEYRING_CLASS, KEYRING_TYPE } from './types';

// eslint-disable-next-line jsdoc/require-jsdoc
export function generateAliasName({
  keyringType,
  brandName,
  keyringCount = 0,
  addressCount = 0,
}: {
  keyringType: string;
  brandName?: string;
  keyringCount?: number;
  addressCount?: number;
}) {
  if (keyringType === KEYRING_CLASS.MNEMONIC) {
    return `Seed Phrase ${keyringCount + 1} #${addressCount + 1}`;
  } else if (keyringType === KEYRING_TYPE.SimpleKeyring) {
    return `Private Key ${keyringCount + 1}`;
  }
  if (
    keyringType === KEYRING_TYPE.WatchAddressKeyring ||
    brandName === KEYRING_TYPE.WatchAddressKeyring
  ) {
    return `Contact ${addressCount + 1}`;
  }
  if (brandName) {
    return `${
      BRAND_ALIAS_TYPE_TEXT[brandName as keyof typeof BRAND_ALIAS_TYPE_TEXT] ||
      brandName
    } ${addressCount + 1}`;
  }

  return `${
    BRAND_ALIAS_TYPE_TEXT[keyringType as keyof typeof BRAND_ALIAS_TYPE_TEXT] ||
    brandName
  } ${addressCount + 1}`;
}
