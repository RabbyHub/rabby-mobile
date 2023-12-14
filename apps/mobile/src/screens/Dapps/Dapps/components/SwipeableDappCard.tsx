import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import RcIconStar from '@/assets/icons/dapp/icon-star.svg';
import RcIconTriangle from '@/assets/icons/dapp/icon-triangle.svg';
import RcIconStarFull from '@/assets/icons/dapp/icon-star-full.svg';
import RcIconDelete from '@/assets/icons/dapp/icon-delete.svg';
import RcIconDisconnect from '@/assets/icons/dapp/icon-disconnect.svg';
import { Colors } from '@/constant/theme';
import React from 'react';
import { useThemeColors } from '@/hooks/theme';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { RectButton } from 'react-native-gesture-handler';
import { DappCard } from '../../components/DappCard';

export const SwipeableDappCard = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const renderRightActions = React.useCallback(() => {
    return (
      <Animated.View style={styles.actionContainer}>
        <RectButton
          style={[styles.action, styles.actionDisconnect]}
          onPress={() => {
            console.log('press disconnect');
          }}>
          <RcIconDisconnect />
        </RectButton>
        <RectButton
          style={[styles.action, styles.actionDelete]}
          onPress={() => {
            console.log('press delete');
          }}>
          <RcIconDelete />
        </RectButton>
      </Animated.View>
    );
  }, [
    styles.action,
    styles.actionContainer,
    styles.actionDelete,
    styles.actionDisconnect,
  ]);

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <DappCard />
    </Swipeable>
  );
};

const getStyles = (colors: Colors) =>
  StyleSheet.create({
    actionContainer: {
      flexDirection: 'row',
    },
    action: {
      paddingHorizontal: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionDisconnect: {
      backgroundColor: colors['orange-default'],
    },
    actionDelete: {
      backgroundColor: colors['red-default'],
      borderTopEndRadius: 8,
      borderBottomEndRadius: 8,
    },
  });
