import React, { useCallback, useMemo } from 'react';
import {
  Dimensions,
  StyleProp,
  TextStyle,
  View,
  ViewStyle,
  Text,
  TouchableOpacity,
  Clipboard,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import { AssetAvatar } from '@/components';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { ellipsisOverflowedText } from '@/utils/text';
import { getTokenSymbol } from '@/utils/token';
import { useAssetsRefreshing } from '@/screens/Search/useAssets';
import LoadingCircle from '@/components2024/RotateLoadingCircle';
import RcIconCopy from '@/assets2024/singleHome/copy.svg';
import { trigger } from 'react-native-haptic-feedback';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { findChain } from '@/utils/chain';
import { ITokenItem } from '@/store/tokens';
import { isLpToken } from '@/utils/lpToken';
import LpTokenIcon from '@/screens/Home/components/LpTokenIcon';

const screenWidth = Dimensions.get('window').width;
interface Props {
  token: ITokenItem;
  style?: StyleProp<ViewStyle>;
  tokenSize?: number;
  chainSize?: number;
  borderChain?: boolean;
  title?: string;
  titleStyle?: StyleProp<TextStyle>;
  rootStyle?: StyleProp<ViewStyle>;
  disableRefresh?: boolean;
  showCopyIcon?: boolean;
}
export const TokenDetailHeaderArea: React.FC<Props> = ({
  token,
  style,
  tokenSize = 35,
  chainSize = 16,
  borderChain = false,
  title,
  titleStyle,
  rootStyle,
  disableRefresh = false,
  showCopyIcon = false,
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { refreshing } = useAssetsRefreshing();

  const isNativeToken = useMemo(() => {
    const chain = findChain({ serverId: token?.chain });
    return token?.id === chain?.nativeTokenAddress;
  }, [token?.id, token?.chain]);

  const handleCopyAddress = useCallback<
    React.ComponentProps<typeof TouchableOpacity>['onPress'] & object
  >(
    evt => {
      evt.stopPropagation();
      if (!token?.id || isNativeToken) {
        return;
      }
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      Clipboard.setString(token.id);
      toastCopyAddressSuccess(token.id);
    },
    [isNativeToken, token.id],
  );

  return (
    <View style={[styles.root, rootStyle]}>
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
            {title || ellipsisOverflowedText(getTokenSymbol(token), 15)}
          </Text>
          {isLpToken(token) && (
            <View style={styles.lpTokenIconContainer}>
              <LpTokenIcon protocolId={token.protocol_id || ''} />
            </View>
          )}
          {showCopyIcon && !isNativeToken && (
            <TouchableOpacity
              style={styles.touchBox}
              onPress={handleCopyAddress}>
              <RcIconCopy style={styles.copy} />
            </TouchableOpacity>
          )}
          {!disableRefresh && refreshing && <LoadingCircle />}
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
  lpTokenIconContainer: {
    marginLeft: 0,
    flexShrink: 0,
    justifyContent: 'flex-start',
  },
  tokenSymbol: {
    flexShrink: 1,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '900',
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
  touchBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  copy: {
    width: 18,
    height: 18,
  },
}));
