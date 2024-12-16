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
