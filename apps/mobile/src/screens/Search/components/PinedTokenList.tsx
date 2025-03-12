import { memo, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { Skeleton } from '@rneui/themed';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { usePinTokens } from '../usePinTokens';
import { AssetAvatar } from '@/components';
import { ellipsisOverflowedText } from '@/utils/text';
import { getTokenSymbol } from '@/utils/token';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';

export const PinedTokenList = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { data: pinTokens, handleFetchTokens } = usePinTokens();
  const handleOpenTokenDetail = useCallback((token: AbstractPortfolioToken) => {
    navigate(RootNames.TokenDetail, {
      token: token,
      unHold: false,
      needUseCacheToken: true,
    });
  }, []);

  useEffect(() => {
    handleFetchTokens();
  }, [handleFetchTokens]);

  return (
    pinTokens.length > 0 && (
      <View style={styles.container}>
        <View style={styles.titleHeader}>
          <Text style={styles.titleText}>Pinned Token</Text>
        </View>
        <View style={styles.section}>
          {pinTokens.map((token, index) => (
            <TouchableOpacity
              onPress={e =>
                handleOpenTokenDetail(ensureAbstractPortfolioToken(token))
              }
              style={styles.itemContainer}
              key={index}>
              <AssetAvatar
                logo={token?.logo_url}
                chain={token?.chain}
                chainSize={10}
                size={24}
              />
              <Text style={styles.tokenText}>
                {ellipsisOverflowedText(getTokenSymbol(token), 8)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    )
  );
};
const getStyles = createGetStyles2024(ctx => ({
  container: {
    width: '100%',
    padding: 20,
  },
  titleHeader: {
    marginBottom: 20,
  },
  section: {
    paddingBottom: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    rowGap: 12,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 10,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    gap: 8,
  },
  titleText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    color: ctx.colors2024['neutral-secondary'],
    lineHeight: 20,
  },
  tokenText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'normal',
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
  },
}));
