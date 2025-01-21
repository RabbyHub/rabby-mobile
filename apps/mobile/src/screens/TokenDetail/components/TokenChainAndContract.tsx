import React from 'react';
import { TouchableOpacity, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

import {
  RcIconCopyRegularCC,
  RcIconExternalLinkCC,
} from '@/assets/icons/common';
import { Text } from '@/components';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { ellipsisAddress } from '@/utils/address';
import { findChain } from '@/utils/chain';
import { openTxExternalUrl } from '@/utils/transaction';
import Clipboard from '@react-native-clipboard/clipboard';
import { useMemoizedFn } from 'ahooks';
import { useTranslation } from 'react-i18next';

interface Props {
  token: AbstractPortfolioToken;
}
export const TokenChainAndContract: React.FC<Props> = ({ token }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

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

  return (
    <View style={styles.container}>
      <View style={styles.itemContainer}>
        <Text style={styles.titleTexet}>{t('page.sendToken.Chain')}</Text>
        <View style={styles.token}>
          <ChainIconImage
            size={14}
            chainServerId={token.chain}
            isShowRPCStatus={true}
          />
          <Text
            style={[styles.contentText]}
            numberOfLines={1}
            ellipsizeMode="tail">
            {chainItem?.name}
          </Text>
        </View>
      </View>
      {isContractToken && (
        <View style={styles.itemContainer}>
          <Text style={styles.titleTexet}>
            {t('page.sendToken.ContractAddress')}
          </Text>
          <View style={styles.token}>
            <Text
              style={styles.contentText}
              numberOfLines={1}
              ellipsizeMode="tail">
              {ellipsisAddress(tokenAddress)}
            </Text>
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
            <TouchableOpacity onPress={handleCopyAddress}>
              <RcIconCopyRegularCC
                style={styles.icon}
                color={colors2024['neutral-foot']}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    // marginLeft: 0,
    marginHorizontal: 16,
    gap: 12,
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    // width: '100%',
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  token: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  titleTexet: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  contentText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  icon: {
    width: 14,
    height: 14,
  },
  iconJump: {
    // marginLeft: 6,
  },
}));
