import RcIconTriangle from '@/assets/icons/dapp/icon-triangle.svg';
import { useThemeColors } from '@/hooks/theme';
import { DappInfo } from '@rabby-wallet/service-dapp';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { DappIcon } from './DappIcon';

export const DappCardInWebViewNav = ({
  data,
  style,
}: {
  data: DappInfo;
  style?: StyleProp<ViewStyle>;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

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
          origin={data.info.id}
          style={styles.dappIcon}
        />
        <View style={styles.dappContent}>
          <Text style={styles.dappOrigin} numberOfLines={1}>
            {data.info.id}
          </Text>
          <View style={styles.dappInfo}>
            <Text
              style={[styles.dappInfoText, styles.dappName]}
              numberOfLines={1}>
              {data.info.name}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.dappInfoText} numberOfLines={1}>
              {data.info.user_range}
            </Text>
          </View>
        </View>
      </View>
      {data.info.description ? (
        <View style={styles.footer}>
          <View style={styles.dappDesc}>
            <RcIconTriangle style={styles.triangle} />
            <Text style={styles.dappDescText}>{data.info.description}</Text>
          </View>
        </View>
      ) : null}
    </View>
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
      color: colors['neutral-body'],
      backgroundColor: colors['neutral-card-3'],
      padding: 8,
      borderRadius: 4,
    },
    dappDescText: {
      fontSize: 14,
      lineHeight: 20,
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
