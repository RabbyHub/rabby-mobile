import { default as RcIconSendCC } from './send-cc.svg';
import { default as RcIconSwapCC } from './swap-cc.svg';
import { default as RcIconReceiveCC } from './receive-cc.svg';
import { default as RcIconOldReceiveCC } from './old-receive.svg';
import { default as RcIconMoreCC } from './more-cc.svg';
import { default as RcIconApprovalCC } from './approvals-cc.svg';
import { default as RcIconBridgeCC } from './bridge-cc.svg';
import { default as RcIconQueueCC } from './queue-cc.svg';
import { default as RcIconBuyCC } from './buy-cc.svg';
import { default as RcIconImportCC } from './import.svg';

import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { ThemeColors, ThemeColors2024 } from '@/constant/theme';

export const RcIconSend = makeThemeIconFromCC(RcIconSendCC, {
  onLight: ThemeColors2024.light['brand-default-icon'],
  onDark: ThemeColors2024.dark['brand-default-icon'],
});

export const RcIconSwap = makeThemeIconFromCC(RcIconSwapCC, {
  onLight: ThemeColors2024.light['brand-default-icon'],
  onDark: ThemeColors2024.dark['brand-default-icon'],
});

export const RcIconReceive = makeThemeIconFromCC(RcIconReceiveCC, {
  onLight: ThemeColors2024.light['brand-default-icon'],
  onDark: ThemeColors2024.dark['brand-default-icon'],
});

export const RcIconOldReceive = makeThemeIconFromCC(RcIconOldReceiveCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const RcIconMore = makeThemeIconFromCC(RcIconMoreCC, {
  onLight: ThemeColors2024.light['brand-default-icon'],
  onDark: ThemeColors2024.dark['brand-default-icon'],
});

export const RcIconApproval = makeThemeIconFromCC(RcIconApprovalCC, {
  onLight: ThemeColors2024.light['brand-default-icon'],
  onDark: ThemeColors2024.dark['brand-default-icon'],
});

export const RcIconBridge = makeThemeIconFromCC(RcIconBridgeCC, {
  onLight: ThemeColors2024.light['brand-default-icon'],
  onDark: ThemeColors2024.dark['brand-default-icon'],
});

export const RcIconQueue = makeThemeIconFromCC(RcIconQueueCC, {
  onLight: ThemeColors2024.light['brand-default-icon'],
  onDark: ThemeColors2024.dark['brand-default-icon'],
});

export const RcIconBuy = makeThemeIconFromCC(RcIconBuyCC, {
  onLight: ThemeColors2024.light['brand-default-icon'],
  onDark: ThemeColors2024.dark['brand-default-icon'],
});

export const RcIconImport = makeThemeIconFromCC(RcIconImportCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});
