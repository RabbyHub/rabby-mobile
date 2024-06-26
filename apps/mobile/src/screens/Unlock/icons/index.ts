import { RcIconKeychainFingerprintCC } from '@/assets/icons/lock';
import RcIconKeychainFaceIdCC from './keychain-faceid-light-cc.svg';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';

export const RcIconFaceId = makeThemeIconFromCC(
  RcIconKeychainFaceIdCC,
  'neutral-body',
);

export const RcIconFingerprint = makeThemeIconFromCC(
  RcIconKeychainFingerprintCC,
  '#FF2D55',
);
