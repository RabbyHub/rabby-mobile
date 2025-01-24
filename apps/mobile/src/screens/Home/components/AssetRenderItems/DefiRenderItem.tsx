import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';

import { AbstractProject } from '../../types';
import { useTheme2024 } from '@/hooks/theme';
import { AssetAvatar } from '@/components/AssetAvatar';
import { Text } from '@/components';
import { createGetStyles2024 } from '@/utils/styles';
import { ASSETS_ITEM_HEIGHT_NEW } from '@/constant/layout';
import RcTipCC from '@/assets2024/icons/common/tips.svg';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { useTranslation } from 'react-i18next';
import { HighlightText } from '@/components2024/HighlightText';
import { TextBadge } from '@/screens/Address/components/PinBadge';
import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { IS_ANDROID } from '@/core/native/utils';
import { trigger } from 'react-native-haptic-feedback';
import { CombineDefiItem } from '../../hooks/store';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export const DefiRow = memo(
  ({
    data,
    filterText,
    style,
    logoSize = 40,
    chainLogoSize = 16,
    menuActions,
    hideFoldTag,
    disableMenu,
    onPress,
  }: {
    data: CombineDefiItem;
    style?: ViewStyle;
    logoSize?: number;
    chainLogoSize?: number;
    filterText?: string;
    menuActions?: MenuAction[];
    disableMenu?: boolean;
    hideFoldTag?: boolean;
    onPress?: () => void;
  }) => {
    const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
    const [showContextMenu, setShowContextMenu] = React.useState(IS_ANDROID);

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

    const children = (
      <TouchableOpacity
        onPress={onPress}
        delayLongPress={200}
        onLongPress={() => {
          if (disableMenu) {
            return;
          }
          setShowContextMenu(true);
          trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
        }}
        style={[styles.projectHeader, style]}>
        <View style={styles.projectHeaderName}>
          <AssetAvatar
            logo={data?.logo}
            size={logoSize}
            chain={data?.chain}
            chainSize={chainLogoSize}
          />
          <View
            style={[
              styles.projectNameBox,
              data._isManualFold && {
                marginRight: 55,
              },
            ]}>
            <HighlightText
              style={styles.projectName}
              highlightStyle={styles.highlightText}
              numberOfLines={1}
              ellipsizeMode="tail"
              searchWords={[filterText || '']}
              textToHighlight={data?.name}
            />
            {!hideFoldTag && data._isManualFold && <TextBadge type="folded" />}
          </View>
        </View>
        <View style={styles.projectHeaderUsd}>
          {data.filterTokenDesc ? (
            <HighlightText
              style={styles.projectHeaderNetWorth}
              highlightStyle={styles.highlightText}
              numberOfLines={1}
              ellipsizeMode="tail"
              searchWords={[filterText || '']}
              textToHighlight={data?.filterTokenDesc}
            />
          ) : (
            <Text
              style={[
                styles.projectHeaderNetWorth,
                data._isExcludeBalance && styles.exclude,
              ]}>
              {data._netWorth}
            </Text>
          )}
          {data._isExcludeBalance && data._netWorth && (
            <TouchableOpacity hitSlop={hitSlop} onPress={handleShowExcludeTips}>
              <RcTipCC style={styles.tips} color={colors2024['neutral-info']} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );

    if (disableMenu) {
      return children;
    }

    return (
      <ContextMenuView
        menuConfig={{
          menuActions: showContextMenu && menuActions ? menuActions : [],
        }}
        preViewBorderRadius={12}
        triggerProps={{ action: 'longPress' }}>
        {children}
      </ContextMenuView>
    );
  },
);
const getStyles = createGetStyles2024(ctx => ({
  projectHeader: {
    paddingHorizontal: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: ASSETS_ITEM_HEIGHT_NEW,
    alignItems: 'center',
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 16,
  },
  projectHeaderName: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  projectName: {
    marginLeft: 8,
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    marginRight: 8,
  },
  projectNameBox: {
    flex: 1,
    flexDirection: 'row',
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
