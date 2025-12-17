import { default as RcIconCopyCC } from '@/assets2024/icons/address/copy-cc.svg';
import { default as RcIconQRCC } from '@/assets2024/icons/address/qr-cc.svg';

import { makeThemeIcon2024FromCC } from '@/hooks/makeThemeIcon';

export const RcIconCopy = makeThemeIcon2024FromCC(RcIconCopyCC, ctx => ({
  onDark: ctx.colors2024['neutral-body'],
  onLight: ctx.colors2024['neutral-body'],
}));

export const RcIconQR = makeThemeIcon2024FromCC(RcIconQRCC, ctx => ({
  onLight: ctx.colors2024['neutral-body'],
  onDark: ctx.colors2024['neutral-body'],
}));

import { default as RcIconAddWhitelistCC } from './add-whitelist-cc.svg';
export const RcIconAddWhitelist = makeThemeIcon2024FromCC(
  RcIconAddWhitelistCC,
  ctx => ({
    onLight: ctx.colors2024['neutral-secondary'],
    onDark: ctx.colors2024['neutral-secondary'],
  }),
);

import RcIconNavLeftCC from './nav-left-cc.svg';
export const RcIconNavLeft = makeThemeIcon2024FromCC(
  RcIconNavLeftCC,
  ctx => ({
    onLight: ctx.colors2024['neutral-body'],
    onDark: ctx.colors2024['neutral-body'],
  }),
  {
    allowColorProp: true,
  },
);

import RcIconHistoryCC from './history-cc.svg';
export const RcIconHistory = makeThemeIcon2024FromCC(RcIconHistoryCC, ctx => ({
  onLight: ctx.colors2024['neutral-body'],
  onDark: ctx.colors2024['neutral-body'],
}));
