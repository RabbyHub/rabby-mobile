import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { colord } from 'colord';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';

import { AssetAvatar } from '@/components/AssetAvatar';
import { useRefreshAutoLockPanResponder } from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { RootNames } from '@/constant/layout';
import { getFallbackAccountSnapshot } from '@/core/serviceApi/preference';
import { openapi } from '@/core/request';
import { useRemovedTokens } from '@/hooks/useRemovedTokens';
import { useTheme2024 } from '@/hooks/theme';
import type { IManageToken } from '@/types/assets';
import { createGetStyles2024 } from '@/utils/styles';
import { navigateDeprecated } from '@/utils/navigation';
import { getTokenSymbol, tokenItemToITokenItem } from '@/utils/token';

type TokenInfo = { symbol: string; logoUrl: string; token: TokenItem };
const TOKEN_CARD_HEIGHT = 68;
const TOKEN_CARD_RADIUS = 14;
const getTokenKey = (token: IManageToken) =>
  `${token.chainId.toLowerCase()}:${token.tokenId.toLowerCase()}`;
const rowSpacingStyles = StyleSheet.create({ separator: { height: 18 } });

function TokenSeparator() {
  return <View style={rowSpacingStyles.separator} />;
}

export function RemovedTokenPopup({ onClose }: { onClose(): void }) {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const modalRef = useRef<AppBottomSheetModal>(null);
  const selectedTokenRef = useRef<TokenItem | null>(null);
  const removedTokens = useRemovedTokens(state => state.removedTokens);
  const [tokenInfo, setTokenInfo] = useState<Map<string, TokenInfo>>(new Map());
  const { panResponder } = useRefreshAutoLockPanResponder();
  const contentStyle = useMemo(
    () => [styles.content, { paddingBottom: bottom + 24 }],
    [bottom, styles.content],
  );
  const cardColors = useMemo(() => {
    const color = colors2024[isLight ? 'neutral-bg-1' : 'neutral-bg-2'];
    return [
      colord(color).alpha(0.9).toRgbString(),
      colord(color).alpha(0.54).toRgbString(),
    ];
  }, [colors2024, isLight]);

  useEffect(() => {
    modalRef.current?.present();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const address = getFallbackAccountSnapshot()?.address;
    if (!address) {
      return;
    }

    const loadTokenInfo = async () => {
      for (let offset = 0; offset < removedTokens.length; offset += 50) {
        if (cancelled) {
          return;
        }
        const tokens = await openapi.customListToken(
          removedTokens
            .slice(offset, offset + 50)
            .map(token => `${token.chainId.toLowerCase()}:${token.tokenId}`),
          address,
        );
        if (cancelled) {
          return;
        }
        setTokenInfo(previous => {
          const next = new Map(previous);
          tokens.forEach(token => {
            next.set(getTokenKey({ chainId: token.chain, tokenId: token.id }), {
              symbol: getTokenSymbol(token),
              logoUrl: token.logo_url || '',
              token,
            });
          });
          return next;
        });
      }
    };
    loadTokenInfo().catch(error =>
      console.error('Load removed token info failed:', error),
    );
    return () => {
      cancelled = true;
    };
  }, [removedTokens]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      onDismiss={() => {
        const token = selectedTokenRef.current;
        selectedTokenRef.current = null;
        onClose();
        if (token) {
          navigateDeprecated(RootNames.TokenDetail, {
            token: tokenItemToITokenItem(token, ''),
            needUseCacheToken: true,
          });
        }
      }}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg0',
      })}
      handleIndicatorStyle={styles.handleIndicator}
      enableDynamicSizing
      maxDynamicContentSize={height - 200}>
      <BottomSheetFlatList
        {...panResponder.panHandlers}
        data={removedTokens}
        keyExtractor={getTokenKey}
        contentContainerStyle={contentStyle}
        initialNumToRender={8}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>
              {t('page.setting.removedToken.title')}
            </Text>
            <Text style={styles.description}>
              {t('page.setting.removedToken.description')}
            </Text>
          </View>
        }
        ItemSeparatorComponent={TokenSeparator}
        renderItem={({ item }) => {
          const info = tokenInfo.get(getTokenKey(item));
          if (!info) {
            return (
              <CustomSkeleton
                animation="none"
                width="100%"
                height={TOKEN_CARD_HEIGHT}
                style={styles.skeleton}
              />
            );
          }
          return (
            <Pressable
              style={styles.cardShadow}
              accessibilityRole="button"
              onPress={() => {
                if (selectedTokenRef.current) {
                  return;
                }
                selectedTokenRef.current = info.token;
                modalRef.current?.dismiss();
              }}>
              <LinearGradient
                useAngle
                angle={49.5}
                colors={cardColors}
                style={styles.card}>
                <AssetAvatar
                  logo={info.logoUrl}
                  chain={item.chainId.toLowerCase()}
                  size={40}
                  chainSize={16}
                  innerChainStyle={styles.chainIcon}
                />
                <Text style={styles.symbol} numberOfLines={1}>
                  {info.symbol || item.tokenId}
                </Text>
              </LinearGradient>
            </Pressable>
          );
        }}
      />
    </AppBottomSheetModal>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  handleIndicator: { backgroundColor: colors2024['neutral-sheet-handle'] },
  content: { paddingHorizontal: 20, paddingTop: 12 },
  header: { marginBottom: 16 },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '900',
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
    color: colors2024['neutral-title-1'],
    marginBottom: 16,
  },
  description: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-foot'],
  },
  cardShadow: {
    borderRadius: TOKEN_CARD_RADIUS,
    shadowColor: '#37383F',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
  },
  card: {
    height: TOKEN_CARD_HEIGHT,
    borderRadius: TOKEN_CARD_RADIUS,
    borderWidth: 1,
    borderColor: colors2024[isLight ? 'neutral-bg-1' : 'neutral-bg-2'],
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skeleton: {
    borderRadius: TOKEN_CARD_RADIUS,
    backgroundColor: colors2024['neutral-bg-4'],
  },
  chainIcon: { right: -1, bottom: -1 },
  symbol: {
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
  },
}));
