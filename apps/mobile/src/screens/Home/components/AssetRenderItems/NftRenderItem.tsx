import FastImage from 'react-native-fast-image';
import { getCHAIN_ID_LIST } from '@/constant/chains';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { IconDefaultNFT } from '@/assets/icons/nft';
import { Media } from '@/components/Media';
import { ASSETS_ITEM_HEIGHT_NEW } from '@/constant/layout';
import { memo } from 'react';
import { NftItemWithCollection } from '../../hooks/nft';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { AccountOverview } from '../AccountOverview';
import { Text } from '@/components/Typography';

export const NftRow = memo(
  ({
    item,
    onPress,
    style,
    logoSize = 40,
    account,
    chainLogoSize = 16,
  }: {
    item: NftItemWithCollection;
    filterText?: string;
    style?: ViewStyle;
    logoSize?: number;
    chainLogoSize?: number;
    account?: KeyringAccountWithAlias;
    onPress: () => void;
  }) => {
    const { styles } = useTheme2024({ getStyle });
    const isCollection = 'nft_list' in item && !!item.nft_list.length;

    const chain = getCHAIN_ID_LIST().get(item.chain);
    const iconUri = chain?.logo;
    const nftImageUrl = isCollection
      ? item.logo_url
      : (item as NFTItem)?.thumbnail_url;
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
                failedPlaceholder={
                  <IconDefaultNFT width="100%" height="100%" />
                }
                type="image_url"
                src={nftImageUrl}
                thumbnail={nftImageUrl}
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
          <View style={styles.projectNameBox}>
            <View style={styles.nameBox}>
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.name}>
                {item.name}
              </Text>
            </View>
            {account ? <AccountOverview account={account} /> : null}
          </View>
        </View>
        <Text style={styles.amount}>
          {isCollection ? item.nft_list.length : (item as NFTItem).amount}
        </Text>
      </TouchableOpacity>
    );
  },
);

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
  amount: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
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
