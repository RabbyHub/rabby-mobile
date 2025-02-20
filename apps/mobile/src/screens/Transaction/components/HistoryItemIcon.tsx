import React, { useMemo } from 'react';
import RcIconSend from '@/assets2024/icons/history/IconSend.svg';
import RcIconSwitch from '@/assets2024/icons/history/IconSwitch.svg';
// import RcIconContract from '@/assets/icons/history/contract.svg';
import RcIconApproval from '@/assets2024/icons/history/IconApprove.svg';
import RcIconReceive from '@/assets2024/icons/history/IconReceive.svg';
import RcIconRevoke from '@/assets2024/icons/history/IconRevoke.svg';
import RcIconContract from '@/assets2024/icons/history/IconContract.svg';
import RcIconDefault from '@/assets2024/icons/history/IconDefault.svg';
import RcIconCancel from '@/assets2024/icons/history/IconCancel.svg';
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

export enum HistoryItemCateType {
  Send = 'send',
  Approve = 'approve',
  Recieve = 'receive',
  Revoke = 'revoke',
  Bridge = 'bridge',
  Swap = 'swap',
  Contract = 'contract',
  UnKnown = 'interaction',
  Cancel = 'cancel',
  Buy = 'buy',
}

interface ItemIconProps {
  className?: string;
  type?: HistoryItemCateType | undefined;
  token?: TokenItem | TokenItem[];
  isNft?: boolean;
  style?: StyleProp<ImageStyle>;
  isInDetail?: boolean;
}

export const HistoryItemIcon = ({
  style,
  type,
  token,
  isNft,
  isInDetail,
}: ItemIconProps) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const RcSingleTokenBrIcon = useMemo(() => {
    const size = isInDetail ? 24 : 20;
    const IconApprove = (
      <RcIconApproval
        width={size}
        height={size}
        color={
          !isLight ? colors2024['neutral-bg-2'] : colors2024['neutral-bg-1']
        }
        style={[styles.iconBR]}
      />
    );
    const IconSend = (
      <RcIconSend
        width={size}
        height={size}
        style={[styles.iconBR]}
        color={
          !isLight ? colors2024['neutral-bg-2'] : colors2024['neutral-bg-1']
        }
      />
    );
    const IconRecieve = (
      <RcIconReceive
        style={[styles.iconBR]}
        width={size}
        height={size}
        color={
          !isLight ? colors2024['neutral-bg-2'] : colors2024['neutral-bg-1']
        }
      />
    );
    const IconRevoke = (
      <RcIconRevoke
        width={size}
        height={size}
        style={[styles.iconBR]}
        color={
          !isLight ? colors2024['neutral-bg-2'] : colors2024['neutral-bg-1']
        }
      />
    );

    return {
      [HistoryItemCateType.Approve]: IconApprove,
      [HistoryItemCateType.Send]: IconSend,
      [HistoryItemCateType.Recieve]: IconRecieve,
      [HistoryItemCateType.Revoke]: IconRevoke,
    };
  }, [isInDetail, colors2024, styles, isLight]);

  // if (iconUri) {
  switch (type) {
    case HistoryItemCateType.Send:
    case HistoryItemCateType.Approve:
    case HistoryItemCateType.Revoke:
    case HistoryItemCateType.Recieve:
      const singeToken = token as TokenItem;
      const singleSize = isInDetail ? 58 : 46;
      return (
        <View style={[styles.imageBox, isInDetail && styles.imageBoxInDetail]}>
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
              mediaStyle={isInDetail ? styles.mediaInDetail : styles.media}
              style={isInDetail ? styles.mediaInDetail : styles.media}
              playIconSize={14}
            />
          ) : (
            <AssetAvatar logo={singeToken?.logo_url} size={singleSize} />
          )}
          {RcSingleTokenBrIcon[type]}
        </View>
      );

    case HistoryItemCateType.Bridge:
    case HistoryItemCateType.Swap:
      const doubleToken = token as TokenItem[];
      return (
        <View style={[styles.imageBox]}>
          <View style={[styles.fromTokenBox]}>
            <AssetAvatar logo={doubleToken?.[0]?.logo_url} size={30} />
            {/* <FastImage
                style={tokenFromStyle}
                source={{
                  uri: iconUri[0] as string,
                }}
              /> */}
          </View>
          <View style={[styles.toTokenBox]}>
            <AssetAvatar logo={doubleToken?.[1]?.logo_url} size={32} />
            {/* <FastImage
                style={tokenToStyle}
                source={{
                  uri: iconUri[1] as string,
                }}
              /> */}
          </View>
          <RcIconSwitch style={[styles.iconTR]} />
        </View>
      );
    case HistoryItemCateType.Contract:
      return <RcIconContract style={[styles.image, style]} />;
    case HistoryItemCateType.Cancel:
      return <RcIconCancel style={[styles.image, style]} />;
    default:
      return <RcIconDefault style={[styles.image, style]} />;
  }
  // return <RcIconDefault style={[styles.image, style]} />;
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  image: {
    width: 46,
    height: 46,
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
  imageBoxInDetail: {
    width: 58,
    height: 58,
  },
  imageBox: {
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
