import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import RcIconStar from '@/assets/icons/dapp/icon-star.svg';
import RcIconTriangle from '@/assets/icons/dapp/icon-triangle.svg';
import RcIconStarFull from '@/assets/icons/dapp/icon-star-full.svg';
import { Colors } from '@/constant/theme';
import React from 'react';
import { useThemeColors } from '@/hooks/theme';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { RectButton } from 'react-native-gesture-handler';

export const DappCard = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.dappCard}>
      <View style={styles.body}>
        <Image
          source={{
            uri: 'https://static.debank.com/image/project/logo_url/makerdao/3821328c7c6d5ac4fc87e2c2e4d1c684.png',
          }}
          style={styles.dappIcon}
        />
        <View style={styles.dappContent}>
          <Text style={styles.dappOrigin}>stake.lido.fi</Text>
          <View style={styles.dappInfo}>
            <Text style={styles.dappInfoText}>Lido</Text>
            <Text style={styles.dappInfoText}>User 10k</Text>
          </View>
        </View>
        <View style={styles.dappAction}>
          <RcIconStarFull />
        </View>
      </View>
      <View style={styles.footer}>
        <View style={styles.dappDesc}>
          <RcIconTriangle style={styles.triangle} />
          <Text style={styles.dappDescText}>
            “Earn interest, borrow assets lear, and qui build easy applications”
          </Text>
        </View>
      </View>
    </View>
  );
};

const getStyles = (colors: Colors) =>
  StyleSheet.create({
    dappCard: {
      borderRadius: 8,
      backgroundColor: colors['neutral-card-1'],
    },

    dappContent: {
      flex: 1,
      flexDirection: 'column',
      gap: 2,
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
    },

    dappInfoText: {
      fontSize: 13,
      lineHeight: 16,
      color: colors['neutral-foot'],
    },

    dappAction: {},
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
    },
  });
