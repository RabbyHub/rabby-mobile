import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native';

import { IconDefaultNFT } from '@/assets/icons/nft';
import { MEDIA_TYPE, Media } from '@/components/Media';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';

export default function NFTAvatar<T extends React.ComponentType<any>>({
  style,
  size = 28,
  ViewComponent = View,
  nftImageUrl,
  ...props
}: RNViewProps & {
  size?: number;
  nftImageUrl?: string;
  ViewComponent?: T;
} & React.ComponentProps<T>) {
  const { styles } = useThemeStyles(getStyle);

  const isSvgURL = nftImageUrl?.endsWith('.svg');

  nftImageUrl = nftImageUrl || '';

  return (
    <ViewComponent
      {...props}
      style={StyleSheet.flatten([
        styles.imagesView,
        { width: size, height: size },
        style,
      ])}>
      <Media
        failedPlaceholder={<IconDefaultNFT width="100%" height="100%" />}
        type={MEDIA_TYPE.IMAGE_URL}
        src={isSvgURL ? '' : nftImageUrl}
        thumbnail={isSvgURL ? '' : nftImageUrl}
        mediaStyle={styles.images}
        style={styles.images}
      />
    </ViewComponent>
  );
}

const getStyle = createGetStyles(colors => {
  return {
    imagesView: {
      borderRadius: 4,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      margin: 5,
      // ...makeDebugBorder('blue'),
    },
    images: {
      width: '100%',
      height: '100%',
      borderRadius: 4,
    },
  };
});
