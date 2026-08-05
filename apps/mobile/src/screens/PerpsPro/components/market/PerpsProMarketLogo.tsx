import { DefaultToken } from '@/components/AssetAvatar';
import React, { useCallback, useMemo, useState } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import FastImage from 'react-native-fast-image';

type PerpsProMarketLogoProps = {
  isLight: boolean;
  logoUrl: string;
  marketKey: string;
  size: number;
  style?: StyleProp<ViewStyle>;
};

const PerpsProMarketLogoComponent: React.FC<PerpsProMarketLogoProps> = ({
  isLight,
  logoUrl,
  marketKey,
  size,
  style,
}) => {
  // The native image view follows the request identity so a late error from an
  // old market cannot reach the image now bound to this physical slot.
  const logoIdentity = `${marketKey}\u0000${logoUrl}`;
  const [failedIdentity, setFailedIdentity] = useState<string | null>(null);
  const isRemoteSvg =
    /\.svg(\?|$)/i.test(logoUrl) && /^https?:\/\//i.test(logoUrl);
  const showFallback =
    !logoUrl || isRemoteSvg || failedIdentity === logoIdentity;
  const imageStyle = useMemo(
    () => ({
      borderRadius: size / 2,
      height: size,
      width: size,
    }),
    [size],
  );
  const source = useMemo(() => ({ uri: logoUrl }), [logoUrl]);
  const handleError = useCallback(() => {
    setFailedIdentity(logoIdentity);
  }, [logoIdentity]);

  return (
    <View
      accessible={false}
      style={[{ height: size, width: size }, style]}
      testID="perps-pro-market-logo">
      {showFallback ? (
        <DefaultToken isLight={isLight} size={size} style={imageStyle} />
      ) : (
        <FastImage
          key={logoIdentity}
          onError={handleError}
          source={source}
          style={imageStyle}
          testID="perps-pro-market-logo-image"
        />
      )}
    </View>
  );
};

export const PerpsProMarketLogo = React.memo(PerpsProMarketLogoComponent);

PerpsProMarketLogo.displayName = 'PerpsProMarketLogo';
