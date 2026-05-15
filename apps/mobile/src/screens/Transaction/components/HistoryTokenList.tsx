/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import RcIconSwitchArrow from '@/assets2024/icons/history/IconSwitchArrow.svg';
import RcIconSingleArrow from '@/assets2024/icons/history/IconSingleArrow.svg';
import { View, TouchableOpacity } from 'react-native';
import { AssetAvatar } from '@/components';
import {
  NFTItem,
  TokenItem,
  TxDisplayItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { Media } from '@/components/Media';
import { IconDefaultNFT } from '@/assets/icons/nft';
import { useTheme2024 } from '@/hooks/theme';
import { RcIconRightCC } from '@/assets/icons/common';
import { createGetStyles2024 } from '@/utils/styles';
import { formatTokenAmount } from '@/utils/number';
import { HistoryItemIcon } from './HistoryItemIcon';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
import { useTranslation } from 'react-i18next';
import { navigateDeprecated, naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { HistoryDisplayItem } from '../MultiAddressHistory';
import { HistoryItemTokenPrice } from './HistoryItemTokenPrice';
import { ellipsisOverflowedText } from '@/utils/text';
import { HistoryItemCateType } from './type';
import { Account } from '@/core/services/preference';
import { isArray } from 'lodash';
import { Dimensions } from 'react-native';
import { Text } from '@/components/Typography';

interface ItemProps {
  status: number;
  className?: string;
  type?: HistoryItemCateType | undefined;
  token?: TokenItem | TokenItem[];
  chain: TxDisplayItem['chain'];
  data: HistoryDisplayItem;
  approve: HistoryDisplayItem['token_approve'];
  receives: HistoryDisplayItem['receives'];
  sends: HistoryDisplayItem['sends'];
  isForMultipleAddress?: boolean;
  account: Account;
}

const TokenItemInlist = ({
  token,
  token_id,
  chain,
  amount,
  isNft,
  isSend,
  hanldePress,
  tokenPrice,
}: {
  isSend?: boolean;
  amount: number;
  chain: string;
  isNft: boolean;
  token_id: string;
  tokenPrice?: number;
  hanldePress: (singeToken: TokenItem | NFTItem, tokenIsNft: boolean) => void;
  token: TokenItem | NFTItem;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

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
              {isSend ? '-' : '+'} {isNft ? amount : formatTokenAmount(amount)}{' '}
              {isNft
                ? t('page.singleHome.sectionHeader.Nft')
                : ellipsisOverflowedText(
                    getTokenSymbol(token as TokenItem),
                    16,
                  )}
            </Text>
          </View>
        </View>

        <View style={styles.listItemExtra}>
          <HistoryItemTokenPrice
            singlePrice={tokenPrice ?? (token as TokenItem)?.price}
            amount={amount}
            style={styles.tokenPriceText}
          />
          <RcIconSingleArrow
            width={20}
            height={20}
            color={colors2024['neutral-bg-2']}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const HistoryTokenList = ({
  status,
  type,
  token,
  sends,
  chain,
  data,
  receives,
  approve,
  isForMultipleAddress,
  account: currentAccount,
}: ItemProps) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const isFail = useMemo(() => status !== 1, [status]);
  const handlePress = useCallback(
    (singeToken: TokenItem | NFTItem, tokenIsNft: boolean) => {
      if (!token) {
        return;
      }

      if (tokenIsNft) {
        naviPush(RootNames.NftDetail, {
          token: { ...token },
          isSingleAddress: !isForMultipleAddress,
          account: currentAccount,
        });
      } else {
        navigateDeprecated(RootNames.TokenDetail, {
          token: {
            ...tokenItemToITokenItem(singeToken as TokenItem, ''),
            amount: 0,
          },
          needUseCacheToken: true,
          isSingleAddress: !isForMultipleAddress,
          account: currentAccount,
        });
      }
    },
    [currentAccount, isForMultipleAddress, token],
  );

  switch (type) {
    case HistoryItemCateType.GAS_WITHDRAW:
    case HistoryItemCateType.GAS_DEPOSIT:
    case HistoryItemCateType.GAS_RECEIVED:
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
      const singleAmount = isApprove
        ? approve?.value
        : receives?.[0]?.amount || sends?.[0]?.amount;
      const singlePrice = (
        isApprove
          ? approve?.price ?? approve?.token?.price
          : receives?.[0]?.price || sends?.[0]?.price
      ) as number;
      const isUnlimited =
        isApprove && singleAmount && new BigNumber(singleAmount).gte(10 ** 9);
      const appvoveAmmountStr = singleAmount
        ? isUnlimited
          ? t('page.transactions.detail.Unlimited')
          : formatTokenAmount(singleAmount || 0)
        : '0';
      const singeToken = isArray(token) ? token[0] : token;
      const isSend = type === HistoryItemCateType.Send;
      const isGasDeposit = type === HistoryItemCateType.GAS_DEPOSIT;
      const tokenIsNft = tokenId?.length === 32;

      return (
        <TouchableOpacity onPress={() => handlePress(singeToken!, tokenIsNft)}>
          <View style={[styles.singleBox]}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <HistoryItemIcon
                isInDetail={true}
                type={type}
                token={singeToken as TokenItem}
                isNft={tokenIsNft}
              />
              <View
                style={[styles.singleColomnBox, isFail && styles.isFailBox]}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tokenAmountText,
                    (isSend || isGasDeposit) && styles.isSendTextColor,
                    isApprove && styles.tokenApproveAmountText,
                  ]}>
                  {!isApprove && (isSend || isGasDeposit ? '- ' : '+ ')}
                  {tokenIsNft ? singleAmount : appvoveAmmountStr}{' '}
                  {tokenIsNft
                    ? t('page.singleHome.sectionHeader.Nft')
                    : ellipsisOverflowedText(
                        getTokenSymbol(singeToken as TokenItem),
                        16,
                      )}
                </Text>
                {Boolean(!tokenIsNft && singleAmount && !isUnlimited) && (
                  <HistoryItemTokenPrice
                    tokenId={tokenId}
                    chainId={chain}
                    singlePrice={
                      singlePrice ?? (singeToken as TokenItem)?.price
                    }
                    address={currentAccount?.address!}
                    amount={singleAmount!}
                    style={styles.tokenPriceText}
                  />
                )}
              </View>
            </View>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', width: 32 }}>
              <RcIconSingleArrow
                width={26}
                height={26}
                color={colors2024['neutral-bg-2']}
              />
            </View>
          </View>
        </TouchableOpacity>
      );

    case HistoryItemCateType.Bridge:
    case HistoryItemCateType.Swap:
      return (
        <View style={[styles.doubleBox]}>
          <Text style={styles.swapTitle}>{t('global.from')}</Text>
          <View style={[styles.swapBoxContainer, { marginBottom: 16 }]}>
            {data.sends.map(item => {
              const token = item.token as TokenItem;
              const tokenIsNft = item.token_id?.length === 32;
              return (
                <TouchableOpacity
                  onPress={() => handlePress(token, tokenIsNft)}>
                  <View style={[styles.swapBox]}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                      {tokenIsNft ? (
                        <Media
                          failedPlaceholder={
                            <IconDefaultNFT width={45} height={45} />
                          }
                          type="image_url"
                          src={
                            token?.content?.endsWith('.svg')
                              ? ''
                              : token?.content
                          }
                          thumbnail={
                            token?.content?.endsWith('.svg')
                              ? ''
                              : token?.content
                          }
                          mediaStyle={styles.media}
                          style={styles.media}
                          playIconSize={12}
                        />
                      ) : (
                        <AssetAvatar
                          logo={(token as TokenItem)?.logo_url || ''}
                          size={45}
                        />
                      )}
                      <View
                        style={[
                          styles.singleColomnBox,
                          isFail && styles.isFailBox,
                        ]}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.tokenAmountText,
                            styles.isSendTextColor,
                          ]}>
                          - {formatTokenAmount(item.amount)}{' '}
                          {tokenIsNft
                            ? t('page.singleHome.sectionHeader.Nft')
                            : ellipsisOverflowedText(
                                getTokenSymbol(token as TokenItem),
                                16,
                              )}
                        </Text>
                        <HistoryItemTokenPrice
                          singlePrice={item.price ?? token?.price}
                          amount={item.amount}
                          style={styles.tokenPriceText}
                        />
                      </View>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        width: 26,
                      }}>
                      <RcIconSingleArrow
                        width={26}
                        height={26}
                        color={colors2024['neutral-bg-2']}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.swapTitle}>{t('global.to')}</Text>
          <View style={styles.swapBoxContainer}>
            {data.receives.map(item => {
              const token = item.token as TokenItem;
              const tokenIsNft = item.token_id?.length === 32;
              return (
                <TouchableOpacity
                  onPress={() => handlePress(token, tokenIsNft)}>
                  <View style={[styles.swapBox]}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}>
                      {tokenIsNft ? (
                        <Media
                          failedPlaceholder={
                            <IconDefaultNFT width={45} height={45} />
                          }
                          type="image_url"
                          src={
                            token?.content?.endsWith('.svg')
                              ? ''
                              : token?.content
                          }
                          thumbnail={
                            token?.content?.endsWith('.svg')
                              ? ''
                              : token?.content
                          }
                          mediaStyle={styles.media}
                          style={styles.media}
                          playIconSize={12}
                        />
                      ) : (
                        <AssetAvatar
                          logo={(token as TokenItem)?.logo_url || ''}
                          size={45}
                        />
                      )}
                      <View
                        style={[
                          styles.singleColomnBox,
                          isFail && styles.isFailBox,
                        ]}>
                        <Text
                          numberOfLines={1}
                          style={[styles.tokenAmountText]}>
                          + {formatTokenAmount(item.amount)}{' '}
                          {tokenIsNft
                            ? t('page.singleHome.sectionHeader.Nft')
                            : ellipsisOverflowedText(
                                getTokenSymbol(token as TokenItem),
                                16,
                              )}
                        </Text>
                        <HistoryItemTokenPrice
                          singlePrice={item.price ?? token?.price}
                          amount={item.amount}
                          style={styles.tokenPriceText}
                        />
                      </View>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        width: 26,
                      }}>
                      <RcIconSingleArrow
                        width={26}
                        height={26}
                        color={colors2024['neutral-bg-2']}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
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
            {sends?.map(({ token_id, amount, price, token: iToken }) => (
              <TokenItemInlist
                key={token_id}
                isSend={true}
                chain={chain}
                token_id={token_id}
                amount={amount}
                tokenPrice={price}
                isNft={token_id?.length === 32}
                token={iToken}
                hanldePress={handlePress}
              />
            ))}
            {receives?.map(({ token_id, amount, price, token: iToken }) => (
              <TokenItemInlist
                key={token_id}
                token_id={token_id}
                chain={chain}
                amount={amount}
                tokenPrice={price}
                isNft={token_id?.length === 32}
                token={iToken}
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

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  tokenAmountText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  tokenApproveAmountText: {
    color: colors2024['neutral-title-1'],
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
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  singleColomnBox: {
    // flex: 1,
    width: Dimensions.get('window').width - 160,
    flexDirection: 'column',
    gap: 2,
    // alignItems: 'center',
  },
  colomnBox: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'column',
    position: 'relative',

    backgroundColor: !isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    borderRadius: 16,
    padding: 16,
  },
  swapTitle: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 8,
  },
  iconSwitchArrow: {
    backgroundColor: !isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
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
  swapTokenBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: !isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    flex: 1,
    height: 110,
    gap: 10,
  },
  toTokenBox: {
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: !isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    flex: 1,
    height: 110,
  },
  singleBox: {
    width: '100%',
    // height: 92,
    backgroundColor: !isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
    justifyContent: 'space-between',
    alignContent: 'center',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
  },
  swapBoxContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  swapBox: {
    width: '100%',
    justifyContent: 'space-between',
    alignContent: 'center',
    flexDirection: 'row',
  },
  mutliBox: {
    width: '100%',
    backgroundColor: !isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
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
  iconContainer: {
    position: 'relative',
  },
  walletIcon: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 24,
    height: 24,
    zIndex: 1,
  },
  listItemExtra: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
}));
