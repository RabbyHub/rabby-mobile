import { IconDefaultNFT } from '@/assets/icons/nft';
import { Text } from '@/components';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { MEDIA_TYPE, Media } from '@/components/Media';
import { useTheme2024 } from '@/hooks/theme';
import { abbreviateNumber } from '@/utils/math';
import React, { useMemo } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { createGetStyles2024 } from '@/utils/styles';

type ItemProps = {
  item: NFTItem;
  onPress: () => void;
};
const width = Dimensions.get('window').width;

const detailWidth = (width - 88) / 3;

export const Item = ({ item, onPress }: ItemProps) => {
  const { styles } = useTheme2024({ getStyle });

  const numberDisplay = useMemo(() => {
    let v = abbreviateNumber(item.amount || 0);
    if (v?.endsWith('T')) {
      let tmp = v.slice(0, -1);
      if (Number(tmp) > 999) {
        v += '+';
      }
    }
    return v;
  }, [item.amount]);

  const isSvgURL = item?.content?.endsWith('.svg');

  return (
    <CustomTouchableOpacity
      style={StyleSheet.flatten([
        styles.imagesView,
        {
          width: detailWidth,
          height: detailWidth,
        },
      ])}
      onPress={onPress}>
      <Media
        failedPlaceholder={<IconDefaultNFT width="100%" height="100%" />}
        type="image_url"
        src={isSvgURL ? '' : item?.content}
        thumbnail={isSvgURL ? '' : item?.content}
        mediaStyle={styles.images}
        style={styles.images}
        playIconSize={36}
      />
      {item?.amount > 1 ? (
        <View style={styles.corner}>
          <Text style={styles.cornerNumber}>{numberDisplay}</Text>
        </View>
      ) : null}
    </CustomTouchableOpacity>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  tipContainer: {
    position: 'relative',
    marginVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingBottom: 90,
  },
  list: {
    width: '100%',
    paddingHorizontal: 20,
  },
  imagesView: {
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    // margin: 5,
    // ...makeDebugBorder('blue'),
  },
  images: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  corner: {
    backgroundColor: colors2024['neutral-black'],
    position: 'absolute',
    right: 4,
    top: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    alignItems: 'center',
    opacity: 0.8,
  },
  cornerNumber: {
    color: colors2024['neutral-title-2'],
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 14,
  },
  loadingWrap: {
    width: '100%',
    height: '100%',
  },
}));
