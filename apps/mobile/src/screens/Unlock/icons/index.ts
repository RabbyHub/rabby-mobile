import { RcIconKeychainFingerprintCC } from '@/assets/icons/lock';
import RcIconKeychainFaceIdCC from './keychain-faceid-light-cc.svg';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { RcIconInfoCC } from '@/assets/icons/common';

export const RcIconFaceId = makeThemeIconFromCC(
  RcIconKeychainFaceIdCC,
  'neutral-body',
);

export const RcIconFingerprint = makeThemeIconFromCC(
  RcIconKeychainFingerprintCC,
  'neutral-body',
);

export const RcIconInfoForToast = makeThemeIconFromCC(
  RcIconInfoCC,
  'neutral-title2',
);
