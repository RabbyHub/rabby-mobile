/* eslint-disable react-native/no-inline-styles */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import RcTipCC from '@/assets2024/icons/common/tips.svg';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import {
  type DisplayedTokenWithOwner,
  type TokenItemFromAbstractPortfolioToken,
} from '@/utils/token';
import { AssetAvatar } from '../AssetAvatar';
import { Skeleton } from '@rneui/themed';
import { useTranslation } from 'react-i18next';
import { TextBadge } from '@/screens/Address/components/PinBadge';
import { AccountInfoInTokenRow } from './AccountWidgets';
import { Favorite } from '@/components2024/Favorite';
import { ExchangeLogos } from '@/screens/Home/components/AssetRenderItems/ExchangeLogos';

export const ITEM_HEIGHT = 72;

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export type TokenItemForRender = {
  _chain: string;
  recentList: ((
    | TokenItem
    | Omit<TokenItemFromAbstractPortfolioToken, 'isPinned' | 'pinIndex'>
  ) & { group?: string })[];
  TokenRender: React.ComponentType<{
    token: TokenItem;
    ownerAccount: DisplayedTokenWithOwner['ownerAccount'];
  }>;
};
export type TokenItemFromAbstractPortfolioTokenWithExtra =
  TokenItemFromAbstractPortfolioToken & {
    logoUrls?: string[];
  };

export type TokenItemInSelectorType = {
  id: string;
  amount: number;
  _logo: string;
  _symbol: string;
  _amount: string;
  _price: string;
  _netWorth: number;
  _netWorthStr: string;
  _chain: string;
  trade_volume_level: any;
  $origin: TokenItemForRender | TokenItemFromAbstractPortfolioTokenWithExtra;
};

export function TokenItemInSelector({
  needToTokenMarketInfo,
  cexLogos,
  isManualFold,
  isBridgeTo,
  isPined,
  isExcludeBalanceShowTips,
  showOwnerAccount,
  ownerAccount,
  handleShowExcludeTips,
  handleFavorite,
  token,
}: {
  needToTokenMarketInfo: boolean;
  cexLogos: string[];
  isManualFold?: boolean;
  isBridgeTo: boolean;
  isPined: boolean;
  isExcludeBalanceShowTips?: boolean;
  showOwnerAccount: boolean;
  ownerAccount: DisplayedTokenWithOwner['ownerAccount'];
  handleShowExcludeTips(): void;
  handleFavorite(): void;
  token: TokenItemInSelectorType;
}) {
  const { isLight, styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <>
      <View style={[styles.tokenLeft, styles.tokenLeftLoaded]}>
        <AssetAvatar
          logo={token?._logo}
          size={40}
          chain={token?._chain}
          chainSize={18}
          innerChainStyle={styles.avatarLogo}
          style={styles.tokenAvatarCol}
        />
      </View>
      <View style={styles.tokenCenter}>
        <View
          style={[
            styles.tokenCenterFloor,
            styles.utilMl,
            styles.tokenCenterFloor1,
          ]}>
          <View style={[styles.tokenInfoCol, styles.tokenInfoColSecondaryGrow]}>
            <View style={styles.tokenNameBox}>
              <Text
                style={[
                  styles.tokenName,
                  !needToTokenMarketInfo && styles.tokenNameFullWidth,
                ]}
                ellipsizeMode="tail"
                numberOfLines={1}>
                {token?._symbol}
              </Text>
              {isManualFold && <TextBadge type="folded" />}
              {needToTokenMarketInfo && (
                <View style={styles.exchangeLogosContainer}>
                  <ExchangeLogos logos={cexLogos} />
                </View>
              )}
            </View>
          </View>
          <View
            style={[
              styles.tokenInfoCol,
              styles.tokenInfoColPrimaryShrink,
              styles.utilMl,
              styles.tokenInfoColRight,
            ]}>
            <Text style={[styles.tokenHeaderNetworth]}>
              {isExcludeBalanceShowTips ? (
                <TouchableOpacity
                  hitSlop={hitSlop}
                  onPress={handleShowExcludeTips}>
                  <RcTipCC
                    style={styles.tips}
                    color={colors2024['neutral-info']}
                  />
                </TouchableOpacity>
              ) : (
                token._netWorthStr
              )}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.tokenCenterFloor,
            styles.utilMl,
            styles.tokenCenterFloor2,
          ]}>
          <View style={[styles.tokenInfoCol, styles.tokenInfoColPrimaryShrink]}>
            {showOwnerAccount ? (
              !ownerAccount ? null : (
                <AccountInfoInTokenRow
                  containerStyle={{ marginTop: 2 }}
                  ownerAccount={ownerAccount}
                />
              )
            ) : (
              <Text
                style={[styles.tokenPrice, { marginTop: 4 }]}
                numberOfLines={1}>
                {token._price}
              </Text>
            )}
            {isBridgeTo && (
              <View
                style={[
                  styles.tokenInfoColRight,
                  styles.tardeLevel,
                  {
                    backgroundColor:
                      token.trade_volume_level === 'low'
                        ? colors2024['orange-light-4']
                        : colors2024['green-light-4'],
                  },
                ]}>
                <Text
                  style={[
                    styles.tardeLevelText,
                    {
                      color:
                        token.trade_volume_level === 'low'
                          ? colors2024['orange-default']
                          : colors2024['green-default'],
                    },
                  ]}>
                  {token.trade_volume_level === 'low'
                    ? t('component.TokenSelector.bridgeTo.low')
                    : t('component.TokenSelector.bridgeTo.high')}
                </Text>
              </View>
            )}
          </View>

          <View
            style={[
              styles.tokenInfoCol,
              styles.tokenInfoColSecondaryGrow,
              styles.utilMl,
              styles.tokenInfoColRight,
            ]}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.tokenHeaderAmount,
                isExcludeBalanceShowTips && styles.textSecondary,
              ]}>
              {token._amount} {token._symbol}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.tokenRight}>
        <Favorite
          favorite={isPined}
          style={styles.favorite}
          handlePressFavorite={handleFavorite}
        />
      </View>
    </>
  );
}

