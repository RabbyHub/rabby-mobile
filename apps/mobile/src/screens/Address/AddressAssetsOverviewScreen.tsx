import React, { useState } from 'react';
import { ImageBackground, Animated } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AddressListScreenContainer } from './components/AddressListScreenContainer';
import { MultiAssets } from './components/MultiAssets';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useHeaderHeight } from '@react-navigation/elements';

export function AddressAssetsOverview(): JSX.Element {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { safeTop } = useSafeSizes();
  const headerHeight = useHeaderHeight();
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const [isDecrease, setIsDecrease] = useState(false);
  const topBg = React.useMemo(() => {
    if (isDecrease) {
      if (isLight) {
        return require('@/assets2024/singleHome/home-loss-bg-1.png');
      } else {
        return require('@/assets2024/singleHome/home-loss-dark-bg-1.png');
      }
    } else {
      if (isLight) {
        return require('@/assets2024/singleHome/home-profit-bg-1.png');
      } else {
        return require('@/assets2024/singleHome/home-profit-dark-bg-1.png');
      }
    }
  }, [isDecrease, isLight]);

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
          height: Math.max(headerHeight, 180),
          opacity: fadeAnim,
        }}>
        <ImageBackground
          source={topBg}
          resizeMode="cover"
          style={{
            width: '100%',
            height: Math.max(headerHeight, 180),
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
  chart: {
    // paddingVertical: 20,
    paddingHorizontal: 20,
  },
  headline: {
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  headlineText: {
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  itemGap: {
    marginBottom: 12,
  },
  footer: {
    marginTop: 12,
  },
  footerCard: {
    backgroundColor: colors2024['neutral-bg-2'],
    marginBottom: 22,
    padding: 16,
    borderRadius: 20,
  },
  footerMain: {
    height: 46,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerCardText: {
    color: colors2024['neutral-secondary'],
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
  sectionFooter: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    marginTop: 2,
  },
  footerGap: {
    height: 70,
  },
}));
