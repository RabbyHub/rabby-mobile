import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';

import { AbstractProject } from '../../types';
import { useTheme2024 } from '@/hooks/theme';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components';
import { createGetStyles2024 } from '@/utils/styles';
import { ASSETS_ITEM_HEIGHT } from '@/constant/layout';
import RcTipCC from '@/assets2024/icons/common/tips.svg';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { useTranslation } from 'react-i18next';
import { HighlightText } from '@/components2024/HighlightText';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export const DefiRow = ({
  data,
  filterText,
  style,
  logoSize = 40,
  chainLogoSize = 16,
  onPress,
}: {
  data: AbstractProject;
  style?: ViewStyle;
  logoSize?: number;
  chainLogoSize?: number;
  filterText?: string;
  onPress?: () => void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

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

  return (
    <TouchableOpacity onPress={onPress} style={[styles.projectHeader, style]}>
      <View style={styles.projectHeaderName}>
        <AssetAvatar
          logo={data?.logo}
          size={logoSize}
          chain={data?.chain}
          chainSize={chainLogoSize}
        />
        <HighlightText
          style={styles.projectName}
          highlightStyle={styles.highlightText}
          numberOfLines={1}
          ellipsizeMode="tail"
          searchWords={[filterText || '']}
          textToHighlight={data?.name}
        />
      </View>
      <View style={styles.projectHeaderUsd}>
        <Text
          style={[
            styles.projectHeaderNetWorth,
            data._isExcludeBalance && styles.exclude,
          ]}>
          {data._netWorth}
        </Text>
        {data._isExcludeBalance && data._netWorth && (
          <TouchableOpacity hitSlop={hitSlop} onPress={handleShowExcludeTips}>
            <RcTipCC style={styles.tips} color={colors2024['neutral-info']} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};
const getStyles = createGetStyles2024(ctx => ({
  projectHeader: {
    paddingHorizontal: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: ASSETS_ITEM_HEIGHT,
    alignItems: 'center',
  },
  projectHeaderName: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectName: {
    marginLeft: 8,
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  highlightText: {
    color: ctx.colors2024['brand-default'],
  },
  projectHeaderUsd: {
    justifyContent: 'center',
    flexShrink: 1,
    alignItems: 'flex-end',
    height: 68,
    gap: 4,
  },
  projectHeaderNetWorth: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
  },
  exclude: {
    color: ctx.colors2024['neutral-info'],
  },
  tips: {
    width: 14,
    height: 14,
  },
  headerWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    height: ASSETS_ITEM_HEIGHT,
  },
  symbol: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-title-1'],
  },
  totalUsdWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  arrow: {},
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
