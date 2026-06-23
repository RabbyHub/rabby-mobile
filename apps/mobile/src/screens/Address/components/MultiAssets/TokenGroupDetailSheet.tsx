import React, { memo, useCallback, useMemo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { TokenRowV2 } from '@/screens/Home/components/AssetRenderItems';
import { navigateDeprecated } from '@/utils/navigation';
import { ASSETS_ITEM_HEIGHT_NEW, RootNames } from '@/constant/layout';
import { ITokenItem } from '@/store/tokens';
import { useFindAccountByAddress } from './hooks/share';
import AutoLockView from '@/components/AutoLockView';
import {
  GlobalModalViewProps,
  MODAL_NAMES,
} from '@/components2024/GlobalBottomSheetModal/types';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components/Typography';
import { AccountOverview } from '@/screens/Home/components/AccountOverview';
import { getTokenSymbol } from '@/utils/token';
import { formatAmount } from '@/utils/number';
import type { KeyringAccountWithAlias } from '@/hooks/account';

type TokenGroupDetailSheetProps = GlobalModalViewProps<
  MODAL_NAMES.TOKEN_GROUP_DETAIL,
  {
    tokens: ITokenItem[];
    amountOnly?: boolean;
  }
>;

const AmountOnlyTokenDistributionRow = memo(
  ({
    token,
    account,
    onPress,
  }: {
    token: ITokenItem;
    account?: KeyringAccountWithAlias;
    onPress(token: ITokenItem): void;
  }) => {
    const { styles } = useTheme2024({ getStyle });
    const handlePress = useCallback(() => onPress(token), [onPress, token]);

    return (
      <TouchableOpacity style={styles.amountOnlyRow} onPress={handlePress}>
        <AssetAvatar
          logo={token.logo_url}
          chain={token.chain}
          size={46}
          chainSize={18}
          style={styles.tokenAvatar}
        />
        <View style={styles.amountOnlyContent}>
          <View style={styles.amountOnlyInfo}>
            <Text numberOfLines={1} style={styles.tokenSymbol}>
              {getTokenSymbol(token)}
            </Text>
            {!!account && (
              <AccountOverview
                account={account}
                logoSize={14}
                textStyle={styles.accountText}
              />
            )}
          </View>
          <Text numberOfLines={1} style={styles.tokenBalance}>
            {formatAmount(token.amount, 4, true)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  },
);

const TokenGroupDetailSheet: React.FC<TokenGroupDetailSheetProps> = ({
  tokens,
  amountOnly,
  onCancel,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const getAccountByAddress = useFindAccountByAddress();
  const sortedTokens = useMemo(() => {
    return tokens.slice().sort((a, b) => {
      if (a.is_core && !b.is_core) {
        return -1;
      }
      if (!a.is_core && b.is_core) {
        return 1;
      }
      const aValue = (a.price ?? 0) * (a.amount ?? 0);
      const bValue = (b.price ?? 0) * (b.amount ?? 0);
      return bValue - aValue;
    });
  }, [tokens]);

  const handleOpenTokenDetail = useCallback(
    (token: ITokenItem) => {
      const account = getAccountByAddress(token.owner_addr);
      onCancel?.();
      navigateDeprecated(RootNames.TokenDetail, {
        token: token,
        unHold: false,
        needUseCacheToken: true,
        account,
      });
    },
    [getAccountByAddress, onCancel],
  );

  return (
    <AutoLockView as="View" style={styles.container}>
      <BottomSheetFlatList
        data={sortedTokens}
        keyExtractor={item =>
          `${item.owner_addr}-${item.chain}-${item.id}-${item.inner_id ?? ''}`
        }
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const account = getAccountByAddress(item.owner_addr);
          return (
            <View style={styles.rowWrap}>
              {amountOnly ? (
                <AmountOnlyTokenDistributionRow
                  token={item}
                  account={account}
                  onPress={handleOpenTokenDetail}
                />
              ) : (
                <TokenRowV2
                  data={item}
                  onTokenPress={handleOpenTokenDetail}
                  logoSize={46}
                  chainLogoSize={18}
                  style={styles.renderItemWrapper}
                  account={account}
                  scene="portfolio"
                />
              )}
            </View>
          );
        }}
      />
    </AutoLockView>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-0'],
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  rowWrap: {
    height: ASSETS_ITEM_HEIGHT_NEW,
    marginBottom: 8,
  },
  renderItemWrapper: {
    height: ASSETS_ITEM_HEIGHT_NEW,
  },
  amountOnlyRow: {
    height: ASSETS_ITEM_HEIGHT_NEW,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenAvatar: {
    marginRight: 12,
  },
  amountOnlyContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  amountOnlyInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  tokenSymbol: {
    color: colors2024['neutral-title-1'],
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  accountText: {
    color: colors2024['neutral-foot'],
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '400',
  },
  tokenBalance: {
    flexShrink: 0,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'right',
  },
}));

export default TokenGroupDetailSheet;
