import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
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

type TokenGroupDetailSheetProps = GlobalModalViewProps<
  MODAL_NAMES.TOKEN_GROUP_DETAIL,
  {
    tokens: ITokenItem[];
  }
>;

const TokenGroupDetailSheet: React.FC<TokenGroupDetailSheetProps> = ({
  tokens,
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
        renderItem={({ item }) => (
          <View style={styles.rowWrap}>
            <TokenRowV2
              data={item}
              onTokenPress={handleOpenTokenDetail}
              logoSize={46}
              chainLogoSize={18}
              style={styles.renderItemWrapper}
              account={getAccountByAddress(item.owner_addr)}
              scene="portfolio"
            />
          </View>
        )}
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
}));

export default TokenGroupDetailSheet;
