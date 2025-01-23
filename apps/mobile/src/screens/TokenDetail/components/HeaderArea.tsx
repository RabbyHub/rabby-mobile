import React from 'react';
import { Dimensions, TouchableOpacity, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import {
  RcIconCopyRegularCC,
  RcIconExternalLinkCC,
} from '@/assets/icons/common';
import { AssetAvatar, Text } from '@/components';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { ellipsisAddress } from '@/utils/address';
import { findChain } from '@/utils/chain';
import { ellipsisOverflowedText } from '@/utils/text';
import { getTokenSymbol } from '@/utils/token';
import { openTxExternalUrl } from '@/utils/transaction';
import Clipboard from '@react-native-clipboard/clipboard';
import { useMemoizedFn } from 'ahooks';

const screenWidth = Dimensions.get('window').width;
interface Props {
  token: AbstractPortfolioToken;
}
export const TokenDetailHeaderArea: React.FC<Props> = ({ token }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const handleCopyAddress = useMemoizedFn<
    React.ComponentProps<typeof TouchableOpacity>['onPress'] & object
  >(evt => {
    evt.stopPropagation();
    if (!token?._tokenId) {
      return;
    }
    Clipboard.setString(token._tokenId);
    toastCopyAddressSuccess(token._tokenId);
  });

  const { isContractToken, nativeTokenChainName, tokenAddress, chainItem } =
    React.useMemo(() => {
      const item = findChain({ serverId: token.chain });
      /* for AbstractPortfolioToken,
          id of native token is `{chain.symbol}{chain.symbol}`,
          id of non-native token is `{token_address}{chain.symbol}  */
      // const isContractToken = /^0x.{40}/.test(token.id) && token.id.endsWith(token.chain);
      const isContractToken =
        /^0x.{40}/.test(token._tokenId) &&
        token.id === `${token._tokenId}${token.chain}`;

      return {
        chainItem: item,
        isContractToken,
        nativeTokenChainName: !isContractToken && item ? item.name : '',
        tokenAddress: !isContractToken
          ? item?.nativeTokenAddress || ''
          : token._tokenId,
      };
    }, [token]);

  const needHideAddress = React.useMemo(
    () => getTokenSymbol(token).length >= 5,
    [token],
  );

  return (
    <View style={styles.root}>
      <View style={styles.container}>
        <View style={styles.token}>
          <AssetAvatar
            logo={token?.logo_url}
            // style={mediaStyle}
            size={35}
            chainSize={16}
          />
          <Text
            style={styles.tokenSymbol}
            numberOfLines={1}
            ellipsizeMode="tail">
            {ellipsisOverflowedText(getTokenSymbol(token), 15)}
          </Text>
        </View>
        {/* <View style={styles.contract}>
          <ChainIconImage
            size={12}
            chainServerId={token.chain}
            isShowRPCStatus={true}
          />
          {!isContractToken && nativeTokenChainName ? (
            <>
              <Text
                style={[styles.address]}
                numberOfLines={1}
                ellipsizeMode="tail">
                {nativeTokenChainName}
              </Text>
            </>
          ) : (
            <>
              <Text
                style={styles.address}
                numberOfLines={1}
                ellipsizeMode="tail">
                {needHideAddress
                  ? ellipsisOverflowedText(tokenAddress, 6)
                  : ellipsisAddress(tokenAddress)}
              </Text>
              <TouchableOpacity onPress={handleCopyAddress}>
                <RcIconCopyRegularCC
                  style={styles.icon}
                  color={colors2024['neutral-foot']}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconJump}
                onPress={() => {
                  openTxExternalUrl({
                    chain: chainItem,
                    address: tokenAddress,
                  });
                }}>
                <RcIconExternalLinkCC
                  style={styles.icon}
                  color={colors2024['neutral-foot']}
                />
              </TouchableOpacity>
            </>
          )}
        </View> */}
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
