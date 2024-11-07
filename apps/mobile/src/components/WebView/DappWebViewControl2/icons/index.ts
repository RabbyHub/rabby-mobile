import {
  makeActiveIcon2024FromCC,
  makeThemeIconFromCC,
} from '@/hooks/makeThemeIcon';

import { default as RcIconMoreCC } from './icon-more-cc.svg';
export const RcIconMore = makeActiveIcon2024FromCC(RcIconMoreCC, ctx => ({
  activeColor: ctx.colors2024['brand-default'],
  inactiveColor: ctx.colors2024['neutral-info'],
}));

import { default as RcIconNavBackCC } from './icon-nav-back-cc.svg';
export const RcIconNavBack = makeActiveIcon2024FromCC(RcIconNavBackCC, ctx => ({
  activeColor: ctx.colors2024['brand-default'],
  inactiveColor: ctx.colors2024['neutral-info'],
}));

import { default as RcIconNavForwardCC } from './icon-nav-forward-cc.svg';
export const RcIconNavForward = makeActiveIcon2024FromCC(
  RcIconNavForwardCC,
  ctx => ({
    activeColor: ctx.colors2024['brand-default'],
    inactiveColor: ctx.colors2024['neutral-info'],
  }),
);

import { default as RcIconNavReloadCC } from './icon-nav-reload.svg';
export const RcIconNavReload = makeActiveIcon2024FromCC(
  RcIconNavReloadCC,
  ctx => ({
    activeColor: ctx.colors2024['brand-default'],
    inactiveColor: ctx.colors2024['neutral-info'],
  }),
);

import { default as RcIconCloseDappCC } from './icon-close-dapp-cc.svg';
export const RcIconCloseDapp = makeActiveIcon2024FromCC(
  RcIconCloseDappCC,
  ctx => ({
    activeColor: ctx.colors2024['brand-default'],
    inactiveColor: ctx.colors2024['neutral-info'],
  }),
);
