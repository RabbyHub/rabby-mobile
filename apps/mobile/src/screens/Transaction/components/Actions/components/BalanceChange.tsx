import { formatAmount, formatTokenAmount } from '@/utils/number';
import {
  BalanceChange as IBalanceChange,
  TokenItem,
  TransferingNFTItem,
} from '@rabby-wallet/rabby-api/dist/types';
import BigNumber from 'bignumber.js';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View, ViewProps } from 'react-native';
// import useBalanceChange from '../..//hooks/useBalanceChange';
// import { Table, Col, Row } from '../Actions/components/Table';
// import LogoWithText from '../Actions/components/LogoWithText';
// import * as Values from '../Actions/components/Values';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue } from '@/utils/number';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
// import useCommonStyle from '../../hooks/useCommonStyle';
import { IconDefaultNFT } from '@/assets/icons/nft';
import RcIconArrowRight from '@/assets2024/icons/history/IconArrowRightCircle.svg';
import { AssetAvatar } from '@/components';
import useBalanceChange from '@/components/Approval/hooks/useBalanceChange';
import { Media } from '@/components/Media';
import { useTokenDetailSheetModalOnApprovals } from '@/components/TokenDetailPopup/hooks';
import { RootNames } from '@/constant/layout';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { naviPush } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Account } from '@/core/services/preference';
import { ellipsisOverflowedText } from '@/utils/text';

