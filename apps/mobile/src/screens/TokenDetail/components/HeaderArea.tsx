import React, { useCallback, useMemo } from 'react';
import {
  Dimensions,
  StyleProp,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import { AssetAvatar } from '@/components';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { getTokenSymbol } from '@/utils/token';
import { useAssetsRefreshing } from '@/screens/Search/useAssets';
import LoadingCircle from '@/components2024/RotateLoadingCircle';
import RcIconCopyCC from '@/assets2024/singleHome/copy-cc.svg';
import { trigger } from 'react-native-haptic-feedback';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { findChain } from '@/utils/chain';
import { ITokenItem } from '@/store/tokens';
import { isLpToken } from '@/utils/lpToken';
import LpTokenIcon from '@/screens/Home/components/LpTokenIcon';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { ellipsisAddress } from '@/utils/address';
import Clipboard from '@react-native-clipboard/clipboard';

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
  const { t } = useTranslation();

  const isNativeToken = useMemo(() => {
    const chain = findChain({ serverId: token?.chain });
    return token?.id === chain?.nativeTokenAddress;
  }, [token?.id, token?.chain]);

  const handleCopyAddress = useCallback(
    (evt?: any) => {
      evt?.stopPropagation?.();
      if (!token?.id || isNativeToken) {
        return;
      }
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      Clipboard.setString(token.id);
      toastCopyAddressSuccess({
        title: t('page.tokenDetail.copyCA'),
      });
    },
    [isNativeToken, t, token.id],
  );

  const displayCopy = useMemo(
    () => showCopyIcon && !isNativeToken,
    [isNativeToken, showCopyIcon],
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
          <View style={styles.middleContainer}>
            <View style={styles.titleContainer}>
              <Text
                style={[
                  displayCopy ? styles.showCopySymbol : styles.tokenSymbol,
                  titleStyle,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail">
                {title || getTokenSymbol(token)}
              </Text>
              {isLpToken(token) && (
                <View style={styles.lpTokenIconContainer}>
                  <LpTokenIcon protocolId={token.protocol_id || ''} />
                </View>
              )}
            </View>
            {displayCopy && (
              <CustomTouchableOpacity
                as="RNGHTouchableOpacity"
                style={styles.touchBox}
                onPress={handleCopyAddress}>
                <Text style={styles.contractAddress}>
                  {ellipsisAddress(token.id)}
                </Text>
                <RcIconCopyCC style={styles.copy} />
              </CustomTouchableOpacity>
            )}
          </View>
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
    width: screenWidth - 100,
    marginLeft: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  token: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    gap: 8,
  },
  lpTokenIconContainer: {
    marginLeft: 0,
    flexShrink: 0,
    justifyContent: 'flex-start',
  },
  tokenSymbol: {
    flexShrink: 1,
    minWidth: 0,
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
    alignItems: 'center',
    gap: 2,
  },
  middleContainer: {
    flexShrink: 1,
    flex: 1,
    minWidth: 0,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  copy: {
    width: 12,
    height: 12,
  },
  contractAddress: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  showCopySymbol: {
    flexShrink: 1,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    flexWrap: 'nowrap',
  },
}));
