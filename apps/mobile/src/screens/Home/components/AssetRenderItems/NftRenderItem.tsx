import FastImage from 'react-native-fast-image';
import { getCHAIN_ID_LIST } from '@/constant/chains';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import { IconDefaultNFT } from '@/assets/icons/nft';
import { Media } from '@/components/Media';
import { ASSETS_ITEM_HEIGHT } from '@/constant/layout';
import { useTranslation } from 'react-i18next';
import { HighlightText } from '@/components2024/HighlightText';

export const NftRow = ({
  item,
  onPress,
  filterText,
  style,
  logoSize = 40,
  chainLogoSize = 16,
}: {
  item: NFTItem;
  filterText?: string;
  style?: ViewStyle;
  logoSize?: number;
  chainLogoSize?: number;
  onPress: () => void;
}) => {
  const { styles } = useTheme2024({ getStyle });

  const chain = getCHAIN_ID_LIST().get(item.chain);
  const iconUri = chain?.logo;
  const isSvgURL = item?.content?.endsWith('.svg');

  return (
    <TouchableOpacity onPress={onPress} style={[styles.wrpper, style]}>
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
              failedPlaceholder={<IconDefaultNFT width="100%" height="100%" />}
              type="image_url"
              src={isSvgURL ? '' : item?.thumbnail_url}
              thumbnail={isSvgURL ? '' : item?.thumbnail_url}
              mediaStyle={styles.images}
              style={styles.images}
              playIconSize={36}
            />
          </View>
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
        <HighlightText
          style={styles.name}
          highlightStyle={styles.highlightText}
          numberOfLines={1}
          ellipsizeMode="tail"
          searchWords={[filterText || '']}
          textToHighlight={item.name}
        />
      </View>
      <Text style={styles.amount}>{item.amount}</Text>
    </TouchableOpacity>
  );
};

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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  wrpper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 12,
    height: ASSETS_ITEM_HEIGHT,
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
    borderColor: 'red',
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
  name: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    flex: 1,
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
    height: 74,
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
