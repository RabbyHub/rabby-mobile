/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useMemo } from 'react';
import RcIconSwitchArrow from '@/assets2024/icons/history/IconSwitchArrow.svg';
import RcIconSingleArrow from '@/assets2024/icons/history/IconSingleArrow.svg';
import { Text, View, TouchableOpacity } from 'react-native';
import { AssetAvatar } from '@/components';
import {
  NFTItem,
  TokenItem,
  TxDisplayItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { Media } from '@/components/Media';
import { IconDefaultNFT } from '@/assets/icons/nft';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatNumber, numberWithCommasIsLtOne } from '@/utils/number';
import { HistoryItemCateType, HistoryItemIcon } from './HistoryItemIcon';
import { getTokenSymbol } from '@/utils/token';
import { useTranslation } from 'react-i18next';
import { naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { strings } from '@/utils/i18n';
import { HistoryDisplayItem } from '../MultiAddressHistory';
import { fetchHistoryTokenUUId } from './utils';
import { HistoryItemTokenPrice } from './HistoryItemTokenPrice';
import { useCurrentAccount } from '@/hooks/account';

interface ItemProps {
  status: number;
  tokenDict: Record<string, TokenItem | NFTItem>;
  className?: string;
  type?: HistoryItemCateType | undefined;
  token?: TokenItem | TokenItem[];
  chain: TxDisplayItem['chain'];
  data: HistoryDisplayItem;
  approve: TxDisplayItem['token_approve'];
  receives: TxDisplayItem['receives'];
  sends: TxDisplayItem['sends'];
  isForMultipleAdderss?: boolean;
}

const TokenItemInlist = ({
  tokenDict,
  token_id,
  chain,
  amount,
  isNft,
  isSend,
  hanldePress,
}: {
  isSend?: boolean;
  amount: number;
  chain: string;
  isNft: boolean;
  token_id: string;
  hanldePress: (singeToken: TokenItem | NFTItem, tokenIsNft: boolean) => void;
  tokenDict: Record<string, TokenItem | NFTItem>;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const tokenUUID = `${chain}_token:${token_id}`;
  const token = tokenDict[token_id] || tokenDict[tokenUUID];

  return (
    <TouchableOpacity onPress={() => hanldePress(token, isNft)}>
      <View style={styles.listItem}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
          {isNft ? (
            <Media
              failedPlaceholder={<IconDefaultNFT width={33} height={33} />}
              type="image_url"
              src={token?.content?.endsWith('.svg') ? '' : token?.content}
              thumbnail={token?.content?.endsWith('.svg') ? '' : token?.content}
              mediaStyle={styles.media}
              style={styles.media}
              playIconSize={12}
            />
          ) : (
            <AssetAvatar
              logo={(token as TokenItem)?.logo_url || ''}
              size={33}
            />
          )}
          <View style={[styles.colomnBox]}>
            <Text
              style={[
                styles.tokenAmountTextList,
                isSend && styles.isSendTextColor,
              ]}>
              {isSend ? '-' : '+'}{' '}
              {isNft ? amount : numberWithCommasIsLtOne(amount, 2)}{' '}
              {isNft
                ? t('page.singleHome.sectionHeader.Nft')
                : getTokenSymbol(token as TokenItem)}
            </Text>
          </View>
        </View>
        <RcIconSingleArrow
          width={20}
          height={20}
          color={colors2024['neutral-bg-2']}
        />
      </View>
    </TouchableOpacity>
  );
};

export const HistoryTokenList = ({
  tokenDict,
  status,
  type,
  token,
  sends,
  chain,
  data,
  receives,
  approve,
  isForMultipleAdderss,
}: ItemProps) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { currentAccount } = useCurrentAccount();

  const isFail = useMemo(() => status !== 1, [status]);
  const handlePress = useCallback(
    (singeToken: TokenItem | NFTItem, tokenIsNft: boolean) => {
      if (!token) {
        return;
      }

      if (tokenIsNft) {
        naviPush(RootNames.NftDetail, {
          token: { ...token },
          isSingleAddress: !isForMultipleAdderss,
        });
      } else {
        // if (address) {
        //   setTokenDetailAddress(address);
        // }
        // openTokenDetailPopup(token as TokenItem);
        naviPush(RootNames.TokenDetail, {
          token: ensureAbstractPortfolioToken(singeToken as TokenItem),
          // account: address,
          needUseCacheToken: true,
          isSingleAddress: !isForMultipleAdderss,
        });
      }
    },
    [isForMultipleAdderss, token],
  );

  switch (type) {
    case HistoryItemCateType.Send:
    case HistoryItemCateType.Revoke:
    case HistoryItemCateType.Approve:
    case HistoryItemCateType.Recieve:
      const isApprove =
        type === HistoryItemCateType.Approve ||
        type === HistoryItemCateType.Revoke;
      const tokenId = isApprove
        ? approve?.token_id || ''
        : receives?.[0]?.token_id || sends?.[0]?.token_id;
      const tokenUUID = `${chain}_token:${tokenId}`;
      const singleAmount = isApprove
        ? approve?.value
        : receives?.[0]?.amount || sends?.[0]?.amount;
      const appvoveAmmountStr = singleAmount
        ? singleAmount < 1e9
          ? numberWithCommasIsLtOne(singleAmount, 2)
          : strings('page.transactions.detail.Unlimited')
        : '';
      const singeToken = tokenDict[tokenId] || tokenDict[tokenUUID];
      const isSend = type === HistoryItemCateType.Send;
      const tokenIsNft = tokenId?.length === 32;
      return (
        <TouchableOpacity onPress={() => handlePress(singeToken, tokenIsNft)}>
          <View style={[styles.singleBox]}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <HistoryItemIcon
                isInDetail={true}
                type={type}
                token={singeToken as TokenItem}
                isNft={tokenIsNft}
              />
              <View style={[styles.colomnBox, isFail && styles.isFailBox]}>
                <Text
                  style={[
                    styles.tokenAmountText,
                    (isSend || isApprove) && styles.isSendTextColor,
                  ]}>
                  {!isApprove && (isSend ? '-' : '+')}{' '}
                  {tokenIsNft ? singleAmount : appvoveAmmountStr}{' '}
                  {tokenIsNft
                    ? t('page.singleHome.sectionHeader.Nft')
                    : getTokenSymbol(singeToken as TokenItem)}
                </Text>
                {Boolean(!tokenIsNft && singleAmount && singleAmount < 1e9) && (
                  <HistoryItemTokenPrice
                    tokenId={tokenId}
                    chainId={chain}
                    address={currentAccount?.address!}
                    amount={singleAmount!}
                    style={styles.tokenPriceText}
                  />
                )}
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <RcIconSingleArrow
                width={32}
                height={32}
                color={colors2024['neutral-bg-2']}
              />
            </View>
          </View>
        </TouchableOpacity>
      );

    case HistoryItemCateType.Bridge:
    case HistoryItemCateType.Swap:
      const sendAmount = sends?.[0]?.amount;
      const recieveAmount = receives?.[0]?.amount;
      const sendToken = (tokenDict[sends?.[0]?.token_id] ||
        tokenDict[
          fetchHistoryTokenUUId(sends?.[0]?.token_id, chain)
        ]) as TokenItem;
      const recieveToken = (tokenDict[receives?.[0]?.token_id] ||
        tokenDict[
          fetchHistoryTokenUUId(receives?.[0]?.token_id, chain)
        ]) as TokenItem;
      return (
        <View style={[styles.doubleBox]}>
          <TouchableOpacity
            style={[styles.fromTokenBox]}
            onPress={() => handlePress(sendToken, false)}>
            <AssetAvatar
              logo={sendToken?.logo_url}
              size={42}
              chain={sendToken?.chain}
              chainSize={16}
            />
            <View style={[styles.colomnBox, isFail && styles.isFailBox]}>
              <Text
                style={[styles.tokenAmountTextList, styles.isSendTextColor]}>
                {'-'} {numberWithCommasIsLtOne(sendAmount, 2)}{' '}
                {getTokenSymbol(sendToken as TokenItem)}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toTokenBox]}
            onPress={() => handlePress(recieveToken, false)}>
            <AssetAvatar
              logo={recieveToken?.logo_url}
              size={42}
              chain={recieveToken?.chain}
              chainSize={16}
            />
            <View style={[styles.colomnBox, isFail && styles.isFailBox]}>
              <Text style={[styles.tokenAmountTextList]}>
                {'+'} {numberWithCommasIsLtOne(recieveAmount, 2)}{' '}
                {getTokenSymbol(recieveToken as TokenItem)}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.iconSwitchArrow}>
            <RcIconSwitchArrow />
          </View>
        </View>
      );
    case HistoryItemCateType.Contract:
    case HistoryItemCateType.Cancel:
    case HistoryItemCateType.UnKnown:
    default: {
      const hasList = Boolean(receives?.length || sends?.length);

      return (
        hasList && (
          <View style={[styles.mutliBox]}>
            {sends?.map(({ token_id, amount }) => (
              <TokenItemInlist
                key={token_id}
                isSend={true}
                chain={chain}
                token_id={token_id}
                amount={amount}
                isNft={token_id.length === 32}
                tokenDict={tokenDict}
                hanldePress={handlePress}
              />
            ))}
            {receives?.map(({ token_id, amount }) => (
              <TokenItemInlist
                key={token_id}
                token_id={token_id}
                chain={chain}
                amount={amount}
                isNft={token_id.length === 32}
                tokenDict={tokenDict}
                hanldePress={handlePress}
              />
            ))}
          </View>
        )
      );
    }
  }
  // return <RcIconDefault style={[styles.image, style]} />;
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tokenAmountText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
  },
  tokenAmountTextList: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  tokenPriceText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  colomnBox: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  isSendTextColor: {
    color: colors2024['neutral-title-1'],
  },
  isFailBox: {
    opacity: 0.3,
  },
  image: {
    width: 46,
    height: 46,
  },
  media: {
    width: 33,
    height: 33,
    borderRadius: 4,
  },
  doubleBox: {
    justifyContent: 'center',
    alignContent: 'center',
    flexDirection: 'row',
    height: 110,
    gap: 10,
    position: 'relative',
  },
  iconSwitchArrow: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 200,
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -22,
    marginTop: -22,
  },
  fromTokenBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    flex: 1,
    height: 110,
    gap: 10,
  },
  toTokenBox: {
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    flex: 1,
    height: 110,
  },
  singleBox: {
    width: '100%',
    height: 92,
    backgroundColor: colors2024['neutral-bg-1'],
    justifyContent: 'space-between',
    alignContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexDirection: 'row',
  },
  mutliBox: {
    width: '100%',
    backgroundColor: colors2024['neutral-bg-1'],
    justifyContent: 'center',
    alignContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 16,
    // flexDirection: 'row',
    gap: 12,
  },
  iconTR: {
    position: 'absolute',
    right: 2,
    top: 2,
  },
  iconBR: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
  },
  listItem: {
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
}));
