import { IS_IOS } from '@/core/native/utils';
import {
  RABBY_MOBILE_KR_PWD as RABBY_MOBILE_KR_PWD2,
  RABBY_MOBILE_KR_PWD_0617 as RABBY_MOBILE_KR_PWD2_0617,
} from '@env';

export const RABBY_MOBILE_KR_PWD = RABBY_MOBILE_KR_PWD2;

// 只有 iOS 在 0.6.17 引入了错误的默认密码，Android 用户不受影响
export const RABBY_MOBILE_KR_PWD_0617 = IS_IOS
  ? RABBY_MOBILE_KR_PWD2_0617
  : RABBY_MOBILE_KR_PWD2;
