import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { useTheme2024 } from '@/hooks/theme';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { createGetStyles2024 } from '@/utils/styles';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { ArrowCircleCC } from '@/assets2024/icons/address';
import { TokenFromAddressItem } from '..';
import { CombineTokensItem } from '@/screens/Home/hooks/store';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { ellipsisAddress } from '@/utils/address';
import { RootNames } from '@/constant/layout';
import { navigateDeprecated } from '@/utils/navigation';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { apisSingleHome } from '@/screens/Home/hooks/singleHome';

interface Props {
  token: AbstractPortfolioToken | CombineTokensItem;
  amountList: TokenFromAddressItem[];
  rawAllAccounts: KeyringAccountWithAlias[];
}

export const TokenArea: React.FC<Props> = ({
  token,
  amountList,
  rawAllAccounts,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { t } = useTranslation();

  const handleOnPress = useCallback(
    (item: TokenFromAddressItem) => {
      const account = rawAllAccounts.find(
        a => isSameAddress(a.address, item.address) && item.type === a.type,
      );
      if (account) {
        apisSingleHome.navigateToSingleHome(account);
      }
    },
    [rawAllAccounts],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: TokenFromAddressItem; index: number }) => {
      return (
        <TouchableOpacity
          style={styles.itemCard}
          key={index}
          onPress={() => handleOnPress(item)}>
          <View style={styles.tokenBox}>
            <WalletIcon
              type={item?.type as KEYRING_TYPE}
              address={item.address}
              width={styles.walletIcon.width}
              height={styles.walletIcon.height}
              style={styles.walletIcon}
            />
            <View style={styles.content}>
              <View style={styles.accountBox}>
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.titleText}>
                  {item?.aliasName || ellipsisAddress(item.address)}
                </Text>
              </View>
              <Text style={styles.tokenAmount} numberOfLines={1}>
                {item.amountStr} {token.symbol}
              </Text>
            </View>
          </View>
          <View style={styles.actionBox}>
            <ArrowCircleCC
              style={styles.arrow}
              color={colors2024['neutral-body']}
              backgroundColor={colors2024['neutral-bg-2']}
            />
          </View>
        </TouchableOpacity>
      );
    },
    [
      handleOnPress,
      styles.accountBox,
      styles.actionBox,
      styles.itemCard,
      styles.titleText,
      styles.tokenAmount,
      styles.tokenBox,
      styles.walletIcon,
      token.symbol,
      styles.arrow,
      colors2024,
      styles.content,
    ],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.balanceTitle}>
          {t('page.tokenDetail.Mybalance')}
        </Text>
      </View>
      {amountList.length ? (
        amountList.map((item, index) => renderItem({ item, index }))
      ) : (
        <View style={styles.itemEmptyContainer}>
          <View style={styles.horizontalLine} />
          <Text style={styles.noBalanceText}>
            {t('page.tokenDetail.noBalance')}
          </Text>
          <View style={styles.horizontalLine} />
        </View>
      )}
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    width: '100%',
    paddingHorizontal: 15,
  },
  horizontalLine: {
    flex: 1,
    height: 1,
    backgroundColor: ctx.colors2024['neutral-line'],
  },
  imgIcon: {
    width: 160,
    height: 116,
  },
  arrow: {
    width: 26,
    height: 26,
    borderRadius: 30,
  },
  noBalanceText: {
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    textAlign: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    marginBottom: 4,
    paddingLeft: 4,
  },
  content: {
    // alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
  },
  accountBox: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 4,
  },
  titleText: {
    flexShrink: 1,
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    flexWrap: 'nowrap',
  },

  walletIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
  },

  body: {},
  balanceTitle: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
  },

  itemCard: {
    width: '100%',
    marginTop: 8,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    borderRadius: 16,
    // borderColor: ctx.colors2024['neutral-line'],
    // borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemEmptyContainer: {
    marginTop: 8,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    borderRadius: 16,
    // borderColor: ctx.colors2024['neutral-line'],
    // borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    width: '100%',
    gap: 8,
    alignItems: 'center',
  },
  tokenBox: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flex: 1,
    gap: 8,
  },
  actionBox: {
    display: 'flex',
    flexDirection: 'row',
    width: 60,
    // gap: 8,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionText: {
    color: ctx.colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  tokenUsd: {
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  tokenAmount: {
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
}));
