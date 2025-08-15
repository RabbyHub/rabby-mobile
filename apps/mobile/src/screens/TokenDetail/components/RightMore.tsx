import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { preferenceService } from '@/core/services';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { RcIconMore } from '@/assets/icons/home';
import { DropDownMenuView, MenuAction } from '@/components2024/DropDownMenu';
import { toast } from '@/components2024/Toast';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { useUserTokenSettings } from '@/hooks/useTokenSettings';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};
export const RightMore: React.FC<{
  token: AbstractPortfolioToken;
  isMultiAddress?: boolean;
  triggerUpdate: () => void;
  refreshTags: () => void;
  unHold?: boolean;
}> = ({ token, triggerUpdate, refreshTags, unHold }) => {
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const { t } = useTranslation();
  const { colors2024 } = useTheme2024();

  const menuActions = React.useMemo(() => {
    return [
      {
        title: token._isFold
          ? t('page.tokenDetail.action.unfold')
          : t('page.tokenDetail.action.fold'),
        icon: token._isFold
          ? isDarkTheme
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold_dark.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold.png')
          : isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold.png'),
        androidIconName: token._isFold
          ? 'ic_rabby_menu_unfold'
          : 'ic_rabby_menu_fold',
        key: 'fold',
        action() {
          if (token._isFold) {
            preferenceService.manualUnFoldToken({
              tokenId: token._tokenId,
              chainId: token.chain,
            });
            toast.success(t('page.tokenDetail.actionsTips.unfold_success'));
          } else {
            preferenceService.manualFoldToken({
              tokenId: token._tokenId,
              chainId: token.chain,
            });
            toast.success(t('page.tokenDetail.actionsTips.fold_success'));
          }
          token._isFold = !token._isFold;
          refreshTags();
        },
      },
      {
        title: token._isExcludeBalance
          ? t('page.tokenDetail.action.includeBalance')
          : t('page.tokenDetail.action.excludeBalance'),
        icon: token._isExcludeBalance
          ? isDarkTheme
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_include_balance_dark.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_include_balance.png')
          : isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_exclude_balance_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_exclude_balance.png'),
        key: 'balance',
        androidIconName: token._isExcludeBalance
          ? 'ic_rabby_menu_include_balance'
          : 'ic_rabby_menu_exclude_balance',
        action() {
          if (token._isExcludeBalance) {
            preferenceService.includeBalanceToken({
              id: token._tokenId,
              chainid: token.chain,
              type: 'token',
            });
            toast.success(
              t('page.tokenDetail.actionsTips.includeBalance_success'),
            );
          } else {
            preferenceService.excludeBalance({
              id: token._tokenId,
              chainid: token.chain,
              type: 'token',
            });
            toast.success(
              t('page.tokenDetail.actionsTips.excludeBalance_success'),
            );
          }
          token._isExcludeBalance = !token._isExcludeBalance;
          refreshTags();
          triggerUpdate();
        },
      },
    ] as MenuAction[];
  }, [token, t, isDarkTheme, refreshTags, triggerUpdate]);

  const {
    removePinedToken,
    pinToken,
    userTokenSettings,
    fetchUserTokenSettings,
  } = useUserTokenSettings();

  useEffect(() => {
    fetchUserTokenSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPined = useMemo(
    () =>
      userTokenSettings?.pinedQueue?.some(
        pinned =>
          pinned.chainId === token.chain && pinned.tokenId === token._tokenId,
      ),
    [token._tokenId, token.chain, userTokenSettings?.pinedQueue],
  );

  const handlePress = useCallback(() => {
    if (isPined) {
      removePinedToken({
        id: token._tokenId,
        chain: token.chain,
      });
    } else {
      pinToken({
        id: token._tokenId,
        chain: token.chain,
      });
    }
    setTimeout(() => {
      refreshTags();
    }, 0);
  }, [
    isPined,
    pinToken,
    refreshTags,
    removePinedToken,
    token._tokenId,
    token.chain,
  ]);

  return (
    <>
      <TouchableOpacity style={{ marginRight: 18 }} onPress={handlePress}>
        <RcIconFavorite
          width={22}
          height={21}
          color={
            isPined ? colors2024['orange-default'] : colors2024['neutral-info']
          }
        />
      </TouchableOpacity>
      {!unHold && (
        <DropDownMenuView
          menuConfig={{
            menuActions: menuActions,
          }}
          triggerProps={{ action: 'press' }}>
          <CustomTouchableOpacity hitSlop={hitSlop}>
            <RcIconMore width={24} height={24} />
          </CustomTouchableOpacity>
        </DropDownMenuView>
      )}
    </>
  );
};
