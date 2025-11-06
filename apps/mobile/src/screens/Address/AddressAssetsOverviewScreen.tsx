import React, { useState } from 'react';
import { ImageBackground, Animated } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AddressListScreenContainer } from './components/AddressListScreenContainer';
import { MultiAssets } from './components/MultiAssets';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useHeaderHeight } from '@react-navigation/elements';

export function AddressAssetsOverview(): JSX.Element {
  const { styles } = useTheme2024({ getStyle });
  const { safeTop, safeOffHeader } = useSafeSizes();
  const headerHeight = useHeaderHeight();
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const [isDecrease, setIsDecrease] = useState(false);

  const handleReachTopStatusChange = React.useCallback(
    (status: boolean) => {
      Animated.timing(fadeAnim, {
        toValue: status ? 1 : 0,
        duration: 100,
        useNativeDriver: true,
      }).start();
    },
    [fadeAnim],
  );
  return (
    <AddressListScreenContainer
      style={[
        styles.screen,
        {
          paddingTop: Math.max(safeTop, 80),
        },
      ]}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '100%',
          height: Math.max(headerHeight, 80),
          opacity: fadeAnim,
        }}>
        <ImageBackground
          source={
            !isDecrease
              ? require('@/assets2024/singleHome/up.png')
              : require('@/assets2024/singleHome/loss.png')
          }
          resizeMode="cover"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: safeOffHeader + 150,
          }}
        />
      </Animated.View>
      <MultiAssets
        onUpdateIsDecrease={setIsDecrease}
        onReachTopStatusChange={handleReachTopStatusChange}
      />
    </AddressListScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    backgroundColor: colors2024['neutral-bg-0'],
  },
}));
