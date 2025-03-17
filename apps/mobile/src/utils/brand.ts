import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils/dist/types';

interface IColors {
  brandColor: string;
  brandBg: string;
}
const CEX_BRAND_COLORS: { [key: string]: IColors } = {
  binance: {
    brandColor: 'rgba(255, 170, 0, 1)',
    brandBg: 'rgba(255, 207, 60, 0.2)',
  },
  coinbase: {
    brandColor: 'rgba(0, 82, 255, 1)',
    brandBg: 'rgba(0, 82, 255, 0.2)',
  },
  okx: {
    brandColor: 'rgba(0, 0, 0, 1)',
    brandBg: 'rgba(0, 0, 0, 0.2)',
  },
  mexc: {
    brandColor: 'rgba(21, 99, 255, 1)',
    brandBg: 'rgba(21, 99, 255, 0.2)',
  },
  gate: {
    brandColor: 'rgba(0, 104, 255, 1)',
    brandBg: 'rgba(0, 104, 255, 0.2)',
  },
  kucoin: {
    brandColor: 'rgba(1, 188, 141, 1)',
    brandBg: 'rgba(1, 188, 141, 0.2)',
  },
  bybit: {
    brandColor: 'rgba(247, 167, 0, 1)',
    brandBg: 'rgba(247, 167, 0, 0.2)',
  },
  bitget: {
    brandColor: 'rgba(0, 219, 233, 1)',
    brandBg: 'rgba(0, 219, 233, 0.2)',
  },
  crypto: {
    brandColor: 'rgba(11, 20, 38, 1)',
    brandBg: 'rgba(11, 20, 38, 0.2)',
  },
  kraken: {
    brandColor: 'rgba(113, 51, 245, 1)',
    brandBg: 'rgba(113, 51, 245, 0.2)',
  },
};
const CEX_BRAND_COLORS_DARK: { [key: string]: IColors } = {
  binance: {
    brandColor: 'rgba(255, 170, 0, 1)',
    brandBg: 'rgba(255, 207, 60, 0.2)',
  },
  coinbase: {
    brandColor: 'rgba(0, 82, 255, 1)',
    brandBg: 'rgba(0, 82, 255, 0.2)',
  },
  okx: {
    brandColor: 'rgba(255, 255, 255, 1)',
    brandBg: 'rgba(255, 255, 255, 0.2)',
  },
  mexc: {
    brandColor: 'rgba(21, 99, 255, 1)',
    brandBg: 'rgba(21, 99, 255, 0.2)',
  },
  gate: {
    brandColor: 'rgba(0, 104, 255, 1)',
    brandBg: 'rgba(0, 104, 255, 0.2)',
  },
  kucoin: {
    brandColor: 'rgba(1, 188, 141, 1)',
    brandBg: 'rgba(1, 188, 141, 0.2)',
  },
  bybit: {
    brandColor: 'rgba(247, 167, 0, 1)',
    brandBg: 'rgba(247, 167, 0, 0.2)',
  },
  bitget: {
    brandColor: 'rgba(0, 219, 233, 1)',
    brandBg: 'rgba(0, 219, 233, 0.2)',
  },
  crypto: {
    brandColor: 'rgba(0, 0, 0, 1)',
    brandBg: 'rgba(0, 0, 0, 0.2)',
  },
  kraken: {
    brandColor: 'rgba(113, 51, 245, 1)',
    brandBg: 'rgba(113, 51, 245, 0.2)',
  },
};
const ACCOUT_TYPE_COLORS_DARK: { [key: string]: IColors } = {
  [KEYRING_CLASS.PRIVATE_KEY]: {
    brandColor: 'rgba(255, 159, 10, 1)',
    brandBg: 'rgba(255, 159, 10, 0.2)',
  },
  [KEYRING_CLASS.MNEMONIC]: {
    brandColor: 'rgba(112, 132, 255, 1)',
    brandBg: 'rgba(112, 132, 255, 0.2)',
  },
  [KEYRING_CLASS.HARDWARE.LEDGER]: {
    brandColor: 'rgba(255, 255, 255, 1)',
    brandBg: 'rgba(255, 255, 255, 0.2)',
  },
  [KEYRING_CLASS.HARDWARE.ONEKEY]: {
    brandColor: 'rgba(34, 197, 43, 1)',
    brandBg: 'rgba(34, 197, 43, 0.2)',
  },
  [KEYRING_CLASS.HARDWARE.KEYSTONE]: {
    brandColor: 'rgba(31, 90, 255, 1)',
    brandBg: 'rgba(31, 90, 255, 0.2)',
  },
  [KEYRING_CLASS.GNOSIS]: {
    brandColor: 'rgba(48, 222, 69, 1)',
    brandBg: 'rgba(104, 255, 122, 0.2)',
  },
};
const ACCOUT_TYPE_COLORS: { [key: string]: IColors } = {
  [KEYRING_CLASS.PRIVATE_KEY]: {
    brandColor: 'rgba(255, 159, 10, 1)',
    brandBg: 'rgba(255, 159, 10, 0.2)',
  },
  [KEYRING_CLASS.MNEMONIC]: {
    brandColor: 'rgba(112, 132, 255, 1)',
    brandBg: 'rgba(112, 132, 255, 0.2)',
  },
  [KEYRING_CLASS.HARDWARE.LEDGER]: {
    brandColor: 'rgba(0, 0, 0, 1)',
    brandBg: 'rgba(0, 0, 0, 0.2)',
  },
  [KEYRING_CLASS.HARDWARE.ONEKEY]: {
    brandColor: 'rgba(34, 197, 43, 1)',
    brandBg: 'rgba(34, 197, 43, 0.2)',
  },
  [KEYRING_CLASS.HARDWARE.KEYSTONE]: {
    brandColor: 'rgba(31, 90, 255, 1)',
    brandBg: 'rgba(31, 90, 255, 0.2)',
  },
  [KEYRING_CLASS.GNOSIS]: {
    brandColor: 'rgba(48, 222, 69, 1)',
    brandBg: 'rgba(104, 255, 122, 0.2)',
  },
};
export const getBrandColors = (brandName: string, isLight?: boolean) => {
  const brandColor = isLight
    ? CEX_BRAND_COLORS[brandName]
    : CEX_BRAND_COLORS_DARK[brandName];
  const accountTypeColor = isLight
    ? ACCOUT_TYPE_COLORS[brandName]
    : ACCOUT_TYPE_COLORS_DARK[brandName];
  const defaultColor = isLight
    ? {
        brandColor: 'rgba(0, 0, 0, 1)',
        brandBg: 'rgba(0, 0, 0, 0.2)',
      }
    : {
        brandColor: 'rgba(255, 255, 255, 1)',
        brandBg: 'rgba(255, 255, 255, 0.2)',
      };
  return brandColor || accountTypeColor || defaultColor;
};
