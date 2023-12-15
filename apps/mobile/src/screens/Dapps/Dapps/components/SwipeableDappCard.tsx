import RcIconDelete from '@/assets/icons/dapp/icon-delete.svg';
import RcIconDisconnect from '@/assets/icons/dapp/icon-disconnect.svg';
import { useThemeColors } from '@/hooks/theme';
import { DappInfo } from '@rabby-wallet/service-dapp';
import React from 'react';
import { Animated, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';
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
  const renderRightActions = React.useCallback(() => {
    return (
      <Animated.View style={styles.actionContainer}>
        <RectButton
          style={[styles.action, styles.actionDisconnect]}
          onPress={() => {
            onDisconnectPress?.(data);
          }}>
          <RcIconDisconnect />
        </RectButton>
        <RectButton
          style={[styles.action, styles.actionDelete]}
          onPress={() => {
            onRemovePress?.(data);
          }}>
          <RcIconDelete />
        </RectButton>
      </Animated.View>
    );
  }, [
    data,
    onDisconnectPress,
    onRemovePress,
    styles.action,
    styles.actionContainer,
    styles.actionDelete,
    styles.actionDisconnect,
  ]);

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <DappCard
        data={data}
        onFavoritePress={onFavoritePress}
        onPress={onPress}
        style={style}
      />
    </Swipeable>
  );
};

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
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
