import { useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { usePinTokens } from '../usePinTokens';
import { AssetAvatar } from '@/components';
import { ellipsisOverflowedText } from '@/utils/text';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';
import { RootNames } from '@/constant/layout';
import { navigateDeprecated } from '@/utils/navigation';
import { ContextMenuView } from '@/components2024/ContextMenuView/ContextMenuView';
import { useFocusEffect } from '@react-navigation/native';
import { trigger } from 'react-native-haptic-feedback';
import { useUserTokenSettings } from '@/hooks/useTokenSettings';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

export const PinedTokenList = () => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { data: pinTokens, handleFetchTokens } = usePinTokens();
  const { removePinedToken } = useUserTokenSettings();
  const handleOpenTokenDetail = useCallback((token: TokenItem) => {
    navigateDeprecated(RootNames.TokenDetail, {
      token: tokenItemToITokenItem(token, ''),
      unHold: false,
      needUseCacheToken: true,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      handleFetchTokens();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return pinTokens.length > 0 ? (
    <View style={styles.container}>
      <View style={styles.titleHeader}>
        <Text style={styles.titleText}>
          {t('page.search.header.favoriteTitle')}
        </Text>
      </View>
      <View style={styles.section}>
        {pinTokens.map((token, index) => (
          <ContextMenuView
            menuConfig={{
              menuActions: [
                {
                  title: t('page.tokenDetail.action.unfavorite'),
                  icon: isLight
                    ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite.png')
                    : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite_dark.png'),
                  androidIconName: 'ic_rabby_menu_token_unfavorite',
                  key: 'favorite',
                  action() {
                    removePinedToken({
                      id: token.id,
                      chain: token.chain,
                    });
                    setTimeout(() => {
                      handleFetchTokens();
                    }, 0);
                  },
                },
              ],
            }}
            key={`${token.chain}-${token.id}`}
            preViewBorderRadius={10}
            triggerProps={{ action: 'longPress' }}>
            <TouchableOpacity
              onPress={() => {
                handleOpenTokenDetail(token);
              }}
              delayLongPress={200} // long press delay
              onLongPress={() => {
                trigger('impactLight', {
                  enableVibrateFallback: true,
                  ignoreAndroidSystemSettings: false,
                });
              }}
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
          </ContextMenuView>
        ))}
      </View>
    </View>
  ) : null;
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
