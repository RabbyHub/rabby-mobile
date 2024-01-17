import RcIconDelete from '@/assets/icons/dapp/icon-delete.svg';
import RcIconDisconnect from '@/assets/icons/dapp/icon-disconnect.svg';
import { useThemeColors } from '@/hooks/theme';
import { DappInfo } from '@/core/services/dappService';
import React from 'react';
import { Animated, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import Swipeable, {
  SwipeableProps,
} from 'react-native-gesture-handler/Swipeable';
import { DappCard } from '../../components/DappCard';

export const SwipeableDappCard = ({
  data,
  onPress,
  onFavoritePress,
  onRemovePress,
  onDisconnectPress,
  style,
}: {
  data: DappInfo;
  style?: StyleProp<ViewStyle>;
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
  onRemovePress?: (dapp: DappInfo) => void;
  onDisconnectPress?: (dapp: DappInfo) => void;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const renderRightActions = React.useCallback(
    (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
    ) => {
      const trans = [128, 64].map(x => {
        return progress.interpolate({
          inputRange: [0, 1],
          outputRange: [x, 0],
        });
      });

      return (
        <Animated.View style={[styles.actionContainer]}>
          <Animated.View
            style={{
              transform: [{ translateX: trans[0] }],
            }}>
            <RectButton
              style={[styles.action, styles.actionDisconnect]}
              onPress={() => {
                onDisconnectPress?.(data);
              }}>
              <RcIconDisconnect />
            </RectButton>
          </Animated.View>
          <Animated.View
            style={{
              transform: [{ translateX: trans[1] }],
            }}>
            <RectButton
              style={[styles.action, styles.actionDelete]}
              onPress={() => {
                onRemovePress?.(data);
              }}>
              <RcIconDelete />
            </RectButton>
          </Animated.View>
        </Animated.View>
      );
    },
    [
      data,
      onDisconnectPress,
      onRemovePress,
      styles.action,
      styles.actionContainer,
      styles.actionDelete,
      styles.actionDisconnect,
    ],
  );

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      containerStyle={styles.containerStyle}>
      <DappCard
        data={data}
        onFavoritePress={onFavoritePress}
        onPress={onPress}
        style={[styles.cardStyle, style]}
      />
    </Swipeable>
  );
};

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    containerStyle: {
      borderRadius: 8,
    },
    cardStyle: {
      borderRadius: 0,
    },
    actionContainer: {
      flexDirection: 'row',
      width: 128,
      alignItems: 'stretch',
    },
    action: {
      paddingHorizontal: 20,
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
    },
    actionDisconnect: {
      backgroundColor: colors['orange-default'],
    },
    actionDelete: {
      backgroundColor: colors['red-default'],
    },
  });
