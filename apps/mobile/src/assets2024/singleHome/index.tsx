import { default as RcIconSendCC } from './send.svg';
import { default as RcIconSwapCC } from './swap.svg';
import { default as RcIconReceiveCC } from './receive.svg';
import { default as RcIconMoreCC } from './more.svg';
import { default as RcIconApprovalCC } from './approvals.svg';
import { default as RcIconBridgeCC } from './bridge.svg';
import { default as RcIconQueueCC } from './queue.svg';
import { default as RcIconBuyCC } from './buy.svg';

import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { ThemeColors } from '@/constant/theme';

export const RcIconSend = makeThemeIconFromCC(RcIconSendCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const RcIconSwap = makeThemeIconFromCC(RcIconSwapCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const RcIconReceive = makeThemeIconFromCC(RcIconReceiveCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const RcIconMore = makeThemeIconFromCC(RcIconMoreCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const RcIconApproval = makeThemeIconFromCC(RcIconApprovalCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const RcIconBridge = makeThemeIconFromCC(RcIconBridgeCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const RcIconQueue = makeThemeIconFromCC(RcIconQueueCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const RcIconBuy = makeThemeIconFromCC(RcIconBuyCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});
