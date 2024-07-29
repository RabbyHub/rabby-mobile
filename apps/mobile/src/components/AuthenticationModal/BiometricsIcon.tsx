import { useMemo } from 'react';
import { SvgProps } from 'react-native-svg';

import {
  RcIconKeychainFaceIdCC,
  RcIconKeychainFingerprintCC,
} from '@/assets/icons/lock';
import { ColorOrVariant, pickColorVariants } from '@/core/theme';
import { useBiometricsComputed } from '@/hooks/biometrics';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { IS_IOS } from '@/core/native/utils';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';

type Props = {
  color?: ColorOrVariant;
  faceIdColor?: ColorOrVariant;
  fingerprintColor?: ColorOrVariant;
} & Omit<SvgProps, 'color'>;

const DEFT_COLOR = 'neutral-body';

export const RcIconFaceId = makeThemeIconFromCC(
  RcIconKeychainFaceIdCC,
  'neutral-body',
);

export const RcIconFingerprint = makeThemeIconFromCC(
  RcIconKeychainFingerprintCC,
  'neutral-body',
);

export function getBiometricsIcon(isFaceID: boolean = IS_IOS) {
  return isFaceID ? RcIconFaceId : RcIconFingerprint;
}

export function BiometricsIcon({
  color = DEFT_COLOR,
  faceIdColor = color,
  fingerprintColor = color,
  ...svgProps
}: Props) {
  const { isLight } = useThemeStyles(getStyles);
  const bioComputed = useBiometricsComputed();

  const { IconComp, svgColor } = useMemo(() => {
    return {
      IconComp: bioComputed?.isFaceID
        ? RcIconKeychainFaceIdCC
        : RcIconKeychainFingerprintCC,
      svgColor: pickColorVariants(
        (bioComputed?.isFaceID ? faceIdColor : fingerprintColor) || color,
        isLight,
      ),
    };
  }, [bioComputed, isLight, color, faceIdColor, fingerprintColor]);

  return <IconComp color={svgColor} {...svgProps} />;
}

const getStyles = createGetStyles(() => ({}));
