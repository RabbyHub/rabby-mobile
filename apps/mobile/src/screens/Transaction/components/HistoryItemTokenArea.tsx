/* eslint-disable react-native/no-inline-styles */
import React, { useMemo } from 'react';
import RcIconSwitch from '@/assets2024/icons/history/IconSwitch.svg';
import RcIconYes from '@/assets2024/icons/history/IconTxYes.svg';
import RcIconNo from '@/assets2024/icons/history/IconTxNo.svg';
import { View, ViewStyle } from 'react-native';
import { AssetAvatar } from '@/components';
import { Media } from '@/components/Media';
import { IconDefaultNFT } from '@/assets/icons/nft';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { HistoryItemCateType } from './type';
import { TokenChangeDataItem } from './HistoryItem';

interface ItemIconProps {
  type?: HistoryItemCateType | undefined;
  tokenChangeData: TokenChangeDataItem[];
  tokenApproveData: TokenChangeDataItem[];
}

const LEN_ENUM = {
  ZERO: 0,
  ONE: 1,
  TWO: 2,
  THREE: 3,
};

const Avatar = ({
  item,
  size,
  logoStyle = {},
}: {
  item: TokenChangeDataItem;
  size: number;
  logoStyle?: ViewStyle;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const isNft = item?.token_id?.length === 32;
  return (
    <>
      {isNft ? (
        <Media
          failedPlaceholder={<IconDefaultNFT width={size} height={size} />}
          type="image_url"
          src={item?.token.content?.endsWith('.svg') ? '' : item?.token.content}
          thumbnail={
            item?.token.content?.endsWith('.svg') ? '' : item?.token.content
          }
          mediaStyle={{
            width: size,
            height: size,
          }}
          style={{
            ...styles.media,
            width: size,
            height: size,
            ...logoStyle,
          }}
          // playIconSize={14}
        />
      ) : (
        <AssetAvatar
          logo={item?.token.logo_url}
          size={size}
          logoStyle={logoStyle}
        />
      )}
    </>
  );
};

export const HistoryItemTokenArea = ({
  type,
  tokenChangeData,
  tokenApproveData,
}: ItemIconProps) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  tokenChangeData.forEach(item => {
    if (item.token.content_type) {
      console.log(item);
    }
  });

  const len = useMemo(() => tokenChangeData.length, [tokenChangeData]);
  if (len === 0 && tokenApproveData.length) {
    // just for approve
    return <Avatar item={tokenApproveData[0]} size={46} />;
  }

  switch (len) {
    case LEN_ENUM.ONE:
      return (
        <View style={[styles.imageBox]}>
          <Avatar item={tokenChangeData[0]} size={46} />
        </View>
      );
    case LEN_ENUM.TWO:
      const receives = tokenChangeData.filter(item => item.type === 'receive');
      const sends = tokenChangeData.filter(item => item.type === 'send');
      const isSwap = receives.length === 1 && sends.length === 1;
      return !isSwap ? (
        <View style={[styles.imageBox]}>
          <View style={[styles.oneTokenBox]}>
            <Avatar item={tokenChangeData[0]} size={30} />
          </View>
          <View style={[styles.twoTokenBox]}>
            <Avatar
              item={tokenChangeData[1]}
              size={34}
              logoStyle={styles.swapLogo}
            />
          </View>
        </View>
      ) : (
        <View style={[styles.imageBox]}>
          <View style={[styles.fromTokenBox]}>
            <Avatar item={sends[0]} size={30} />
          </View>
          <View style={[styles.toTokenBox]}>
            <Avatar item={receives[0]} size={32} logoStyle={styles.swapLogo} />
          </View>
          <RcIconSwitch style={[styles.iconTR]} />
        </View>
      );
    case LEN_ENUM.THREE:
      return (
        <View style={[styles.imageBox]}>
          <View style={{ left: 2, top: 12, position: 'absolute' }}>
            <AssetAvatar
              logo={tokenChangeData?.[0]?.token?.logo_url}
              size={22}
            />
          </View>
          <View style={{ left: 12, top: 10, position: 'absolute' }}>
            <AssetAvatar
              logo={tokenChangeData?.[1]?.token?.logo_url}
              size={26}
              logoStyle={styles.swapLogo}
            />
          </View>
          <View style={{ left: 22, top: 10, position: 'absolute' }}>
            <AssetAvatar
              logo={tokenChangeData?.[2]?.token?.logo_url}
              size={26}
              logoStyle={styles.swapLogo}
            />
          </View>
        </View>
      );

    case LEN_ENUM.ZERO:
    default:
      if (type === HistoryItemCateType.Cancel) {
        return <RcIconNo style={[styles.image]} />;
      } else {
        return <RcIconYes style={[styles.image]} />;
      }
  }
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  image: {
    width: 46,
    height: 46,
  },
  swapLogo: {
    borderWidth: 2,
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  mediaInDetail: {
    width: 58,
    height: 58,
    borderRadius: 8,
  },
  media: {
    borderRadius: 8,
  },
  fromTokenBox: {
    position: 'absolute',
    left: 2,
    top: 2,
  },
  toTokenBox: {
    position: 'absolute',
    zIndex: 1,
    left: 12,
    top: 12,
  },
  oneTokenBox: {
    position: 'absolute',
    left: 2,
    top: 7,
  },
  twoTokenBox: {
    position: 'absolute',
    left: 14,
    top: 5,
  },
  threeTokenBox: {
    position: 'absolute',
    // left: 2,
    // top: 10,
  },
  imageBoxInDetail: {
    width: 58,
    height: 58,
  },
  imageBoxListToken: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  imageBox: {
    overflow: 'hidden',
    width: 46,
    height: 46,
    position: 'relative',
  },
  iconTR: {
    position: 'absolute',
    right: 2,
    top: 2,
  },
  iconBR: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
  },
}));
