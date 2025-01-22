import { Text } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import RcIconPinCC from '@/assets2024/icons/home/IconPinCC.svg';
import RcIconUnPinCC from '@/assets2024/icons/home/IconUnPinCC.svg';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';
import { preferenceService } from '@/core/services';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { useAtomValue } from 'jotai';
import { flatListRefAtom } from '@/screens/Home/hooks/store';
import { HEADER_TOP_AREA_HEIGHT } from '@/constant/layout';

interface Props {
  token: AbstractPortfolioToken;
  refreshTags: () => void;
}

export const HomePinBadge: React.FC<Props> = ({ token, refreshTags }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const flatListRef = useAtomValue(flatListRefAtom);
  const handlePress = useCallback(() => {
    const currentPin = token._isPined;
    token._isPined = !token._isPined;
    if (currentPin) {
      preferenceService.removePinedToken({
        tokenId: token._tokenId,
        chainId: token.chain,
      });
      // toast.success(t('page.tokenDetail.actionsTips.unfold_success'));
    } else {
      preferenceService.pinToken({
        tokenId: token._tokenId,
        chainId: token.chain,
      });
      flatListRef?.current?.scrollToOffset?.({
        animated: true,
        offset: HEADER_TOP_AREA_HEIGHT,
      });
      // toast.success(t('page.tokenDetail.actionsTips.fold_success'));
    }
    refreshTags();
  }, [flatListRef, refreshTags, token]);

  return token._isPined ? (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.pinBadgeAction, styles.unpinContainer]}>
      <RcIconUnPinCC color={colors2024['neutral-foot']} />
      <Text style={[styles.relateTitle, styles.unpinTitle]}>
        {t('page.tokenDetail.action.unpin')}
      </Text>
    </TouchableOpacity>
  ) : (
    <TouchableOpacity onPress={handlePress} style={styles.pinBadgeAction}>
      <RcIconPinCC color={colors2024['brand-default']} />
      <Text style={styles.relateTitle}>{t('page.tokenDetail.action.pin')}</Text>
    </TouchableOpacity>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  pinBadgeAction: {
    zIndex: 99,
    padding: 12,
    right: 20,
    gap: 4,
    top: 12,
    position: 'absolute',
    flexDirection: 'row',
    borderRadius: 100,
    borderColor: ctx.colors2024['brand-default'],
    borderWidth: 1,
  },

  unpinContainer: {
    borderWidth: 0.65,
    borderColor: ctx.colors2024['neutral-line'],
    borderRadius: 65,
    padding: 8,
  },

  relateTitle: {
    marginRight: 6,
    color: ctx.colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },

  unpinTitle: {
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
}));
