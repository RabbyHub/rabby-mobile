import React, { useCallback, useEffect, useMemo } from 'react';
import { Dimensions, TouchableOpacity, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import { AssetAvatar, Text } from '@/components';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { ellipsisOverflowedText } from '@/utils/text';
import { getTokenSymbol } from '@/utils/token';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { useUserTokenSettings } from '@/hooks/useTokenSettings';
import { useAssets } from '@/screens/Search/useAssets';
import LoadingCircle from '@/components2024/RotateLoadingCircle';

const screenWidth = Dimensions.get('window').width;
interface Props {
  token: AbstractPortfolioToken;
  refreshTags: () => void;
}
export const TokenDetailHeaderArea: React.FC<Props> = ({
  token,
  refreshTags,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const {
    removePinedToken,
    pinToken,
    userTokenSettings,
    fetchUserTokenSettings,
  } = useUserTokenSettings();

  useEffect(() => {
    fetchUserTokenSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { refreshing } = useAssets();

  const isPined = useMemo(
    () =>
      userTokenSettings?.pinedQueue?.some(
        pinned =>
          pinned.chainId === token.chain && pinned.tokenId === token._tokenId,
      ),
    [token._tokenId, token.chain, userTokenSettings?.pinedQueue],
  );
  const handlePress = useCallback(() => {
    if (isPined) {
      removePinedToken({
        id: token._tokenId,
        chain: token.chain,
      });
    } else {
      pinToken({
        id: token._tokenId,
        chain: token.chain,
      });
    }
    setTimeout(() => {
      refreshTags();
    }, 0);
  }, [
    isPined,
    pinToken,
    refreshTags,
    removePinedToken,
    token._tokenId,
    token.chain,
  ]);

  return (
    <View style={styles.root}>
      <View style={styles.container}>
        <View style={styles.token}>
          <AssetAvatar
            logo={token?.logo_url}
            // style={mediaStyle}
            size={35}
            chain={token?.chain}
            chainSize={16}
          />
          <Text
            style={styles.tokenSymbol}
            numberOfLines={1}
            ellipsizeMode="tail">
            {ellipsisOverflowedText(getTokenSymbol(token), 15)}
          </Text>
          <TouchableOpacity onPress={handlePress}>
            <RcIconFavorite
              width={22}
              height={21}
              color={
                isPined
                  ? colors2024['orange-default']
                  : colors2024['neutral-info']
              }
            />
          </TouchableOpacity>
          {refreshing && <LoadingCircle />}
        </View>
      </View>
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  root: {
    width: '100%',
  },
  container: {
    width: screenWidth - 130,
    marginLeft: 0,
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
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
}));
