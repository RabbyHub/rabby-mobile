import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import FastImage from 'react-native-fast-image';
import type { NFTItem } from '@rabby-wallet/rabby-api/dist/types';

import { Text } from '@/components';
import { Media } from '@/components/Media';
import { IconDefaultNFT } from '@/assets/icons/nft';
import { getCHAIN_ID_LIST } from '@/constant/projectLists';
import { HeaderBackPressable } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { useCustomHeaderTop } from '@/hooks/useAppLayout';
import { useSystemColumnInset } from '@/components/SafeWindowFrame/backdrop';
import { ellipsisOverflowedText } from '@/utils/text';
import { createGetStyles2024 } from '@/utils/styles';

/**
 * Header row for the NFT detail route.
 *
 * It owns the whole row (back button + avatar + chain badge + name), so it is
 * registered as a `header:` renderer instead of `headerTitle`. That keeps the
 * back chevron at the content edge on every device, including the Duo outer
 * screen where the JS replica header gives the row the full content width.
 */
export const NftDetailHeader = ({ token }: { token?: NFTItem }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const headerTop = useCustomHeaderTop();
  const columnInset = useSystemColumnInset();
  const chain = getCHAIN_ID_LIST().get((token as any)?.chain);
  const iconUri = chain?.logo;

  return (
    <View
      style={{
        paddingTop: headerTop,
        paddingLeft: 16 + columnInset.left,
        paddingRight: 16 + columnInset.right,
      }}>
      <View style={styles.headerArea}>
        <HeaderBackPressable
          style={styles.headerBack}
          tintColor={colors2024['neutral-title-1']}
        />
        <View style={styles.avator}>
          <View style={styles.imagesView}>
            <Media
              failedPlaceholder={<IconDefaultNFT width="100%" height="100%" />}
              type="image_url"
              src={token?.thumbnail_url}
              thumbnail={token?.thumbnail_url}
              mediaStyle={styles.imagesAvatar}
              style={styles.imagesAvatar}
              playIconSize={36}
            />
          </View>
          {iconUri ? (
            <FastImage
              source={{
                uri: iconUri,
              }}
              style={styles.chainIcon}
            />
          ) : null}
        </View>
        <Text style={styles.tokenSymbol} numberOfLines={1} ellipsizeMode="tail">
          {ellipsisOverflowedText(token?.name || t('global.unknownNFT'), 20)}
        </Text>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headerArea: {
    width: '100%',
    minHeight: 44,
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  headerBack: {
    marginLeft: 0,
    paddingLeft: 0,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avator: {
    width: 44,
    height: 44,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagesView: {
    width: 40,
    height: 40,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  imagesAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  chainIcon: {
    width: 16,
    height: 16,
    borderRadius: 16,
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  tokenSymbol: {
    flexShrink: 1,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    flexWrap: 'nowrap',
  },
}));
