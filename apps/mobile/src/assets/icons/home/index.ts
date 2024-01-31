import { default as RcIconHeaderSettingsCC } from './header-settings-cc.svg';
import { default as RcIconHistoryCC } from './header-history-cc.svg';
import { default as RcIconHeaderAddAccountCC } from './header-add-account-cc.svg';
import { default as RcIconHeaderRightArrowCC } from './header-right-cc.svg';
import { default as RcIconSendCC } from './send-cc.svg';
import { default as RcIconSwapCC } from './swap-cc.svg';
import { default as RcIconReceiveCC } from './receive-cc.svg';
import { default as RcIconMoreCC } from './more-cc.svg';
import { default as RcIconApprovalCC } from './approvals-cc.svg';
import { default as RcIconGasTopUpCC } from './gas-top-up-cc.svg';
import { default as RcIconHeaderEyeCC } from './header-eye-cc.svg';
import { default as RcIconHeaderEyeCloseCC } from './header-eye-close-cc.svg';

import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { ThemeColors } from '@/constant/theme';

export const RcIconHeaderSettings = makeThemeIconFromCC(
  RcIconHeaderSettingsCC,
  {
    onLight: ThemeColors.light['neutral-foot'],
    onDark: ThemeColors.dark['neutral-foot'],
  },
);

export const RcIconHistory = makeThemeIconFromCC(RcIconHistoryCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});

export const RcIconHeaderAddAccount = makeThemeIconFromCC(
  RcIconHeaderAddAccountCC,
  {
    onLight: ThemeColors.light['neutral-title-1'],
    onDark: ThemeColors.dark['neutral-title-1'],
  },
);

export const RcIconButtonAddAccount = makeThemeIconFromCC(
  RcIconHeaderAddAccountCC,
  {
    onLight: ThemeColors.light['blue-default'],
    onDark: ThemeColors.dark['blue-default'],
  },
);

export const RcIconHeaderRightArrow = makeThemeIconFromCC(
  RcIconHeaderRightArrowCC,
  {
    onLight: ThemeColors.light['neutral-foot'],
    onDark: ThemeColors.dark['neutral-foot'],
  },
);

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

export const RcIconGasTopUp = makeThemeIconFromCC(RcIconGasTopUpCC, {
  onLight: ThemeColors.light['neutral-body'],
  onDark: ThemeColors.dark['neutral-body'],
});

export const RcIconHeaderEye = makeThemeIconFromCC(RcIconHeaderEyeCC, {
  onLight: ThemeColors.light['neutral-title-2'],
  onDark: ThemeColors.dark['neutral-title-2'],
});
export const RcIconHeaderEyeClose = makeThemeIconFromCC(
  RcIconHeaderEyeCloseCC,
  {
    onLight: ThemeColors.light['neutral-title-2'],
    onDark: ThemeColors.dark['neutral-title-2'],
  },
);
