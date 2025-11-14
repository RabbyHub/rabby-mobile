import React, { useState } from 'react';
import { Animated } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AddressListScreenContainer } from './components/AddressListScreenContainer';
import { MultiAssets } from './components/MultiAssets';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { TopBg } from './components/BgComponents';

export function AddressAssetsOverview(): JSX.Element {
  const { styles } = useTheme2024({ getStyle });
  const { safeTop } = useSafeSizes();
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
      <TopBg fadeAnim={fadeAnim} isDecrease={isDecrease} />
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