const NFTBalanceChange = ({
  data,
  type,
  isSingleAddress,
}: {
  data: IBalanceChange;
  type: 'receive' | 'send';
  isSingleAddress?: boolean;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const handleGotoDetail = useMemoizedFn((nft: TransferingNFTItem) => {
    naviPush(RootNames.NftDetail, {
      token: nft,
      isSingleAddress,
    });
  });

  const { hasReceives, receiveNftList, hasTransferedOut, sendNftList } =
    React.useMemo(() => {
      const sendNftList = data.send_nft_list.slice(0);
      const countSendNft = sendNftList.reduce(
        (accu, item) => accu + (item.amount || 0),
        0,
      );
      const hasTransferedOut = sendNftList.length > 0;

      const receiveNftList = data.receive_nft_list.slice(0);
      const countReceives = receiveNftList.reduce(
        (accu, item) => accu + (item.amount || 0),
        0,
      );
      const hasReceives = receiveNftList.length > 0;

      return {
        hasReceives,
        countReceives,
        receiveNftList,
        hasTransferedOut,
        countSendNft,
        sendNftList,
      };
    }, [data]);

  if (type === 'receive' && hasReceives) {
    return (
      <>
        {receiveNftList?.map(item => (
          <TouchableOpacity
            key={`${item.id}-${item.inner_id}`}
            style={styles.listItem}
            onPress={() => {
              handleGotoDetail(item);
            }}>
            <View style={styles.logoWithText}>
              <Media
                failedPlaceholder={
                  <IconDefaultNFT width="100%" height="100%" />
                }
                type={item?.content_type}
                src={item?.content?.endsWith('.svg') ? '' : item?.content}
                thumbnail={item?.content?.endsWith('.svg') ? '' : item?.content}
                playIconSize={18}
                mediaStyle={styles.nftIcon}
                style={styles.nftIcon}
              />
              <Text style={[styles.changeText, styles.changeTextPositive]}>
                + {formatAmount(item.amount, 0)}{' '}
                {item.collection ? item.collection.name : item.name}
              </Text>
            </View>
            <View style={styles.listItemRight}>
              <RcIconArrowRight />
            </View>
          </TouchableOpacity>
        ))}
      </>
    );
  }
  if (type === 'send' && hasTransferedOut) {
    return (
      <>
        {sendNftList?.map(item => (
          <TouchableOpacity
            key={`${item.id}-${item.inner_id}`}
            style={styles.listItem}
            onPress={() => {
              handleGotoDetail(item);
            }}>
            <View style={styles.logoWithText}>
              <Media
                failedPlaceholder={
                  <IconDefaultNFT width="100%" height="100%" />
                }
                type={item?.content_type}
                src={item?.content?.endsWith('.svg') ? '' : item?.content}
                thumbnail={item?.content?.endsWith('.svg') ? '' : item?.content}
                playIconSize={18}
                mediaStyle={styles.nftIcon}
                style={styles.nftIcon}
              />
              <Text style={styles.changeText}>
                - {formatAmount(item.amount, 0)}{' '}
                {item.collection ? item.collection.name : item.name}
              </Text>
            </View>
            <View style={styles.listItemRight}>
              <RcIconArrowRight />
            </View>
          </TouchableOpacity>
        ))}
      </>
    );
  }
  return null;
};

export const BalanceChange = ({
  data,
  version,
  isSingleAddress,
  account,
  successTitle,
  containerStyle,
}: {
  data?: IBalanceChange;
  version: 'v0' | 'v1' | 'v2';
  isSingleAddress?: boolean;
  account?: Account;
  successTitle?: string;
  containerStyle?: ViewProps['style'];
}) => {
  const { t } = useTranslation();
  const isSuccess = data?.success;
  const { styles, colors } = useTheme2024({ getStyle });
  // const commonStyle = useCommonStyle();

  const { hasTokenChange, hasNFTChange } = useBalanceChange({
    balance_change: data,
  });

  const hasChange = hasNFTChange || hasTokenChange;

  const { receiveTokenList, sendTokenList, showUsdValueDiff } =
    React.useMemo(() => {
      if (!data) {
        return {
          receiveTokenList: [],
          sendTokenList: [],
          showUsdValueDiff: false,
        };
      }
      const receiveTokenList = data.receive_token_list;
      const sendTokenList = data.send_token_list;
      const showUsdValueDiff =
        data.receive_nft_list.length <= 0 &&
        data.send_nft_list.length <= 0 &&
        (data.send_token_list.length > 0 || data.receive_token_list.length > 0);
      return {
        receiveTokenList,
        sendTokenList,
        showUsdValueDiff,
      };
    }, [data]);

  const handleGotoDetail = useMemoizedFn((token: TokenItem) => {
    naviPush(RootNames.TokenDetail, {
      token: tokenItemToITokenItem(token, ''),
      needUseCacheToken: true,
      isSingleAddress,
      account,
    });
  });

  if (!data || data.error || !hasChange || version === 'v0') {
    return null;
  }

  return (
    <View style={[styles.tokenBalanceChange, containerStyle]}>
      <View style={styles.tokenBalanceChangeHeader}>
        <Text style={styles.titleText}>
          {successTitle || t('page.transactions.detail.InteractionResults')}
        </Text>
      </View>
      <View style={styles.list}>
        {sendTokenList?.map(token => (
          <TouchableOpacity
            key={token.id}
            style={styles.listItem}
            onPress={() => {
              handleGotoDetail(token);
            }}>
            <View style={styles.logoWithText}>
              <AssetAvatar logo={token.logo_url} size={33} />
              <Text style={styles.changeText}>
                - {formatTokenAmount(token.amount)}{' '}
                {ellipsisOverflowedText(getTokenSymbol(token), 12)}
              </Text>
            </View>
            <View style={styles.listItemRight}>
              <Text style={styles.usdValue}>
                ≈{' '}
                {formatUsdValue(
                  new BigNumber(token.amount).times(token.price).toFixed(),
                )}
              </Text>
              <RcIconArrowRight />
            </View>
          </TouchableOpacity>
        ))}
        {receiveTokenList?.map(token => (
          <TouchableOpacity
            key={token.id}
            style={styles.listItem}
            onPress={() => {
              handleGotoDetail(token);
            }}>
            <View style={styles.logoWithText}>
              <AssetAvatar logo={token.logo_url} size={33} />
              <Text style={[styles.changeText, styles.changeTextPositive]}>
                + {formatTokenAmount(token.amount)}{' '}
                {ellipsisOverflowedText(getTokenSymbol(token), 12)}
              </Text>
            </View>
            <View style={styles.listItemRight}>
              <Text style={styles.usdValue}>
                ≈{' '}
                {formatUsdValue(
                  new BigNumber(token.amount).times(token.price).toFixed(),
                )}
              </Text>
              <RcIconArrowRight />
            </View>
          </TouchableOpacity>
        ))}

        <NFTBalanceChange type="send" data={data} />
        <NFTBalanceChange type="receive" data={data} />
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors, colors2024, isLight }) => {
  return {
    tokenBalanceChange: {
      paddingVertical: 16,
      paddingLeft: 16,
      paddingRight: 12,
      backgroundColor: !isLight
        ? colors2024['neutral-bg-2']
        : colors2024['neutral-bg-1'],
      borderRadius: 16,
    },
    tokenBalanceChangeHeader: {
      marginBottom: 16,
    },

    list: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    },

    listItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    },

    listItemRight: {
      marginLeft: 'auto',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    logoWithText: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },

    titleText: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
    },

    changeText: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '700',
    },

    changeTextPositive: {
      color: colors2024['green-default'],
    },

    usdValue: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
    },
    iconAlert: {
      width: 16,
      marginTop: 2,
      marginRight: 4,
      color: colors['orange-default'],
      position: 'relative',
    },
    headline: {
      fontSize: 14,
      lineHeight: 16,
      fontWeight: '500',
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      color: colors['neutral-title-1'],
    },
    nftIcon: {
      width: 33,
      height: 33,
      borderRadius: 2,
    },
  };
});
