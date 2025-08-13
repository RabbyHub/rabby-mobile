import React from 'react';
import {
  Dimensions,
  StyleProp,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import { AssetAvatar, Text } from '@/components';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { ellipsisOverflowedText } from '@/utils/text';
import { getTokenSymbol } from '@/utils/token';
import { useAssetsRefreshing } from '@/screens/Search/useAssets';
import LoadingCircle from '@/components2024/RotateLoadingCircle';

const screenWidth = Dimensions.get('window').width;
interface Props {
  token: AbstractPortfolioToken;
  style?: StyleProp<ViewStyle>;
  tokenSize?: number;
  chainSize?: number;
  borderChain?: boolean;
  titleStyle?: StyleProp<TextStyle>;
}
export const TokenDetailHeaderArea: React.FC<Props> = ({
  token,
  style,
  tokenSize = 35,
  chainSize = 16,
  borderChain = false,
  titleStyle,
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { refreshing } = useAssetsRefreshing();

  return (
    <View style={styles.root}>
      <View style={[styles.container, style]}>
        <View style={styles.token}>
          <AssetAvatar
            logo={token?.logo_url}
            // style={mediaStyle}
            size={tokenSize}
            chain={token?.chain}
            chainSize={chainSize}
            innerChainStyle={borderChain ? styles.chainLogo : undefined}
          />
          <Text
            style={[styles.tokenSymbol, titleStyle]}
            numberOfLines={1}
            ellipsizeMode="tail">
            {ellipsisOverflowedText(getTokenSymbol(token), 15)}
          </Text>
          {refreshing && <LoadingCircle />}
        </View>
      </View>
    </View>
  );
};

const getStyles = createGetStyles2024(({ isLight, colors2024 }) => ({
  root: {
    width: screenWidth - 140,
  },
  container: {
    width: screenWidth - 140,
    marginLeft: 0,
    display: 'flex',
    flexDirection: 'row',
  },
  token: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tokenSymbol: {
    flexShrink: 1,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    flexWrap: 'nowrap',
  },
  contract: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,

    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  address: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  icon: {
    width: 14,
    height: 14,
  },
  iconJump: {
    marginLeft: 8,
  },
  chainLogo: {
    borderWidth: 1.5,
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
}));
