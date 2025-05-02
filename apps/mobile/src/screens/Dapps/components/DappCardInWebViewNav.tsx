import React from 'react';

import RcIconStarFull from '@/assets/icons/dapp/icon-star-full.svg';
import RcIconStar from '@/assets/icons/dapp/icon-star.svg';
import { useThemeStyles } from '@/hooks/theme';
import { DappInfo } from '@/core/services/dappService';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { DappIcon } from './DappIcon';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';
import { createGetStyles, makeTriangleStyle } from '@/utils/styles';
import { formatDappOriginToShow } from '@/utils/url';
import { DappCardListBy } from './DappCard';

const NUM_OF_LINES = 3;

export const DappCardInWebViewNav = ({
  data,
  style,
  onFavoritePress,
}: {
  data: DappInfo;
  style?: StyleProp<ViewStyle>;
  onFavoritePress?: (dapp: DappInfo) => void;
}) => {
  const { styles } = useThemeStyles(getStyles);

  // const [description, setDescription] = React.useState(
  //   data.info?.description || '',
  // );
  // const {dapps} = useDapps();

  // React.useEffect(() => {
  //   (async () => {
  //     if (data.origin && !data.info?.description) {
  //       const dappInfo = await apisDapp.cachedFetchDappInfo(
  //         [data.origin],
  //         data.origin,
  //         false,
  //       );

  //       setDescription(dappInfo?.description);
  //     }
  //   })();
  // }, [data.origin, data.info?.description]);

  // React.useEffect(() => {
  //   if (data.info?.description) {
  //     setDescription(data.info.description);
  //   }
  // }, [data.info?.description]);

  return (
    <View style={[styles.dappCard, style]}>
      <View style={styles.body}>
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
            {formatDappOriginToShow(data.origin)}
          </Text>
          <View style={styles.dappInfo}>
            {data.info?.name ? (
              <Text
                style={[styles.dappInfoText, styles.dappName]}
                numberOfLines={1}>
                {data.info.name}
              </Text>
            ) : null}
            {data.info?.name && data.info.collected_list?.length ? (
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
      {data?.info?.description ? (
        <View style={styles.footer}>
          <View
            className="relative"
            style={[styles.dappDescWrapper, styles.scrollableDesc]}>
            <View style={styles.triangle} />
            <Text
              style={styles.dappDescText}
              numberOfLines={NUM_OF_LINES}
              ellipsizeMode="tail">
              {data?.info?.description}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const getStyles = createGetStyles((colors, ctx) => {
  const descWrapperBgColor = colors['neutral-card-3'];

  return {
    dappCard: {
      backgroundColor: ctx?.isLight ? colors['neutral-card-1'] : 'transparent',
      // backgroundColor: 'blue',
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
      overflow: 'hidden',
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
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 12,
    },
    footer: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      flexDirection: 'row',
      maxWidth: '100%',
    },
    scrollableDesc: {
      // 3 lines
      maxHeight: NUM_OF_LINES * 26,
      overflow: 'visible',
    },
    dappDescWrapper: {
      flexShrink: 1,
      width: '100%',
      position: 'relative',
      color: colors['neutral-body'],
      backgroundColor: descWrapperBgColor,
      padding: 8,
      borderRadius: 4,
      overflow: 'visible',
    },
    dappDescText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors['neutral-body'],
    },
    triangle: {
      position: 'absolute',
      left: 8,
      top: -8 * 2,
      ...makeTriangleStyle({
        dir: 'up',
        size: 8,
        color: descWrapperBgColor,
      }),
      borderTopWidth: 8,
      borderLeftWidth: 8,
      borderRightWidth: 8,
    },
    dappIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
  };
});
