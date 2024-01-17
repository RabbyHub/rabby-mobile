import RcIconStarFull from '@/assets/icons/dapp/icon-star-full.svg';
import RcIconStar from '@/assets/icons/dapp/icon-star.svg';
import RcIconTriangle from '@/assets/icons/dapp/icon-triangle.svg';
import { useThemeColors } from '@/hooks/theme';
import { DappInfo } from '@/core/services/dappService';
import React from 'react';
import {
  Image,
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

export const DappCard = ({
  data,
  onPress,
  onFavoritePress,
  style,
}: {
  data: DappInfo;
  style?: StyleProp<ViewStyle>;
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={[styles.dappCard, style]}
      onPress={() => {
        onPress?.(data);
      }}>
      <View style={styles.body}>
        {/* <Image
          source={{
            uri: data.info.logo_url,
          }}
          style={styles.dappIcon}
        /> */}
        <DappIcon
          source={
            data?.info?.logo_url
              ? {
                  uri: data.info.logo_url,
                }
              : undefined
          }
          origin={data.origin}
          style={styles.dappIcon}
        />
        <View style={styles.dappContent}>
          <Text style={styles.dappOrigin} numberOfLines={1}>
            {stringUtils.unPrefix(data.origin, 'https://')}
          </Text>
          <View style={styles.dappInfo}>
            {data.info.name ? (
              <Text
                style={[styles.dappInfoText, styles.dappName]}
                numberOfLines={1}>
                {data.info.name}
              </Text>
            ) : null}
            {data.info.name && data.info.user_range ? (
              <View style={styles.divider} />
            ) : null}
            {data.info.user_range ? (
              <Text style={styles.dappInfoText} numberOfLines={1}>
                {data.info.user_range}
              </Text>
            ) : null}
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
      {data.info.description ? (
        <View style={styles.footer}>
          <View style={styles.dappDesc}>
            <RcIconTriangle style={styles.triangle} />
            <Text style={styles.dappDescText} numberOfLines={2}>
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
    dappIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
  });
