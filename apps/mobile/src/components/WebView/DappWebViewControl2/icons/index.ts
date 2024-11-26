import {
  makeActiveIcon2024FromCC,
  makeThemeIcon2024FromCC,
} from '@/hooks/makeThemeIcon';

import { default as RcIconMoreCC } from './icon-more-cc.svg';
export const RcIconMore = makeActiveIcon2024FromCC(RcIconMoreCC, ctx => ({
  activeColor: ctx.colors2024['brand-default'],
  inactiveColor: ctx.colors2024['neutral-info'],
}));

import { default as RcIconNavBackCC } from './icon-nav-back-cc.svg';
export const RcIconNavBack = makeActiveIcon2024FromCC(RcIconNavBackCC, ctx =>
  ctx.isLight
    ? {
        activeColor: ctx.colors2024['brand-default'],
        inactiveColor: ctx.colors2024['neutral-info'],
      }
    : {
        activeColor: ctx.colors2024['brand-default'],
        inactiveColor: ctx.colors2024['neutral-secondary'],
      },
);

import { default as RcIconNavForwardCC } from './icon-nav-forward-cc.svg';
export const RcIconNavForward = makeActiveIcon2024FromCC(
  RcIconNavForwardCC,
  ctx =>
    ctx.isLight
      ? {
          activeColor: ctx.colors2024['brand-default'],
          inactiveColor: ctx.colors2024['neutral-info'],
        }
      : {
          activeColor: ctx.colors2024['brand-default'],
          inactiveColor: ctx.colors2024['neutral-secondary'],
        },
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
export const RcIconCloseDapp = makeThemeIcon2024FromCC(
  RcIconCloseDappCC,
  ctx => ({
    onLight: ctx.colors2024['neutral-title-1'],
    onDark: ctx.colors2024['neutral-title-1'],
  }),
);
