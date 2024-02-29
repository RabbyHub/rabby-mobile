import RcIconStarFull from '@/assets/icons/dapp/icon-star-full.svg';
import RcIconStar from '@/assets/icons/dapp/icon-star.svg';
import RcIconTriangle from '@/assets/icons/dapp/icon-triangle.svg';
import { useThemeColors } from '@/hooks/theme';
import { DappInfo } from '@/core/services/dappService';
import React, { useState } from 'react';
import {
  Image,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { DappIcon } from './DappIcon';
import { stringUtils } from '@rabby-wallet/base-utils';
import { CHAINS } from '@/constant/chains';
import RcIconDisconnect from '@/assets/icons/dapp/icon-disconnect-circle.svg';
import RcIconMore from '@/assets/icons/dapp/icon-more.svg';
import { Tip } from '@/components';

export const DappCardListBy = ({
  data,
}: {
  data: DappInfo['info']['collected_list'];
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [isShowTooltip, setIsShowTooltip] = useState(false);
  return data?.length ? (
    <Tip
      isVisible={isShowTooltip}
      onClose={() => {
        setIsShowTooltip(false);
      }}
      content={
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>
            {Platform.OS === 'ios' ? 'Website' : 'Dapps'} has been list by
          </Text>
          <View style={styles.tooltipList}>
            {data.map(item => {
              return (
                <View style={styles.tooltipListItem} key={item.logo_url}>
                  <Image
                    style={styles.tooltipListItemIcon}
                    source={{ uri: item.logo_url }}
                  />
                  <Text style={styles.tooltipListItemText}>{item.name}</Text>
                </View>
              );
            })}
          </View>
        </View>
      }>
      <TouchableWithoutFeedback
        disallowInterruption={true}
        hitSlop={{ left: 30, right: 30, top: 50, bottom: 50 }}
        onPress={() => {
          setIsShowTooltip(true);
        }}>
        <View style={styles.listBy}>
          {data.slice(0, 6).map(item => {
            return (
              <Image
                style={styles.listByIcon}
                source={{ uri: item.logo_url }}
                key={item.logo_url}
              />
            );
          })}
          {data.length > 6 ? <RcIconMore /> : null}
        </View>
      </TouchableWithoutFeedback>
    </Tip>
  ) : null;
};

export const DappCard = ({
  isActive,
  data,
  onPress,
  onFavoritePress,
  style,
}: {
  data: DappInfo;
  style?: StyleProp<ViewStyle>;
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
  isActive?: boolean;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const chain = CHAINS[data.chainId];

  return (
    <TouchableOpacity
      style={[styles.dappCard, style]}
      onPress={() => {
        onPress?.(data);
      }}>
      <View style={styles.body} onStartShouldSetResponder={() => true}>
        <View style={styles.dappIconWraper}>
          <DappIcon
            source={
              data?.info?.logo_url
                ? {
                    uri: data.info?.logo_url,
                  }
                : undefined
            }
            origin={data.origin}
            style={styles.dappIcon}
          />
          {isActive ? <View style={styles.dappIconCircle} /> : null}
          <>
            {data?.isConnected && chain ? (
              <Image
                source={{
                  uri: chain?.logo,
                }}
                style={styles.chainIcon}
              />
            ) : null}
            {!data?.isConnected ? (
              <RcIconDisconnect style={styles.chainIcon} />
            ) : null}
          </>
        </View>
        <View style={styles.dappContent}>
          <Text style={styles.dappOrigin} numberOfLines={1}>
            {stringUtils.unPrefix(data.origin, 'https://')}
          </Text>
          <View style={styles.dappInfo}>
            {data.info?.name ? (
              <Text
                style={[styles.dappInfoText, styles.dappName]}
                numberOfLines={1}>
                {data.info?.name}
              </Text>
            ) : null}
            {data.info?.name && data.info?.collected_list?.length ? (
              <View style={styles.divider} />
            ) : null}
            <DappCardListBy data={data.info?.collected_list} />
          </View>
        </View>
        <TouchableWithoutFeedback
          style={styles.dappAction}
          disallowInterruption={true}
          onPress={() => {
            onFavoritePress?.(data);
          }}>
          {data.isFavorite ? <RcIconStarFull /> : <RcIconStar />}
        </TouchableWithoutFeedback>
      </View>
      {data.info?.description && !isActive ? (
        <View style={styles.footer}>
          <View style={styles.dappDesc}>
            <RcIconTriangle style={styles.triangle} />
            <Text style={styles.dappDescText} numberOfLines={3}>
              {data.info.description}
            </Text>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    dappCard: {
      borderRadius: 8,
      backgroundColor: colors['neutral-card-1'],
      borderWidth: 1,
      borderColor: 'transparent',
    },

    dappContent: {
      flex: 1,
      flexDirection: 'column',
      gap: 2,
      overflow: 'hidden',
    },
    dappOrigin: {
      fontSize: 16,
      fontWeight: '500',
      fontStyle: 'normal',
      lineHeight: 19,
      color: colors['neutral-title-1'],
    },
    dappInfo: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
      // flexWrap: 'wrap',
      overflow: 'hidden',
      color: colors['neutral-body'],
    },

    dappName: {
      flexShrink: 1,
    },

    dappInfoText: {
      fontSize: 13,
      lineHeight: 16,
      color: colors['neutral-foot'],
      flexShrink: 0,
    },

    divider: {
      width: 1,
      height: 12,
      backgroundColor: colors['neutral-line'],
    },

    dappAction: {
      padding: 8,
      marginRight: -8,
    },
    body: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 12,
    },
    footer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    dappDesc: {
      position: 'relative',
      backgroundColor: colors['neutral-card-3'],
      padding: 8,
      borderRadius: 4,
    },
    dappDescText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors['neutral-body'],
    },
    triangle: {
      position: 'absolute',
      left: 8,
      top: -8,
    },
    dappIconWraper: {
      position: 'relative',
    },
    dappIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    dappIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 40,
      borderWidth: 1.5,
      borderColor: colors['green-default'],
      position: 'absolute',
      top: -4,
      left: -4,
    },
    chainIcon: {
      width: 16,
      height: 16,
      borderRadius: 16,
      position: 'absolute',
      right: -2,
      bottom: -2,
    },
    listBy: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    listByIcon: {
      width: 12,
      height: 12,
      borderRadius: 12,
      opacity: 0.7,
    },
    tooltip: {
      padding: 12,
    },
    tooltipTitle: {
      color: colors['neutral-title2'],
      marginBottom: 6,
      fontSize: 12,
      lineHeight: 14,
    },
    tooltipList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tooltipListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    tooltipListItemIcon: {
      width: 12,
      height: 12,
      borderRadius: 12,
      flexShrink: 0,
    },
    tooltipListItemText: {
      color: colors['neutral-title2'],
      fontSize: 12,
      lineHeight: 14,
    },
  });
