import React from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';

import { useLastScreenshot, useResize } from '@/hooks/native/security';
import { makeDebugBorder } from '@/utils/styles';

const IMAGE_CONTAIN_STYLE = { height: 200, width: '100%' } as const;
const IMAGE_RESIZE_MODE = 'contain' as const;

export function SampleImage() {
  const { lastScreenshot } = useLastScreenshot();

  const maxWidth = Dimensions.get('window').width - 20;

  const { scaledSize } = useResize(lastScreenshot, { maxWidth });

  if (!lastScreenshot?.uri) {
    return null;
  }

  return (
    <View style={{ maxWidth, flex: 1, ...makeDebugBorder() }}>
      <Image
        style={[IMAGE_CONTAIN_STYLE]}
        source={{ uri: lastScreenshot.uri }}
        height={lastScreenshot.height || scaledSize.height}
        width={lastScreenshot.width || scaledSize.width}
        resizeMode={IMAGE_RESIZE_MODE}
      />
    </View>
  );
}
