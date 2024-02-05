import RcIconDelete from '@/assets/icons/dapp/icon-delete.svg';
import RcIconDisconnect from '@/assets/icons/dapp/icon-disconnect.svg';
import { useThemeColors } from '@/hooks/theme';
import { DappInfo } from '@/core/services/dappService';
import React, { LegacyRef, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import Swipeable, {
  SwipeableProps,
} from 'react-native-gesture-handler/Swipeable';
import { DappCard } from '../../components/DappCard';
import { EventEmitter } from 'ahooks/lib/useEventEmitter';

export const SwipeableDappCard = ({
  data,
  onPress,
  onFavoritePress,
  onRemovePress,
  onDisconnectPress,
  style,
  isActive,
  close$,
}: {
  data: DappInfo;
  style?: StyleProp<ViewStyle>;
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
  onRemovePress?: (dapp: DappInfo) => void;
  onDisconnectPress?: (dapp: DappInfo) => void;
  isActive?: boolean;
  close$?: EventEmitter<void>;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const swipeRef = useRef<any>(null);

  close$?.useSubscription(() => {
    swipeRef.current?.close();
  });

  const isConnected = !!data?.isConnected;

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
        <Animated.View
          style={[
            styles.actionContainer,
            // eslint-disable-next-line react-native/no-inline-styles
            {
              width: isConnected ? 128 : 64,
            },
          ]}>
          {isConnected ? (
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
          ) : null}
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
      isConnected,
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
      // activeOffsetX={[-30, 30]}
      // failOffsetY={[-30, 30]}
      ref={swipeRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      containerStyle={styles.containerStyle}>
      <DappCard
        data={data}
        onFavoritePress={onFavoritePress}
        onPress={onPress}
        style={[styles.cardStyle, style]}
        isActive={isActive}
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
