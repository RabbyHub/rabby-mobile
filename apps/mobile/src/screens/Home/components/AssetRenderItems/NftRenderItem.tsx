import React from 'react';
import FastImage from 'react-native-fast-image';
import { getCHAIN_ID_LIST } from '@/constant/chains';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import { IconDefaultNFT } from '@/assets/icons/nft';
import { Media } from '@/components/Media';
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
} from '@/constant/layout';
import { useTranslation } from 'react-i18next';
import { memo } from 'react';
import { TextBadge } from '@/screens/Address/components/PinBadge';
import {
  ContextMenuView,
  MenuAction,
} from '@/components2024/ContextMenuView/ContextMenuView';
import { IS_ANDROID } from '@/core/native/utils';
import { trigger } from 'react-native-haptic-feedback';
import { NftItemWithCollection } from '../../hooks/nft';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { DisplayNftItem } from '../../types';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { AccountOverview } from '../AccountOverview';

export const NftRow = memo(
  ({
    item,
    onPress,
    style,
    logoSize = 40,
    disableMenu,
    menuActions,
    hideFoldTag,
    account,
    chainLogoSize = 16,
  }: {
    item: NftItemWithCollection;
    filterText?: string;
    style?: ViewStyle;
    logoSize?: number;
    chainLogoSize?: number;
    hideFoldTag?: boolean;
    menuActions?: MenuAction[];
    disableMenu?: boolean;
    account?: KeyringAccountWithAlias;
    onPress: () => void;
  }) => {
    const { styles } = useTheme2024({ getStyle });
    const isCollection = 'nft_list' in item && !!item.nft_list.length;

    const chain = getCHAIN_ID_LIST().get(item.chain);
    const iconUri = chain?.logo;
    const isSvgURL = isCollection
      ? item.logo_url?.endsWith('.svg')
      : (item as NFTItem)?.content?.endsWith('.svg');
    const [showContextMenu, setShowContextMenu] = React.useState(IS_ANDROID);
    const _isManualFold = isCollection
      ? item.nft_list.every((i: DisplayNftItem) => i._isManualFold)
      : (item as DisplayNftItem)._isManualFold;

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
        style={[styles.wrpper, style]}>
        <View style={styles.main}>
          <View style={styles.avator}>
            <View
              style={StyleSheet.flatten([
                styles.imagesView,
                {
                  width: logoSize,
                  height: logoSize,
                },
              ])}>
              <Media
                failedPlaceholder={
                  <IconDefaultNFT width="100%" height="100%" />
                }
                type="image_url"
                src={
                  isSvgURL
                    ? ''
                    : isCollection
                    ? item.logo_url
                    : (item as NFTItem)?.thumbnail_url
                }
                thumbnail={
                  isSvgURL
                    ? ''
                    : isCollection
                    ? item.logo_url
                    : (item as NFTItem)?.thumbnail_url
                }
                mediaStyle={styles.images}
                style={styles.images}
                playIconSize={36}
              />
              {iconUri ? (
                <FastImage
                  source={{
                    uri: iconUri,
                  }}
                  style={[
                    styles.chainIcon,
                    {
                      width: chainLogoSize,
                      height: chainLogoSize,
                    },
                  ]}
                />
              ) : null}
            </View>
          </View>
          <View
            style={[
              styles.projectNameBox,
              _isManualFold && {
                marginRight: 55,
              },
            ]}>
            <View style={styles.nameBox}>
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.name}>
                {item.name}
              </Text>
              {!hideFoldTag && _isManualFold && <TextBadge type="folded" />}
            </View>
            {account ? <AccountOverview account={account} /> : null}
          </View>
        </View>
        <Text style={styles.amount}>
          {isCollection ? item.nft_list.length : (item as NFTItem).amount}
        </Text>
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

export const NftSectionHeader = ({
  onPress,
  fold,
}: {
  fold?: boolean;
  onPress: () => void;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  return (
    <View style={styles.headerWrapper}>
      <Text style={styles.symbol}>
        {t('page.singleHome.sectionHeader.Nft')}
      </Text>
      <TouchableOpacity onPress={onPress} style={styles.totalUsdWrapper}>
        <ArrowRightSVG
          style={[
            styles.arrow,
            {
              transform: fold ? [{ rotate: '90deg' }] : [{ rotate: '270deg' }],
            },
          ]}
          color={colors2024['neutral-title-1']}
        />
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  wrpper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 12,
    height: ASSETS_ITEM_HEIGHT_NEW,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 16,
  },
  main: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avator: {
    width: 40,
    height: 40,
    position: 'relative',
  },
  chainIcon: {
    width: 16,
    height: 16,
    borderRadius: 16,
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  projectNameBox: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 4,
  },
  nameBox: {
    flex: 0,
    flexDirection: 'row',
  },
  name: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    marginRight: 8,
    maxWidth: 200,
  },
  highlightText: {
    color: colors2024['brand-default'],
  },
  amount: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  headerWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    height: ASSETS_SECTION_HEADER,
    backgroundColor: colors2024['neutral-bg-gray'],
  },
  symbol: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  totalUsdWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  arrow: {},
  imagesView: {
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 0,
  },
  images: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
}));