function LoadingItem() {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={[styles.tokenItem, { marginTop: 8, marginHorizontal: 12 }]}>
      <View style={styles.tokenLeft}>
        <Skeleton circle width={36} height={36} />

        <View style={[styles.tokenInfoCol, { marginLeft: 12, gap: 8 }]}>
          <Skeleton width={34} height={20} />

          <Skeleton width={70} height={20} />
        </View>
      </View>
      <View style={[styles.tokenInfoCol, styles.tokenInfoColRight, { gap: 8 }]}>
        <Skeleton width={70} height={18} />
        <Skeleton width={34} height={18} />
      </View>
    </View>
  );
}

TokenItemInSelector.LoadingItem = LoadingItem;

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    avatarLogo: {
      borderWidth: 1.5,
      borderColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
    },
    tardeLevel: {
      borderRadius: 900,
      color: colors2024['green-default'],
      backgroundColor: colors2024['green-light-4'],
      paddingHorizontal: 6,
      paddingVertical: 1,
      marginTop: 5,
    },
    tardeLevelText: {
      color: colors2024['green-default'],
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
      fontFamily: 'SF Pro Rounded',
    },
    tokenItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: ITEM_HEIGHT,
      // paddingHorizontal: 8,
      paddingRight: 12,
      paddingLeft: 12,
      // marginHorizontal: 12,
      // marginTop: 8,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      borderRadius: 16,
      // // leave here for debug
      // borderWidth: 1,
      // borderColor: 'blue',
    },
    scamHeader: {
      marginHorizontal: 12,
      height: ITEM_HEIGHT,
      marginTop: 8,
      width: 'auto',
    },
    tips: {
      width: 14,
      height: 14,
    },
    tokenItemDisabled: { opacity: 0.5 },
    tokenLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
      flexShrink: 0,
    },
    tokenLeftLoaded: {
      flexWrap: 'nowrap',
    },
    tokenCenter: {
      flexShrink: 1,
      width: '100%',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    tokenCenterFloor: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    tokenCenterFloor1: {
      // ...makeDebugBorder('green'),
    },
    tokenCenterFloor2: {
      // ...makeDebugBorder('yellow'),
      marginTop: 4,
    },
    tokenRight: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    tokenAvatarCol: {
      flexShrink: 0,
    },
    tokenInfoColSecondaryGrow: {
      width: '100%',
      flexShrink: 1,
      // ...makeDebugBorder('red')
    },
    tokenInfoColPrimaryShrink: {
      flexShrink: 0,
      // ...makeDebugBorder('yellow')
    },
    tokenInfoCol: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    utilMl: {
      marginLeft: 12,
    },
    tokenNameBox: {
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
      // ...makeDebugBorder(),
    },
    tokenName: {
      marginRight: 8,
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      justifyContent: 'center',
      fontWeight: '700',
      lineHeight: 20,
      fontFamily: 'SF Pro Rounded',
    },
    tokenNameFullWidth: {
      width: '100%',
    },
    exchangeLogosContainer: {
      maxWidth: '100%',
      flexShrink: 1,
    },
    tokenPrice: {
      color: colors2024['neutral-secondary'],
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },
    searchBar: {
      flex: 1,
    },
    tokenInfoColRight: {
      alignItems: 'flex-end',
      textAlign: 'right',
    },
    tokenHeaderAmount: {
      color: colors2024['neutral-secondary'],
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
      textAlign: 'right',
      width: '100%',
      maxWidth: '100%',
      fontFamily: 'SF Pro Rounded',
    },
    textSecondary: {
      color: colors2024['neutral-secondary'],
    },
    isSelected: {
      backgroundColor: colors2024['brand-light-1'],
      marginHorizontal: 12,
      borderRadius: 12,
    },
    tokenHeaderNetworth: {
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 20,
      textAlign: 'right',
      fontFamily: 'SF Pro Rounded',
    },
    favorite: {
      marginLeft: 8,
    },
  };
});
