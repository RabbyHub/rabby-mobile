/* eslint-disable react-native/no-inline-styles */
import React, { useMemo } from 'react';
import RcIconSend from '@/assets2024/icons/history/IconSend.svg';
import RcIconSendDark from '@/assets2024/icons/history/IconSendDark.svg';
import RcIconSwitch from '@/assets2024/icons/history/IconSwitch.svg';
// import RcIconContract from '@/assets/icons/history/contract.svg';
import RcIconDefault from '@/assets2024/icons/history/IconDefault.svg';
import RcIconYes from '@/assets2024/icons/history/IconTxYes.svg';
import RcIconNo from '@/assets2024/icons/history/IconTxNo.svg';
import RcIconCancel from '@/assets2024/icons/history/IconCancel.svg';
import RcIconCancelDark from '@/assets2024/icons/history/IconCancelDark.svg';
import FastImage from 'react-native-fast-image';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  ViewStyle,
  View,
} from 'react-native';
import { AssetAvatar } from '@/components';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
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

export const HistoryItemTokenArea = ({
  type,
  tokenChangeData,
  tokenApproveData,
}: ItemIconProps) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  // if (iconUri) {

  const len = useMemo(() => tokenChangeData.length, [tokenChangeData]);
  if (tokenApproveData.length) {
    // just for approve
    const singeToken = tokenApproveData[0].token;
    const singleSize = 46;
    const isNft = tokenApproveData[0]?.token_id?.length === 32;
    return (
      <View style={[styles.imageBox]}>
        {isNft ? (
          <Media
            failedPlaceholder={
              <IconDefaultNFT width={singleSize} height={singleSize} />
            }
            type="image_url"
            src={
              singeToken?.content?.endsWith('.svg') ? '' : singeToken?.content
            }
            thumbnail={
              singeToken?.content?.endsWith('.svg') ? '' : singeToken?.content
            }
            mediaStyle={styles.media}
            style={styles.media}
            // playIconSize={14}
          />
        ) : (
          <AssetAvatar logo={singeToken?.logo_url} size={singleSize} />
        )}
      </View>
    );
  }

  switch (len) {
    case LEN_ENUM.ONE:
      const singeToken = tokenChangeData[0].token;
      const singleSize = 46;
      const isNft = tokenChangeData[0]?.token_id?.length === 32;
      return (
        <View style={[styles.imageBox]}>
          {isNft ? (
            <Media
              failedPlaceholder={
                <IconDefaultNFT width={singleSize} height={singleSize} />
              }
              type="image_url"
              src={
                singeToken?.content?.endsWith('.svg') ? '' : singeToken?.content
              }
              thumbnail={
                singeToken?.content?.endsWith('.svg') ? '' : singeToken?.content
              }
              mediaStyle={styles.media}
              style={styles.media}
              // playIconSize={14}
            />
          ) : (
            <AssetAvatar logo={singeToken?.logo_url} size={singleSize} />
          )}
        </View>
      );
    case LEN_ENUM.TWO:
      const receives = tokenChangeData.filter(item => item.type === 'receive');
      const sends = tokenChangeData.filter(item => item.type === 'send');
      const isSwap = receives.length === 1 && sends.length === 1;
      return !isSwap ? (
        <View style={[styles.imageBox]}>
          <View style={[styles.oneTokenBox]}>
            <AssetAvatar
              logo={tokenChangeData?.[0]?.token?.logo_url}
              size={30}
            />
          </View>
          <View style={[styles.twoTokenBox]}>
            <AssetAvatar
              logo={tokenChangeData?.[1]?.token?.logo_url}
              size={34}
              logoStyle={styles.swapLogo}
            />
          </View>
        </View>
      ) : (
        <View style={[styles.imageBox]}>
          <View style={[styles.fromTokenBox]}>
            <AssetAvatar logo={sends?.[0]?.token?.logo_url} size={30} />
          </View>
          <View style={[styles.toTokenBox]}>
            <AssetAvatar
              logo={receives?.[0]?.token?.logo_url}
              size={32}
              logoStyle={styles.swapLogo}
            />
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

  // switch (type) {
  //   case HistoryItemCateType.Send:
  //   case HistoryItemCateType.Approve:
  //   case HistoryItemCateType.Revoke:
  //   case HistoryItemCateType.Recieve:
  //     const singeToken = token as TokenItem;
  //     const singleSize = isInDetail ? 58 : 46;
  //     return (
  //       <View style={[styles.imageBox, isInDetail && styles.imageBoxInDetail]}>
  //         {isNft ? (
  //           <Media
  //             failedPlaceholder={
  //               <IconDefaultNFT width={singleSize} height={singleSize} />
  //             }
  //             type="image_url"
  //             src={
  //               singeToken?.content?.endsWith('.svg') ? '' : singeToken?.content
  //             }
  //             thumbnail={
  //               singeToken?.content?.endsWith('.svg') ? '' : singeToken?.content
  //             }
  //             mediaStyle={isInDetail ? styles.mediaInDetail : styles.media}
  //             style={isInDetail ? styles.mediaInDetail : styles.media}
  //             playIconSize={14}
  //           />
  //         ) : (
  //           <AssetAvatar logo={singeToken?.logo_url} size={singleSize} />
  //         )}
  //         {RcSingleTokenBrIcon[type]}
  //       </View>
  //     );

  //   case HistoryItemCateType.Bridge:
  //   case HistoryItemCateType.Swap:
  //     const doubleToken = token as TokenItem[];
  //     return (
  //       <View style={[styles.imageBox]}>
  //         <View style={[styles.fromTokenBox]}>
  //           <AssetAvatar logo={doubleToken?.[0]?.logo_url} size={30} />
  //         </View>
  //         <View style={[styles.toTokenBox]}>
  //           <AssetAvatar
  //             logo={doubleToken?.[1]?.logo_url}
  //             size={32}
  //             logoStyle={styles.swapLogo}
  //           />
  //         </View>
  //         <RcIconSwitch style={[styles.iconTR]} />
  //       </View>
  //     );
  //   case HistoryItemCateType.Contract:
  //     return <RcIconContract style={[styles.image, style]} />;
  //   case HistoryItemCateType.Cancel:
  //     return isLight ? (
  //       <RcIconCancel style={[styles.image, style]} />
  //     ) : (
  //       <RcIconCancelDark style={[styles.image, style]} />
  //     );
  // default:
  //   return <RcIconDefault style={[styles.image, style]} />;
  // return <RcIconDefault style={[styles.image, style]} />;
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
    width: 46,
    height: 46,
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
