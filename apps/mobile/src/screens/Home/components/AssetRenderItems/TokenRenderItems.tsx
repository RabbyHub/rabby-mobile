import React, { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import RcFoldCC from '@/assets2024/icons/common/fold.svg';
import RcUnFoldCC from '@/assets2024/icons/common/unfold.svg';
import RcTipCC from '@/assets2024/icons/common/tips.svg';
import { AssetAvatar } from '@/components/AssetAvatar';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { SMALL_TOKEN_ID } from '@/utils/token';
import { createGetStyles2024 } from '@/utils/styles';
import { AbstractPortfolioToken } from '../../types';
import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { preferenceService } from '@/core/services';
import { useRefreshTags } from '../../hooks/token';
import { trigger } from 'react-native-haptic-feedback';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { PinBadge } from '@/screens/Address/components/PinBadge';
import { toast } from '@/components2024/Toast';
import { ASSETS_ITEM_HEIGHT } from '@/constant/layout';

const formatPercentage = (x: number) => {
  if (Math.abs(x) < 0.00001) {
    return '0%';
  }
  const percentage = (x * 100).toFixed(3);
  return `${x >= 0 ? '+' : ''}${percentage}%`;
};

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

const TokenRow = memo(
  ({
    data,
    style,
    logoSize,
    logoStyle,
    fold,
    address,
    onTokenPress,
  }: {
    data: AbstractPortfolioToken;
    style?: ViewStyle;
    logoStyle?: ViewStyle;
    fold?: boolean;
    logoSize?: number;
    address?: string;
    onTokenPress?(token: AbstractPortfolioToken): void;
  }) => {
    const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
    const { t } = useTranslation();
    const percentColor = useMemo(() => {
      if (
        !data?.price_24h_change ||
        Math.abs(data.price_24h_change) < 0.00001
      ) {
        return colors2024['neutral-secondary'];
      }
      if (data.price_24h_change > 0) {
        return colors2024['green-default'];
      }
      return colors2024['red-default'];
    }, [colors2024, data.price_24h_change]);

    const mediaStyle = useMemo(
      () => StyleSheet.flatten([styles.tokenRowLogo, logoStyle]),
      [logoStyle, styles.tokenRowLogo],
    );

    const onPressToken = useCallback(() => {
      return onTokenPress?.(data);
    }, [data, onTokenPress]);
    const isDarkTheme = useGetBinaryMode() === 'dark';
    const { refreshTags } = useRefreshTags();

    const handleShowExcludeTips = () => {
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.DESCRIPTION,
        title: t('page.tokenDetail.excludeBalanceTips'),
        sections: [],
        bottomSheetModalProps: {
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          enableDismissOnClose: true,
          snapPoints: ['40%'],
        },
        nextButtonProps: {
          title: (
            <Text style={styles.modalNextButtonText}>
              {t('page.tokenDetail.excludeBalanceTipsButton')}
            </Text>
          ),
          titleStyle: StyleSheet.flatten([styles.modalNextButtonText]),
          onPress: () => {
            removeGlobalBottomSheetModal2024(modalId);
          },
        },
      });
    };

    const menuActions = React.useMemo(() => {
      return [
        {
          title: data._isFold
            ? t('page.tokenDetail.action.unfold')
            : t('page.tokenDetail.action.fold'),
          icon: data._isFold
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold.png'),
          androidIconName: 'ic_rabby_menu_edit',
          key: 'fold',
          action() {
            if (!address) {
              return;
            }
            if (data._isFold) {
              preferenceService.manualUnFoldToken(address, {
                tokenId: data._tokenId,
                chainId: data.chain,
              });
              toast.success(t('page.tokenDetail.actionsTips.unfold_success'));
            } else {
              preferenceService.manualFoldToken(address, {
                tokenId: data._tokenId,
                chainId: data.chain,
              });
              toast.success(t('page.tokenDetail.actionsTips.fold_success'));
            }
            refreshTags(address);
          },
        },
        {
          title: data._isPined
            ? t('page.tokenDetail.action.unpin')
            : t('page.tokenDetail.action.pin'),
          icon: data._isPined
            ? isDarkTheme
              ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_dark.png')
              : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_pin.png')
            : isDarkTheme
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_pin_dark.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_pin.png'),
          androidIconName: data._isPined
            ? 'ic_rabby_menu_un_pin'
            : 'ic_rabby_menu_pin',
          key: 'pin',
          action() {
            if (!address) {
              return;
            }
            if (data._isPined) {
              preferenceService.removePinedToken(address, {
                tokenId: data._tokenId,
                chainId: data.chain,
              });
              toast.success(t('page.tokenDetail.actionsTips.unpin_success'));
            } else {
              preferenceService.pinToken(address, {
                tokenId: data._tokenId,
                chainId: data.chain,
              });
              toast.success(t('page.tokenDetail.actionsTips.pin_success'));
            }
            refreshTags(address);
          },
        },
      ] as MenuAction[];
    }, [
      data._isFold,
      data._isPined,
      data._tokenId,
      data.chain,
      t,
      isDarkTheme,
      address,
      refreshTags,
    ]);
    if (data.id === SMALL_TOKEN_ID) {
      return (
        <View style={StyleSheet.flatten([styles.tokenRowWrap, style])}>
          <View style={styles.tokenRowTokenWrap}>
            <View style={styles.tokenRowTokenInner}>
              <TouchableOpacity
                onPress={onPressToken}
                style={styles.tokenRowTokenInnerSmallToken}>
                <Text style={styles.actionText}>
                  {fold
                    ? t('page.tokenDetail.action.all')
                    : t('page.tokenDetail.action.less')}
                </Text>
                {fold ? (
                  <RcUnFoldCC
                    style={styles.arrow}
                    color={colors2024['neutral-secondary']}
                  />
                ) : (
                  <RcFoldCC
                    style={styles.arrow}
                    color={colors2024['neutral-secondary']}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.tokenRowUsdValueWrap}>
            <Text style={styles.tokenRowUsdValue}>{data._usdValueStr}</Text>
          </View>
        </View>
      );
    }

    return (
      <ContextMenuView
        menuConfig={{
          menuActions: menuActions,
        }}
        preViewBorderRadius={12}
        triggerProps={{ action: 'longPress' }}>
        <TouchableOpacity
          style={StyleSheet.flatten([styles.tokenRowWrap, style])}
          delayLongPress={200}
          onLongPress={() => {
            trigger('impactLight', {
              enableVibrateFallback: true,
              ignoreAndroidSystemSettings: false,
            });
          }}
          onPress={onPressToken}>
          <View style={styles.tokenRowTokenWrap}>
            <AssetAvatar
              logo={data?.logo_url}
              chain={data?.chain}
              style={mediaStyle}
              size={logoSize}
              chainSize={16}
            />
            <View style={styles.tokenRowTokenInner}>
              <View style={styles.tokenHeader}>
                <Text
                  style={StyleSheet.flatten([styles.tokenSymbol])}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {data.symbol}
                </Text>
                {data._isPined && <PinBadge />}
              </View>

              {data._priceStr ? (
                <Text style={styles.amountStr} numberOfLines={1}>
                  {`${data._amountStr} ${data.symbol}`}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.tokenRowUsdValueWrap}>
            <Text
              style={[
                data._amountStr
                  ? styles.tokenRowAmount
                  : styles.tokenRowUsdValue,
                data._isExcludeBalance && styles.exclude,
              ]}>
              {data._usdValueStr}
            </Text>
            {data._isExcludeBalance && (data._usdValue || 0) > 0 ? (
              <TouchableOpacity
                hitSlop={hitSlop}
                onPress={handleShowExcludeTips}>
                <RcTipCC
                  style={styles.tips}
                  color={colors2024['neutral-info']}
                />
              </TouchableOpacity>
            ) : data._amountStr ? (
              <Text
                style={StyleSheet.compose(styles.percent, {
                  ...(data._isExcludeBalance ? styles.exclude : {}),
                  color: percentColor,
                })}>
                {formatPercentage(data.price_24h_change || 0)}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      </ContextMenuView>
    );
  },
);

export default TokenRow;

const getStyles = createGetStyles2024(ctx => ({
  tokenRowWrap: {
    height: ASSETS_ITEM_HEIGHT,
    width: '100%',
    paddingHorizontal: 20,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenRowTokenWrap: {
    flexShrink: 1,
    flexDirection: 'row',
    maxWidth: '70%',
  },
  tokenHeader: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
  },
  tokenSymbol: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    flex: 1,
    // ...makeDebugBorder(),
  },
  tokenRowLogo: {
    marginRight: 12,
  },
  smallTokenRowLogo: {
    marginRight: 12,
    width: 40,
    height: 40,
  },
  tokenRowTokenInner: {
    flexShrink: 1,
    justifyContent: 'center',
  },
  tokenRowTokenInnerSmallToken: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    height: 36,
    width: 120,
    justifyContent: 'center',
    borderRadius: 100,
    display: 'flex',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-body'],
  },
  amountStr: {
    marginTop: 2,
    color: ctx.colors2024['neutral-foot'],
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
  },
  tokenRowUsdValueWrap: {
    flexShrink: 0,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  tokenRowAmount: {
    marginBottom: 2,
    textAlign: 'right',
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  exclude: {
    color: ctx.colors2024['neutral-info'],
  },
  tokenRowUsdValue: {
    textAlign: 'right',
    color: ctx.colors2024['neutral-foot'],
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  tips: {
    width: 14,
    height: 14,
  },
  percent: {
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
  },
  smallTokenSymbol: {
    color: ctx.colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    width: 'auto',
  },
  arrow: {
    width: 10,
    height: 8,
  },
  modalNextButtonText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    color: ctx.colors2024['neutral-InvertHighlight'],
    backgroundColor: ctx.colors2024['brand-default'],
  },
}));
