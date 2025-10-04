import RcPinCC from './pin-cc.svg';
import RcIconWarningCC from './warning-cc.svg';
export { default as RcIconWarningCircleCC } from './warning-circle-cc.svg';
import RcCheckboxEmptyCC from './checkbox-empty-cc.svg';
import RcCheckboxFilledBrand from './checkbox-filled-brand.svg';

import { makeThemeIcon2024FromCC } from '@/hooks/makeThemeIcon';

const RcCheckboxEmpty = makeThemeIcon2024FromCC(RcCheckboxEmptyCC, ctx => ({
  onLight: ctx.colors2024['neutral-info'],
  onDark: ctx.colors2024['neutral-info'],
}));

export const ICONS_COMMON_2024 = {
  RcPinCC,

  RcCheckboxEmpty,
  RcCheckboxFilledBrand,
};

export { RcIconWarningCC };
