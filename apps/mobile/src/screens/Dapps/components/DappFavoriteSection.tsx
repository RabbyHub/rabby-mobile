import RcIconDisconnect from '@/assets/icons/dapp/icon-disconnect-circle.svg';
import RcIconStarFull from '@/assets/icons/dapp/icon-star-full.svg';
import RcIconStar from '@/assets/icons/dapp/icon-star.svg';
import { TestnetChainLogo } from '@/components/Chain/TestnetChainLogo';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { stringUtils } from '@rabby-wallet/base-utils';
import React from 'react';
import { Image, StyleProp, Text, View, ViewStyle } from 'react-native';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { DappIcon } from './DappIcon';

export const DappFavoriteSection = ({
  isActive,
  data,
  onPress,
  onFavoritePress,
  style,
  isShowDesc = false,
}: {
  data: DappInfo;
  style?: StyleProp<ViewStyle>;
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
  isActive?: boolean;
  isShowDesc?: boolean;
}) => {
  const { styles } = useTheme2024({ getStyle });

  const chain = findChain({ enum: data.chainId });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <RcIconStarFull />
          <Text>Favorites</Text>
        </View>
        <TouchableWithoutFeedback></TouchableWithoutFeedback>
      </View>
      <View style={styles.dappIconWraper}>
        <DappIcon
          source={
            data?.info?.logo_url
              ? {
                  uri: data.info?.logo_url,
                }
              : undefined
          }
          origin={data.origin}
          style={styles.dappIcon}
        />
        {isActive ? <View style={styles.dappIconCircle} /> : null}
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
          {!data?.isConnected ? (
            <RcIconDisconnect style={styles.chainIcon} />
          ) : null}
        </>
      </View>
      <View style={styles.dappContent}>
        <Text style={styles.dappOrigin} numberOfLines={1}>
          {stringUtils.unPrefix(data.origin, 'https://')}
        </Text>
        <View style={styles.dappInfo}>
          {data.info?.name ? (
            <Text style={[styles.dappName]} numberOfLines={1}>
              {data.info?.name}
            </Text>
          ) : null}
          {data.info?.name && data.info?.collected_list?.length ? (
            <View style={styles.divider} />
          ) : null}
        </View>
      </View>
      <TouchableWithoutFeedback
        style={styles.dappAction}
        disallowInterruption={true}
        hitSlop={10}
        onPress={() => {
          onFavoritePress?.(data);
        }}>
        {data.isFavorite ? <RcIconStarFull /> : <RcIconStar />}
      </TouchableWithoutFeedback>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {},
  header: {},
  dappContent: {},
  dappOrigin: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
    color: colors2024['brand-default'],
  },
  dappInfo: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    overflow: 'hidden',
  },

  dappName: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
    flexShrink: 1,
  },

  divider: {
    width: 1,
    height: 12,
    backgroundColor: colors2024['neutral-line'],
  },

  dappAction: {
    padding: 8,
    marginRight: -8,
  },
  dappDesc: {
    position: 'relative',
    backgroundColor: colors2024['neutral-bg-2'],
    padding: 8,
    borderRadius: 12,
  },
  dappDescText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
  dappIconWraper: {
    position: 'relative',
  },
  dappIcon: {
    width: 40,
    height: 40,
    borderRadius: 1000,
  },
  dappIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: colors2024['green-default'],
    position: 'absolute',
    top: -4,
    left: -4,
  },
  chainIcon: {
    width: 16,
    height: 16,
    borderRadius: 16,
    position: 'absolute',
    right: -2,
    bottom: -2,
  },
  listBy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listByIcon: {
    width: 12,
    height: 12,
    borderRadius: 12,
    opacity: 0.7,
  },
}));
