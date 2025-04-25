import RcIconDisconnect from '@/assets/icons/dapp/icon-disconnect-circle.svg';
import { TestnetChainLogo } from '@/components/Chain/TestnetChainLogo';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo } from 'react';
import {
  Image,
  StyleProp,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

export const BrowserBookmarkItem = ({
  data,
  onPress,
  style,
}: {
  data: DappInfo;
  style?: StyleProp<ViewStyle>;
  onPress?: (dapp: DappInfo) => void;
}) => {
  const { styles } = useTheme2024({ getStyle });

  const chain = findChain({ enum: data.chainId });
  const { width } = useWindowDimensions();
  const maxWidth = useMemo(() => {
    return Math.round((width - 48) / 4) - 2;
  }, [width]);

  return (
    <TouchableOpacity
      style={[styles.dappCard, style]}
      onPress={() => {
        onPress?.(data);
      }}>
      <View style={styles.container}>
        <View style={styles.dappIconWarper}>
          <DappIcon
            source={
              data?.icon
                ? {
                    uri: data.icon,
                  }
                : undefined
            }
            origin={data.origin}
            style={styles.dappIcon}
          />
          <>
            {data?.isConnected && chain ? (
              chain.isTestnet ? (
                <TestnetChainLogo
                  name={chain.name}
                  style={styles.chainIcon}
                  size={styles.chainIcon.width}
                />
              ) : (
                <Image
                  source={{
                    uri: chain?.logo,
                  }}
                  style={styles.chainIcon}
                />
              )
            ) : null}
            {/* {!data?.isConnected ? (
              <RcIconDisconnect
                width={styles.chainIcon.width}
                height={styles.chainIcon.height}
                style={styles.chainIcon}
              />
            ) : null} */}
          </>
        </View>
        <Text style={[styles.dappName, { maxWidth }]} numberOfLines={1}>
          {data?.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  dappCard: {},
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },

  dappName: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'center',
    width: '100%',
    // width: 80,
  },
  dappIconWarper: {
    position: 'relative',
  },
  dappIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  chainIcon: {
    width: 20,
    height: 20,
    borderRadius: 100,
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderWidth: 1.5,
    borderColor: colors2024['neutral-bg-1'],
  },
}));
